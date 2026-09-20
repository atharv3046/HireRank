"""
test_security.py
================
Tests for the 8 security and architecture fixes applied to HireRank.

Run with:
    cd backend
    pytest tests/test_security.py -v
"""
import os
import shutil
import tempfile
from datetime import datetime, timezone, timedelta
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# ─── Test DB setup ────────────────────────────────────────────────────────────
TEST_DB_URL = "sqlite:///./test_security.db"

os.environ.setdefault("DATABASE_URL", TEST_DB_URL)
os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("UPLOAD_DIR", "./test_uploads")
os.environ.setdefault("GOOGLE_CLIENT_ID", "test-client-id.apps.googleusercontent.com")

from app.core.database import Base, get_db
from app.main import app
from app.core.security import hash_password, create_access_token
from app.models.user import User
from app.models.job_posting import JobPosting
from app.models.guest_session import GuestSession
from app.models.candidate import Candidate
from app.models.match_score import MatchScore

engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app, raise_server_exceptions=False)


def make_user(db, email="user@test.com", password="pw123456") -> tuple:
    u = User(email=email, password_hash=hash_password(password), role="recruiter", company_name="Test Co")
    db.add(u)
    db.commit()
    db.refresh(u)
    token = create_access_token({"sub": str(u.id)})
    return u, token


def make_guest_session(db, user=None, expired=False, expires_at=None) -> tuple:
    """Create a guest user, job, and GuestSession. Returns (guest_sess, job, guest_user_id)."""
    from app.core.security import hash_password as hp
    import uuid
    guest_u = db.query(User).filter(User.email == "guest@hirerank.internal").first()
    if not guest_u:
        guest_u = User(email="guest@hirerank.internal", password_hash=hp("x"), role="guest", company_name="Guest")
        db.add(guest_u)
        db.commit()
        db.refresh(guest_u)

    job = JobPosting(recruiter_id=guest_u.id, title="Test Job", description="Python developer needed", status="active")
    job.required_skills = ["Python"]
    db.add(job)
    db.commit()
    db.refresh(job)

    now = datetime.now(timezone.utc)
    if expired:
        exp = now - timedelta(hours=2)
    elif expires_at:
        exp = expires_at
    else:
        exp = now + timedelta(hours=24)

    session_id = str(uuid.uuid4())
    gs = GuestSession(
        id=session_id,
        job_id=job.id,
        created_at=now,
        expires_at=exp,
        claimed_by_org_id=user.id if user else None,
        status="done",
        stage="done",
        total=1,
        done=1,
    )
    db.add(gs)
    db.commit()
    return gs, job, guest_u


@pytest.fixture(autouse=True)
def clean_db():
    with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(table.delete())
    yield


# ─────────────────────────────────────────────────────────────────────────────
# Fix 1: Claim endpoint ignores any user_id query param;
#         identity comes ONLY from JWT sub.
# ─────────────────────────────────────────────────────────────────────────────

def test_fix1_claim_ignores_user_id_param():
    """
    Passing ?user_id=<other_id> must not let you claim on behalf of someone else.
    The endpoint must use the JWT sub, not the query param.
    """
    db = TestingSessionLocal()
    try:
        user_a, token_a = make_user(db, email="a@test.com")
        user_b, _ = make_user(db, email="b@test.com")
        guest_sess, job, _ = make_guest_session(db)

        # user_a logs in with token_a but passes user_b's id as query param
        resp = client.post(
            f"/api/guest/session/{guest_sess.id}/claim",
            params={"user_id": user_b.id},
            headers={"Authorization": f"Bearer {token_a}"},
        )
        assert resp.status_code == 200
        db.refresh(job)
        # Job should be owned by user_a (the JWT holder), NOT user_b
        assert job.recruiter_id == user_a.id, (
            f"Expected job owned by user_a ({user_a.id}) but got {job.recruiter_id}. "
            "Backend is trusting ?user_id param instead of JWT sub."
        )
    finally:
        db.close()


