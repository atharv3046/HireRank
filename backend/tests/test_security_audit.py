"""
test_security_audit.py
======================
Comprehensive automated verification suite for HireRank security hardening:
1. Refresh Token Flow & Token Type Confusion Prevention
2. Magic Bytes Inspection on File Uploads (PDF/DOCX)
3. IDOR Prevention on Candidate & Scoring Endpoints
4. Strict Request Schema Validation (ConfigDict extra='forbid')
5. Team Invite & Workspace Role Authorization
6. Email HTML Escaping & Anti-XSS Sanitization
7. Security Headers Middleware Verification
8. Internal API Secret Protection
"""

import os
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

TEST_DB_URL = "sqlite:///./test_security_audit.db"
os.environ["DATABASE_URL"] = TEST_DB_URL
os.environ["SECRET_KEY"] = "test-security-audit-secret-key-32charsmin!"
os.environ["UPLOAD_DIR"] = "./test_audit_uploads"

from app.core.database import Base, get_db
from app.main import app
from app.core.config import settings
from app.core.security import hash_password, create_access_token, create_refresh_token, decode_access_token, decode_refresh_token
from app.models.user import User
from app.models.job_posting import JobPosting
from app.models.candidate import Candidate
from app.models.match_score import MatchScore
from app.models.team_member import TeamMember
from app.services.email import send_team_invite_email, send_candidate_invite_email
from app.core.limiter import limiter

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


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """Reset rate limiter memory storage between tests."""
    if hasattr(limiter, "_storage"):
        limiter._storage.reset()


def create_test_user(email: str, role: str = "recruiter") -> tuple[User, str]:
    db = TestingSessionLocal()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            email=email,
            password_hash=hash_password("AuditPassword123!"),
            role=role,
            company_name=f"{email.split('@')[0]} Org"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    token = create_access_token({"sub": str(user.id)})
    db.close()
    return user, token


# ── 1. REFRESH TOKEN FLOW & TOKEN CONFUSION ──────────────────────────────────

def test_refresh_token_flow_and_type_discrimination():
    user, _ = create_test_user("refresh_test@example.com")
    
    # 1. Login to get access and refresh tokens
    resp = client.post("/auth/login", json={
        "email": "refresh_test@example.com",
        "password": "AuditPassword123!"
    })
    assert resp.status_code == 200, resp.text
    data = resp.json()
    access_token = data["access_token"]
    refresh_token = data["refresh_token"]
    assert access_token and refresh_token
    assert access_token != refresh_token

    # 2. Verify token types in payloads
    acc_payload = decode_access_token(access_token)
    assert acc_payload.get("type") == "access"
    ref_payload = decode_refresh_token(refresh_token)
    assert ref_payload.get("type") == "refresh"

    # 3. Access token cannot be used to refresh
    invalid_refresh_resp = client.post("/auth/refresh", json={"refresh_token": access_token})
    assert invalid_refresh_resp.status_code == 401
    assert "Invalid or expired refresh token" in invalid_refresh_resp.json()["detail"]

    # 4. Refresh token cannot be used as Bearer access token on protected endpoints
    ref_as_access_resp = client.get("/candidates", headers={"Authorization": f"Bearer {refresh_token}"})
    assert ref_as_access_resp.status_code == 401
    assert "Invalid or expired token" in ref_as_access_resp.json()["detail"]

    # 5. Valid refresh returns new access and refresh tokens
    refresh_resp = client.post("/auth/refresh", json={"refresh_token": refresh_token})
    assert refresh_resp.status_code == 200
    new_data = refresh_resp.json()
    assert "access_token" in new_data
    assert "refresh_token" in new_data


# ── 2. MAGIC BYTES ENFORCEMENT ───────────────────────────────────────────────

