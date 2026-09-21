"""
Guest Data Retention Policy Test Suite
======================================
Verifies:
  1. test_guest_session_created_with_24h_ttl: GuestSession row has expires_at set to created_at + 24 hours.
  2. test_raw_resume_discarded_immediately_after_parsing: Raw uploaded resume bytes are deleted immediately after text extraction.
  3. test_guest_session_expires_after_ttl: Expired guest session and cascaded Job/Candidate/Score/disk files are hard-deleted.
  4. test_claimed_session_survives_cleanup: Claimed session survives cleanup sweeps even past the original TTL.
  5. test_claim_clears_expiry_atomically: Claim atomically sets claimed_by_org_id and nulls expires_at in single transaction.
  6. test_internal_cleanup_endpoint: POST /internal/cleanup triggers retention sweep and reports deleted counts.
"""

import io
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal
from app.models.user import User
from app.models.job_posting import JobPosting
from app.models.candidate import Candidate
from app.models.match_score import MatchScore
from app.models.guest_session import GuestSession
from app.services.cleanup import cleanup_expired_guest_sessions
from app.routers.guest import _run_guest_pipeline, _SESSIONS
from app.core.security import create_access_token

client = TestClient(app)

SAMPLE_JD = """
Staff Software Engineer - Python & Distributed Systems
We are seeking a seasoned backend engineer to architect and build our high-scale data services.
Requirements:
- 5+ years building backend services in Python
- Hands-on experience with FastAPI, Docker, and PostgreSQL
- Bachelor's degree in Computer Science or related STEM field
"""

def create_mock_docx(name: str, email: str, skills: str) -> bytes:
    import docx
    doc = docx.Document()
    doc.add_heading(name, level=1)
    doc.add_paragraph(f"{email} | (555) 019-2834")
    doc.add_heading("Experience", level=2)
    doc.add_paragraph("Senior Python Developer (Jan 2019 - Present)")
    doc.add_paragraph(f"Built scalable distributed microservices with {skills}.")
    doc.add_heading("Education", level=2)
    doc.add_paragraph("B.S. in Computer Science (2015 - 2019)")
    doc.add_heading("Skills", level=2)
    doc.add_paragraph(skills)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