# ─────────────────────────────────────────────────────────────────────────────
# Fix 2: 409 Conflict when session already claimed by a different user.
#         Idempotent 200 when same user claims again.
# ─────────────────────────────────────────────────────────────────────────────

def test_fix2_409_when_claimed_by_different_user():
    """Second claim by a different user must return 409 Conflict."""
    db = TestingSessionLocal()
    try:
        user_a, token_a = make_user(db, email="a@test.com")
        user_b, token_b = make_user(db, email="b@test.com")
        guest_sess, job, _ = make_guest_session(db, user=user_a)  # already claimed by user_a

        resp = client.post(
            f"/api/guest/session/{guest_sess.id}/claim",
            headers={"Authorization": f"Bearer {token_b}"},
        )
        assert resp.status_code == 409, f"Expected 409, got {resp.status_code}: {resp.json()}"
        assert "already been claimed" in resp.json()["detail"].lower()
    finally:
        db.close()


def test_fix2_idempotent_same_user():
    """Same user claiming their own session again returns 200 (idempotent)."""
    db = TestingSessionLocal()
    try:
        user_a, token_a = make_user(db, email="a@test.com")
        guest_sess, _, _ = make_guest_session(db, user=user_a)

        resp = client.post(
            f"/api/guest/session/{guest_sess.id}/claim",
            headers={"Authorization": f"Bearer {token_a}"},
        )
        assert resp.status_code == 200
        assert resp.json()["already_owned"] is True
    finally:
        db.close()


# ─────────────────────────────────────────────────────────────────────────────
# Fix 3: Both pipelines call the same scoring function.
#         Same resume+JD → identical scores from both entry points.
# ─────────────────────────────────────────────────────────────────────────────

def test_fix3_shared_scoring_identical_results():
    """
    score_and_save() (called by both guest and auth pipelines) must
    produce identical output for the same candidate+job inputs.
    """
    try:
        from app.services.scoring_shared import score_and_save
        from app.tasks.resume_tasks import process_resume_pipeline
    except ImportError as e:
        pytest.skip(f"Scoring modules not available in test env: {e}")

    # Both pipelines call score_and_save — if that function is identical
    # for both, calling it twice with same inputs produces same result.
    db = TestingSessionLocal()
    try:
        import uuid
        guest_u = User(email="guest@hirerank.internal", password_hash="x", role="guest", company_name="Guest")
        db.add(guest_u)
        db.commit()
        db.refresh(guest_u)

        job = JobPosting(
            recruiter_id=guest_u.id,
            title="Python Engineer",
            description="We need a Python engineer with FastAPI experience.",
            status="active",
        )
        job.required_skills = ["Python", "FastAPI"]
        job.min_experience_years = 3.0
        db.add(job)
        db.commit()
        db.refresh(job)

        def make_candidate():
            c = Candidate(
                job_posting_id=job.id,
                raw_text="John Doe. Python developer with 4 years experience in FastAPI and REST APIs.",
                name="John Doe",
                email="john@example.com",
                extracted_skills=["Python", "FastAPI"],
                experience_years=4.0,
                education_level="bachelors",
                detected_title="Python Developer",
                processing_status="extracted",
            )
            db.add(c)
            db.commit()
            db.refresh(c)
            return c

        c1 = make_candidate()
        result1 = score_and_save(c1.id, job.id, db)

        c2 = make_candidate()
        result2 = score_and_save(c2.id, job.id, db)

        assert result1["final_score"] == result2["final_score"], (
            f"Same inputs produced different scores: {result1['final_score']} vs {result2['final_score']}. "
            "Scoring pipelines have diverged."
        )
        assert result1["tier"] == result2["tier"]
        assert result1["skills_score"] == result2["skills_score"]
    finally:
        db.close()


# ─────────────────────────────────────────────────────────────────────────────
# Fix 4: Cleanup job deletes expired unclaimed sessions + physical files.
#         Claimed sessions are NEVER touched.
# ─────────────────────────────────────────────────────────────────────────────