def test_magic_bytes_enforcement_authenticated_upload():
    user, token = create_test_user("uploader@example.com")
    db = TestingSessionLocal()
    job = JobPosting(
        recruiter_id=user.id,
        title="Test Job For Uploads",
        description="Must have 5 years Python and FastAPI",
        required_skills=["Python", "FastAPI"],
        status="active"
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    job_id = job.id
    db.close()

    # Attempt to upload a spoofed file: .pdf extension with plain text bytes
    fake_pdf = b"Hello, this is just a plain text file pretending to be a PDF!"
    resp = client.post(
        f"/jobs/{job_id}/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("fake_resume.pdf", fake_pdf, "application/pdf")}
    )
    assert resp.status_code == 422
    assert "invalid magic byte" in resp.json()["detail"].lower()

    # Upload with genuine PDF magic bytes %PDF-
    valid_pdf_bytes = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"
    valid_resp = client.post(
        f"/jobs/{job_id}/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("valid_resume.pdf", valid_pdf_bytes, "application/pdf")}
    )
    assert valid_resp.status_code == 200
    assert "candidate_id" in valid_resp.json()


def test_magic_bytes_enforcement_guest_screen():
    fake_pdf = b"NOT_A_PDF_CONTENT_HERE"
    resp = client.post(
        "/guest/screen",
        data={"job_description": "We need an engineer with Python, Django, AWS experience and 4 years of work history."},
        files=[("files", ("spoofed.pdf", fake_pdf, "application/pdf"))]
    )
    # Guest endpoint skips invalid magic byte files and rejects batch if no valid files remain
    assert resp.status_code == 422
    assert "invalid magic byte" in resp.json()["detail"].lower() or "no valid resume files" in resp.json()["detail"].lower()


# ── 3. IDOR PREVENTION ───────────────────────────────────────────────────────

def test_candidate_idor_prevention():
    user1, token1 = create_test_user("user1@example.com")
    user2, token2 = create_test_user("user2@example.com")

    db = TestingSessionLocal()
    # Create Job & Candidate for User 1
    job1 = JobPosting(recruiter_id=user1.id, title="User 1 Job", description="Description", status="active")
    db.add(job1)
    db.commit()
    cand1 = Candidate(job_posting_id=job1.id, name="Alice Candidate", email="alice@test.com", processing_status="done")
    db.add(cand1)
    db.commit()
    cand1_id = cand1.id

    # Create Job for User 2
    job2 = JobPosting(recruiter_id=user2.id, title="User 2 Job", description="Description", status="active")
    db.add(job2)
    db.commit()
    job2_id = job2.id
    db.close()

    # User 2 tries to access User 1's candidate via GET /candidates/{id} -> 404
    resp = client.get(f"/candidates/{cand1_id}", headers={"Authorization": f"Bearer {token2}"})
    assert resp.status_code == 404

    # User 2 tries to access User 1's candidate status -> 404
    resp_status = client.get(f"/candidates/{cand1_id}/status", headers={"Authorization": f"Bearer {token2}"})
    assert resp_status.status_code == 404

    # User 2 tries to trigger extraction on User 1's candidate -> 404
    resp_extract = client.post(f"/candidates/{cand1_id}/extract", headers={"Authorization": f"Bearer {token2}"})
    assert resp_extract.status_code == 404

    # User 2 tries to trigger embedding on User 1's candidate -> 404
    resp_embed = client.post(f"/candidates/{cand1_id}/embed", headers={"Authorization": f"Bearer {token2}"})
    assert resp_embed.status_code == 404

    # User 2 tries to score User 1's candidate under User 2's job -> 404
    resp_score = client.post(f"/jobs/{job2_id}/score-candidate/{cand1_id}", headers={"Authorization": f"Bearer {token2}"})
    assert resp_score.status_code == 404

    # Legitimate owner User 1 CAN access
    resp_owner = client.get(f"/candidates/{cand1_id}", headers={"Authorization": f"Bearer {token1}"})
    assert resp_owner.status_code == 200
    assert resp_owner.json()["id"] == cand1_id


# ── 4. STRICT SCHEMA VALIDATION (ConfigDict extra='forbid') ───────────────────

def test_extra_fields_forbidden_in_request_models():
    # Extra field in signup request
    resp = client.post("/auth/signup", json={
        "email": "injected@example.com",
        "password": "Password123!",
        "company_name": "Test",
        "is_admin": True  # Injected extra field
    })
    assert resp.status_code == 422
    assert "extra_forbidden" in str(resp.json())

    # Extra field in job creation request
    _, token = create_test_user("jobposter@example.com")
    resp_job = client.post("/jobs", headers={"Authorization": f"Bearer {token}"}, json={
        "title": "Backend Engineer",
        "description": "Python, FastAPI",
        "required_skills": ["Python"],
        "unrecognized_field": "exploit"
    })
    assert resp_job.status_code == 422
    assert "extra_forbidden" in str(resp_job.json())


# ── 5. TEAM MANAGEMENT ROLE AUTHORIZATION ────────────────────────────────────

def test_team_invite_role_authorization():
    viewer, viewer_token = create_test_user("viewer@example.com", role="viewer")
    recruiter, recruiter_token = create_test_user("admin_recruiter@example.com", role="recruiter")

    unique_email1 = f"invitee1_{uuid.uuid4().hex[:6]}@example.com"
    unique_email2 = f"invitee2_{uuid.uuid4().hex[:6]}@example.com"

    # Viewer cannot invite
    resp_viewer = client.post("/settings/team/invite", headers={"Authorization": f"Bearer {viewer_token}"}, json={
        "email": unique_email1,
        "role": "Recruiter"
    })
    assert resp_viewer.status_code == 403

    # Recruiter can invite
    resp_recruiter = client.post("/settings/team/invite", headers={"Authorization": f"Bearer {recruiter_token}"}, json={
        "email": unique_email2,
        "role": "Recruiter"
    })
    assert resp_recruiter.status_code == 200
    assert resp_recruiter.json()["email"] == unique_email2


# ── 6. EMAIL HTML ESCAPING & ANTI-XSS ────────────────────────────────────────

def test_email_html_escaping():
    malicious_name = "<script>alert('XSS')</script>"
    malicious_workspace = "<b>Hacked Workspace</b>"
    malicious_message = '<img src=x onerror="fetch(\'http://attacker.com\')"/>'

    from unittest.mock import patch
    with patch("app.services.email._cfg") as mock_cfg, patch("app.services.email._send_smtp") as mock_smtp:
        def cfg_side_effect(k, default=""):
            if k == "SMTP_USER": return "mock_user"
            if k == "SMTP_PASSWORD": return "mock_pass"
            return default
        mock_cfg.side_effect = cfg_side_effect
        mock_smtp.return_value = (True, None)

        # 1. Team invite email HTML escaping
        sent, err = send_team_invite_email(
            to_email="test@example.com",
            to_name=malicious_name,
            invite_url="http://localhost:5173/accept?token=123",
            workspace_name=malicious_workspace,
            inviter_email="admin@example.com",
            role="Admin"
        )
        assert mock_smtp.called
        call_args = mock_smtp.call_args[1]
        html_content = call_args["html"]
        assert "<script>" not in html_content
        assert "&lt;script&gt;alert(&#x27;XSS&#x27;)&lt;/script&gt;" in html_content
        assert "&lt;b&gt;Hacked Workspace&lt;/b&gt;" in html_content

        # 2. Candidate invite email HTML escaping
        mock_smtp.reset_mock()
        sent, err = send_candidate_invite_email(
            to_email="candidate@example.com",
            candidate_name=malicious_name,
            job_title="Software Engineer",
            company_name=malicious_workspace,
            recruiter_email="recruiter@example.com",
            message=malicious_message,
            stage="interview"
        )
        assert mock_smtp.called
        call_args2 = mock_smtp.call_args[1]
        html_content2 = call_args2["html"]
        assert '<img src=x' not in html_content2
        assert '&lt;img src=x onerror=&quot;fetch(' in html_content2


# ── 7. SECURITY HEADERS MIDDLEWARE ───────────────────────────────────────────

def test_security_headers_middleware():
    resp = client.get("/health")
    assert resp.status_code == 200
    headers = resp.headers

    assert headers.get("X-Content-Type-Options") == "nosniff"
    assert headers.get("X-Frame-Options") == "DENY"
    assert headers.get("X-XSS-Protection") == "1; mode=block"
    assert headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
    assert "Content-Security-Policy" in headers
    assert "default-src 'self'" in headers["Content-Security-Policy"]


# ── 8. INTERNAL API PROTECTION ───────────────────────────────────────────────

def test_internal_cleanup_protection():
    # Configure internal secret in settings
    original_secret = settings.INTERNAL_API_SECRET
    try:
        settings.INTERNAL_API_SECRET = "super-secret-cluster-key-999"

        # Request without header fails with 401
        resp_no_secret = client.post("/internal/cleanup")
        assert resp_no_secret.status_code == 401

        # Request with incorrect header fails with 401
        resp_bad_secret = client.post("/internal/cleanup", headers={"X-Internal-Secret": "wrong-secret"})
        assert resp_bad_secret.status_code == 401

        # Request with correct header succeeds
        resp_correct = client.post("/internal/cleanup", headers={"X-Internal-Secret": "super-secret-cluster-key-999"})
        assert resp_correct.status_code == 200
        assert resp_correct.json()["status"] == "ok"
    finally:
        settings.INTERNAL_API_SECRET = original_secret