class TestGuestRetention:

    def test_guest_session_created_with_24h_ttl(self):
        """When a guest starts screening, a GuestSession is persisted with 24-hour TTL."""
        cand_docx = create_mock_docx("Charlie Brown", "charlie@test.com", "Python, FastAPI, Docker")
        files = [("files", ("charlie.docx", cand_docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))]

        res = client.post("/guest/screen", data={"job_description": SAMPLE_JD}, files=files)
        assert res.status_code == 200
        data = res.json()
        session_id = data["session_id"]
        job_id = data["job_id"]

        db = SessionLocal()
        try:
            sess_record = db.query(GuestSession).filter(GuestSession.id == session_id).first()
            assert sess_record is not None
            assert sess_record.job_id == job_id
            assert sess_record.claimed_by_org_id is None
            assert sess_record.expires_at is not None

            # Verify TTL is ~24 hours from creation
            expected_expiry = sess_record.created_at + timedelta(hours=24)
            # Allow up to 10 seconds difference due to server clock
            delta = abs((sess_record.expires_at - expected_expiry).total_seconds())
            assert delta < 10
        finally:
            db.close()

    def test_raw_resume_discarded_immediately_after_parsing(self):
        """Raw uploaded resume bytes are deleted immediately after text extraction succeeds."""
        cand_docx = create_mock_docx("Dana Scully", "dana@fbi.gov", "Python, FastAPI, PostgreSQL, Git")
        files = [("files", ("dana.docx", cand_docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))]

        res = client.post("/guest/screen", data={"job_description": SAMPLE_JD}, files=files)
        assert res.status_code == 200
        session_id = res.json()["session_id"]
        job_id = res.json()["job_id"]

        db = SessionLocal()
        try:
            cand = db.query(Candidate).filter(Candidate.job_posting_id == job_id).first()
            assert cand is not None

            # Candidate has extracted text and entities from background pipeline executed by TestClient
            assert cand.raw_text is not None and len(cand.raw_text) > 0
            assert cand.processing_status == "done"

            # Crucial: resume_file_path is cleared and no lingering file on disk
            assert cand.resume_file_path is None

            # Guest folder is cleaned
            sess_dir = Path("uploads/guest") / session_id
            assert not sess_dir.exists()
        finally:
            db.close()

    def test_guest_session_expires_after_ttl(self):
        """Expired guest session is hard-deleted along with Job, Candidates, MatchScores, and disk files."""
        cand_docx = create_mock_docx("Fox Mulder", "fox@fbi.gov", "Python, Linux, Redis")
        files = [("files", ("fox.docx", cand_docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))]

        res = client.post("/guest/screen", data={"job_description": SAMPLE_JD}, files=files)
        assert res.status_code == 200
        session_id = res.json()["session_id"]
        job_id = res.json()["job_id"]

        db = SessionLocal()
        try:
            cand = db.query(Candidate).filter(Candidate.job_posting_id == job_id).first()

            # Verify rows exist before expiry
            assert db.query(GuestSession).filter(GuestSession.id == session_id).count() == 1
            assert db.query(JobPosting).filter(JobPosting.id == job_id).count() == 1
            assert db.query(Candidate).filter(Candidate.job_posting_id == job_id).count() == 1
            assert db.query(MatchScore).filter(MatchScore.job_posting_id == job_id).count() == 1

            # Simulate passage of 25 hours (past the 24-hour TTL)
            past_time = datetime.now(timezone.utc) - timedelta(hours=25)
            sess_row = db.query(GuestSession).filter(GuestSession.id == session_id).first()
            sess_row.expires_at = past_time
            db.commit()

            # Run cleanup service
            summary = cleanup_expired_guest_sessions(db, current_time=datetime.now(timezone.utc))
            assert summary["expired_sessions_deleted"] >= 1
            assert summary["jobs_deleted"] >= 1
            assert summary["candidates_deleted"] >= 1
            assert summary["scores_deleted"] >= 1

            # Assert database rows are completely gone (hard-deleted)
            assert db.query(GuestSession).filter(GuestSession.id == session_id).first() is None
            assert db.query(JobPosting).filter(JobPosting.id == job_id).first() is None
            assert db.query(Candidate).filter(Candidate.job_posting_id == job_id).count() == 0
            assert db.query(MatchScore).filter(MatchScore.job_posting_id == job_id).count() == 0

            # Assert API queries now return 404
            status_res = client.get(f"/guest/session/{session_id}/status")
            assert status_res.status_code == 404

            results_res = client.get(f"/guest/session/{session_id}/results")
            assert results_res.status_code == 404
        finally:
            db.close()

    def test_claimed_session_survives_cleanup(self):
        """A claimed session has expires_at=None, claimed_by_org_id set, and survives cleanup sweeps."""
        cand_docx = create_mock_docx("Walter Skinner", "skinner@fbi.gov", "Python, Management, Security")
        files = [("files", ("skinner.docx", cand_docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))]

        res = client.post("/guest/screen", data={"job_description": SAMPLE_JD}, files=files)
        assert res.status_code == 200
        session_id = res.json()["session_id"]
        job_id = res.json()["job_id"]

        db = SessionLocal()
        try:
            cand = db.query(Candidate).filter(Candidate.job_posting_id == job_id).first()

            # Create a registered recruiter to claim the session
            user_email = f"recruiter_{uuid.uuid4().hex[:8]}@acme.corp"
            new_user = User(email=user_email, password_hash="hash123", role="recruiter", company_name="Acme Corp")
            db.add(new_user)
            db.commit()
            db.refresh(new_user)

            token = create_access_token({"sub": str(new_user.id)})
            # Claim the session
            claim_res = client.post(
                f"/guest/session/{session_id}/claim",
                headers={"Authorization": f"Bearer {token}"}
            )
            assert claim_res.status_code == 200

            # Verify in DB: claimed_by_org_id == new_user.id, expires_at is None
            sess_row = db.query(GuestSession).filter(GuestSession.id == session_id).first()
            assert sess_row.claimed_by_org_id == new_user.id
            assert sess_row.expires_at is None

            # Simulate running cleanup far into the future (+48 hours)
            future_time = datetime.now(timezone.utc) + timedelta(hours=48)
            summary = cleanup_expired_guest_sessions(db, current_time=future_time)

            # Verify this session and its job/candidates/scores SURVIVED cleanup
            assert db.query(GuestSession).filter(GuestSession.id == session_id).first() is not None
            assert db.query(JobPosting).filter(JobPosting.id == job_id).first() is not None
            assert db.query(Candidate).filter(Candidate.job_posting_id == job_id).count() == 1
            assert db.query(MatchScore).filter(MatchScore.job_posting_id == job_id).count() == 1
        finally:
            db.close()

    def test_claim_clears_expiry_atomically(self):
        """Claim endpoint sets claimed_by_org_id and nulls expires_at in the exact same transaction."""
        cand_docx = create_mock_docx("Alex Krycek", "krycek@test.com", "Python, C++")
        files = [("files", ("krycek.docx", cand_docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))]

        res = client.post("/guest/screen", data={"job_description": SAMPLE_JD}, files=files)
        assert res.status_code == 200
        session_id = res.json()["session_id"]
        job_id = res.json()["job_id"]

        db = SessionLocal()
        try:
            cand = db.query(Candidate).filter(Candidate.job_posting_id == job_id).first()

            user_email = f"agent_{uuid.uuid4().hex[:8]}@xfiles.org"
            user = User(email=user_email, password_hash="secret", role="recruiter")
            db.add(user)
            db.commit()
            db.refresh(user)

            # Before claim: expires_at is populated, claimed_by_org_id is None
            sess_before = db.query(GuestSession).filter(GuestSession.id == session_id).first()
            assert sess_before.expires_at is not None
            assert sess_before.claimed_by_org_id is None

            token = create_access_token({"sub": str(user.id)})
            # Perform claim
            claim_res = client.post(
                f"/guest/session/{session_id}/claim",
                headers={"Authorization": f"Bearer {token}"}
            )
            assert claim_res.status_code == 200

            # Refresh test DB session identity map to see committed changes
            db.expire_all()

            # In same transaction: job ownership moved, claimed_by_org_id set, expires_at None
            sess_after = db.query(GuestSession).filter(GuestSession.id == session_id).first()
            job_after = db.query(JobPosting).filter(JobPosting.id == job_id).first()

            assert sess_after.claimed_by_org_id == user.id
            assert sess_after.expires_at is None
            assert job_after.recruiter_id == user.id
        finally:
            db.close()

    def test_internal_cleanup_endpoint(self):
        """POST /internal/cleanup triggers the retention cleaner and returns summary counts."""
        res = client.post("/internal/cleanup")
        assert res.status_code == 200
        data = res.json()
        assert "status" in data and data["status"] == "ok"
        assert "expired_sessions_deleted" in data
        assert "jobs_deleted" in data
        assert "candidates_deleted" in data
        assert "scores_deleted" in data