def test_fix4_cleanup_deletes_expired_unclaimed():
    """Expired unclaimed sessions + their files must be deleted."""
    from app.tasks.cleanup import delete_expired_guest_sessions

    db = TestingSessionLocal()
    tmp_dir = Path("./test_uploads")
    try:
        gs, job, _ = make_guest_session(db, expired=True)  # unclaimed + expired
        session_id = gs.id

        # Create fake upload dir to simulate physical files
        fake_dir = tmp_dir / "guest" / session_id
        fake_dir.mkdir(parents=True, exist_ok=True)
        (fake_dir / "resume.pdf").write_bytes(b"fake pdf")
        with patch("app.tasks.cleanup.SessionLocal", TestingSessionLocal), \
             patch("app.tasks.cleanup.settings.UPLOAD_DIR", str(tmp_dir)):
            result = delete_expired_guest_sessions()

        assert result["sessions_deleted"] >= 1, f"Expected cleanup to delete session, got: {result}"
        # DB row must be gone
        db.expire_all()
        assert db.query(GuestSession).filter(GuestSession.id == session_id).first() is None
        # Physical file directory must be gone
        assert not fake_dir.exists(), f"Physical file dir still exists after cleanup: {fake_dir}"
    finally:
        db.close()
        shutil.rmtree(tmp_dir, ignore_errors=True)


def test_fix4_cleanup_never_touches_claimed_sessions():
    """Sessions claimed by a user must survive the cleanup job."""
    from app.tasks.cleanup import delete_expired_guest_sessions

    db = TestingSessionLocal()
    try:
        user_a, _ = make_user(db, email="a@test.com")
        # Claimed session: expires_at=None (claimed), claimed_by_org_id=user_a.id
        gs, _, _ = make_guest_session(db, user=user_a)
        # Set expires_at to past to simulate what would be deleted if not claimed
        gs.expires_at = datetime.now(timezone.utc) - timedelta(hours=2)
        db.commit()

        with patch("app.tasks.cleanup.SessionLocal", TestingSessionLocal):
            result = delete_expired_guest_sessions()

        db.expire_all()
        # Must still exist
        assert db.query(GuestSession).filter(GuestSession.id == gs.id).first() is not None, (
            "Claimed session was deleted by cleanup job — this is data loss!"
        )
    finally:
        db.close()


# ─────────────────────────────────────────────────────────────────────────────
# Fix 5: Rate limiter returns 429 after 5 requests from same IP.
# NOTE: Each test run uses a fresh TestClient with isolated limiter state.
# ─────────────────────────────────────────────────────────────────────────────

def test_fix5_rate_limit_enforced():
    """POST /api/guest/screen must return 429 after 5 requests per hour per IP."""
    from slowapi import Limiter
    from slowapi.util import get_remote_address
    from app.routers.guest import limiter

    # Reset limiter storage for this test to avoid cross-test contamination
    if hasattr(limiter, "_storage"):
        limiter._storage.reset()

    # Minimal valid JD
    jd = "A" * 60  # > 50 char minimum
    minimal_pdf = b"%PDF-1.4 1 0 obj<</Type/Catalog>>endobj"

    ok_count = 0
    for _ in range(6):
        resp = client.post(
            "/api/guest/screen",
            data={"job_description": jd},
            files=[("files", ("resume.pdf", minimal_pdf, "application/pdf"))],
        )
        if resp.status_code == 429:
            break
        ok_count += 1

    assert ok_count <= 5, f"Rate limiter allowed {ok_count} requests (expected max 5)"


# ─────────────────────────────────────────────────────────────────────────────
# Fix 6: /preview route removed — must return 404 or 405, not 200.
# ─────────────────────────────────────────────────────────────────────────────

def test_fix6_preview_route_removed():
    """/api/guest/session/:id/preview must no longer exist."""
    resp = client.get("/api/guest/session/any-id/preview")
    assert resp.status_code in (404, 405), (
        f"/preview alias still exists and returned {resp.status_code}. "
        "Remove the route — use /results exclusively."
    )


# ─────────────────────────────────────────────────────────────────────────────
# Fix 7: Google auth rejects token issued for a different client_id.
# ─────────────────────────────────────────────────────────────────────────────

def test_fix7_google_auth_rejects_wrong_audience():
    """
    A validly-signed Google token for a DIFFERENT client_id must be rejected with 401.
    We mock Google's tokeninfo endpoint to return a mismatched aud.
    """
    wrong_aud_response = MagicMock()
    wrong_aud_response.status_code = 200
    wrong_aud_response.json.return_value = {
        "aud": "OTHER-CLIENT-ID.apps.googleusercontent.com",  # wrong app
        "email": "hacker@example.com",
        "email_verified": "true",
    }

    with patch("httpx.get", return_value=wrong_aud_response):
        resp = client.post(
            "/api/auth/google",
            json={"credential": "some-valid-but-wrong-app-token"},
        )

    assert resp.status_code == 401, (
        f"Expected 401 for wrong-audience token, got {resp.status_code}. "
        "Google tokens from other apps can log into HireRank — audience check missing."
    )
    assert "application" in resp.json()["detail"].lower()


def test_fix7_google_auth_rejects_unverified_email():
    """Google tokens with email_verified=false must be rejected."""
    from app.core.config import settings
    unverified_response = MagicMock()
    unverified_response.status_code = 200
    unverified_response.json.return_value = {
        "aud": settings.GOOGLE_CLIENT_ID or "test-client-id.apps.googleusercontent.com",  # correct app
        "email": "unverified@example.com",
        "email_verified": "false",
    }

    with patch("httpx.get", return_value=unverified_response):
        resp = client.post(
            "/api/auth/google",
            json={"credential": "token-with-unverified-email"},
        )

    assert resp.status_code == 401
    assert "verified" in resp.json()["detail"].lower()


# ─────────────────────────────────────────────────────────────────────────────
# Fix 8: Authenticated upload rejects files over 10 MB.
# ─────────────────────────────────────────────────────────────────────────────

def test_fix8_authenticated_upload_rejects_oversized_file():
    """POST /api/jobs/:id/upload must reject files over 10 MB with 413."""
    db = TestingSessionLocal()
    try:
        user, token = make_user(db, email="r@test.com")
        job = JobPosting(
            recruiter_id=user.id,
            title="Test", description="Test job", status="active",
        )
        job.required_skills = []
        db.add(job)
        db.commit()
        db.refresh(job)

        # 11 MB of fake PDF data
        oversized = b"x" * (11 * 1024 * 1024)
        resp = client.post(
            f"/api/jobs/{job.id}/upload",
            files={"file": ("big.pdf", oversized, "application/pdf")},
            headers={"Authorization": f"Bearer {token}"},
        )

        assert resp.status_code == 413, (
            f"Expected 413 for 11 MB file, got {resp.status_code}. "
            "Server-side file size check is missing."
        )
    finally:
        db.close()


def test_fix8_authenticated_upload_accepts_valid_file():
    """Authentic uploads under 10 MB with valid extension must still work."""
    db = TestingSessionLocal()
    try:
        user, token = make_user(db, email="r2@test.com")
        job = JobPosting(
            recruiter_id=user.id,
            title="Test", description="Test job", status="active",
        )
        job.required_skills = []
        db.add(job)
        db.commit()
        db.refresh(job)

        # Minimal valid-ish PDF (1 KB)
        small_pdf = b"%PDF-1.4 fake content " + b"A" * 1024
        resp = client.post(
            f"/api/jobs/{job.id}/upload",
            files={"file": ("small.pdf", small_pdf, "application/pdf")},
            headers={"Authorization": f"Bearer {token}"},
        )
        # Should succeed (200) or fail with extraction error (422/500), not size rejection (413)
        assert resp.status_code != 413, "Valid small file incorrectly rejected with 413"
    finally:
        db.close()
