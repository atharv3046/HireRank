"""
Phase 3 Ownership Transfer Test Suite
=====================================
Asserts that claiming a guest screening session:
  1. Flips recruiter_id on JobPosting to the new user.
  2. Does NOT re-run scoring or NLP pipeline.
  3. Leaves candidate and match_score database rows byte-for-byte / field-for-field unchanged.
"""

import io
import uuid
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal
from app.models.job_posting import JobPosting
from app.models.candidate import Candidate
from app.models.match_score import MatchScore
from app.routers.guest import _SESSIONS, _run_guest_pipeline

client = TestClient(app)

SAMPLE_JD = """
Full Stack TypeScript & Python Engineer
Requirements:
- 3+ years experience with Python and TypeScript
- Strong background in React and FastAPI
- Bachelor degree in Computer Science
"""

def create_mock_docx(name: str, email: str, skills: str) -> bytes:
    import docx
    doc = docx.Document()
    doc.add_heading(name, level=1)
    doc.add_paragraph(f"{email} | (555) 000-1111")
    doc.add_heading("Experience", level=2)
    doc.add_paragraph("Software Engineer (Jan 2021 - Present)")
    doc.add_paragraph(f"Developed web applications using {skills}")
    doc.add_heading("Education", level=2)
    doc.add_paragraph("B.S. in Computer Science (2017 - 2021)")
    doc.add_heading("Skills", level=2)
    doc.add_paragraph(skills)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


class TestOwnershipTransfer:

    def test_claim_session_ownership_transfer_without_rescoring(self):
        # 1. Create a guest screening batch with 2 candidate files
        cand1_docx = create_mock_docx("Alice Brown", "alice@example.com", "Python, TypeScript, React, FastAPI")
        cand2_docx = create_mock_docx("Bob Green", "bob@example.com", "Java, Spring Boot, MySQL")

        files = [
            ("files", ("alice.docx", cand1_docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")),
            ("files", ("bob.docx", cand2_docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")),
        ]

        screen_res = client.post(
            "/guest/screen",
            data={"job_description": SAMPLE_JD},
            files=files
        )
        assert screen_res.status_code == 200
        screen_data = screen_res.json()
        session_id = screen_data["session_id"]
        job_id = screen_data["job_id"]

        # Run pipeline synchronously to complete candidate scoring
        sess = _SESSIONS.get(session_id)
        assert sess is not None
        _run_guest_pipeline(session_id, job_id, sess["candidate_ids"])
        assert sess["status"] == "done"

        # 2. Capture complete pre-claim state snapshot from DB
        db = SessionLocal()
        try:
            job_before = db.query(JobPosting).filter(JobPosting.id == job_id).first()
            assert job_before is not None
            original_recruiter_id = job_before.recruiter_id

            # Snapshot candidates
            cands_before = db.query(Candidate).filter(Candidate.job_posting_id == job_id).order_by(Candidate.id).all()
            assert len(cands_before) == 2

            cand_snapshots_before = []
            for c in cands_before:
                cand_snapshots_before.append({
                    "id": c.id,
                    "job_posting_id": c.job_posting_id,
                    "resume_file_path": c.resume_file_path,
                    "name": c.name,
                    "email": c.email,
                    "phone": c.phone,
                    "experience_years": c.experience_years,
                    "education_level": c.education_level,
                    "extracted_skills": c.extracted_skills,
                    "raw_text": c.raw_text,
                    "embedding": c.embedding,
                    "needs_manual_review": c.needs_manual_review,
                    "processing_status": c.processing_status,
                    "error_message": c.error_message,
                    "created_at": c.created_at,
                })

            # Snapshot match scores
            scores_before = db.query(MatchScore).filter(MatchScore.job_posting_id == job_id).order_by(MatchScore.id).all()
            assert len(scores_before) == 2

            score_snapshots_before = []
            for ms in scores_before:
                score_snapshots_before.append({
                    "id": ms.id,
                    "candidate_id": ms.candidate_id,
                    "job_posting_id": ms.job_posting_id,
                    "overall_score": ms.overall_score,
                    "semantic_score": ms.semantic_score,
                    "skills_score": ms.skills_score,
                    "experience_score": ms.experience_score,
                    "title_score": ms.title_score,
                    "education_score": ms.education_score,
                    "tier": ms.tier,
                    "is_capped": ms.is_capped,
                    "cap_reason": ms.cap_reason,
                    "matched_skills": ms.matched_skills,
                    "missing_skills": ms.missing_skills,
                    "matched_preferred_skills": ms.matched_preferred_skills,
                    "missing_preferred_skills": ms.missing_preferred_skills,
                    "summary": ms.summary,
                    "explanation_json": ms.explanation_json,
                    "created_at": ms.created_at,
                })
        finally:
            db.close()

        # 3. Create a new registered user account
        user_email = f"recruiter_{uuid.uuid4().hex[:8]}@acme.com"
        signup_res = client.post(
            "/auth/signup",
            json={
                "email": user_email,
                "password": "StrongPassword123!",
                "company_name": "Acme Hiring Org",
                "role": "recruiter"
            }
        )
        assert signup_res.status_code == 200
        signup_data = signup_res.json()
        new_user_id = signup_data["user_id"]
        auth_token = signup_data["access_token"]
        assert new_user_id != original_recruiter_id

        # 4. Execute claim request
        claim_res = client.post(
            f"/guest/session/{session_id}/claim",
            params={"user_id": new_user_id},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert claim_res.status_code == 200
        assert claim_res.json()["claimed"] is True
        assert claim_res.json()["job_id"] == job_id

        # 5. Assert database state post-claim
        db = SessionLocal()
        try:
            job_after = db.query(JobPosting).filter(JobPosting.id == job_id).first()
            assert job_after is not None

            # ONLY recruiter_id has flipped to the new user
            assert job_after.recruiter_id == new_user_id
            assert job_after.recruiter_id != original_recruiter_id

            # Verify every candidate row is byte-for-byte / field-for-field identical
            cands_after = db.query(Candidate).filter(Candidate.job_posting_id == job_id).order_by(Candidate.id).all()
            assert len(cands_after) == len(cand_snapshots_before)

            for c_after, snap in zip(cands_after, cand_snapshots_before):
                assert c_after.id == snap["id"]
                assert c_after.job_posting_id == snap["job_posting_id"]
                assert c_after.resume_file_path == snap["resume_file_path"]
                assert c_after.name == snap["name"]
                assert c_after.email == snap["email"]
                assert c_after.phone == snap["phone"]
                assert c_after.experience_years == snap["experience_years"]
                assert c_after.education_level == snap["education_level"]
                assert c_after.extracted_skills == snap["extracted_skills"]
                assert c_after.raw_text == snap["raw_text"]
                assert c_after.embedding == snap["embedding"]
                assert c_after.needs_manual_review == snap["needs_manual_review"]
                assert c_after.processing_status == snap["processing_status"]
                assert c_after.error_message == snap["error_message"]
                assert c_after.created_at == snap["created_at"]

            # Verify every match score row is byte-for-byte / field-for-field identical
            scores_after = db.query(MatchScore).filter(MatchScore.job_posting_id == job_id).order_by(MatchScore.id).all()
            assert len(scores_after) == len(score_snapshots_before)

            for ms_after, snap in zip(scores_after, score_snapshots_before):
                assert ms_after.id == snap["id"]
                assert ms_after.candidate_id == snap["candidate_id"]
                assert ms_after.job_posting_id == snap["job_posting_id"]
                assert ms_after.overall_score == snap["overall_score"]
                assert ms_after.semantic_score == snap["semantic_score"]
                assert ms_after.skills_score == snap["skills_score"]
                assert ms_after.experience_score == snap["experience_score"]
                assert ms_after.title_score == snap["title_score"]
                assert ms_after.education_score == snap["education_score"]
                assert ms_after.tier == snap["tier"]
                assert ms_after.is_capped == snap["is_capped"]
                assert ms_after.cap_reason == snap["cap_reason"]
                assert ms_after.matched_skills == snap["matched_skills"]
                assert ms_after.missing_skills == snap["missing_skills"]
                assert ms_after.matched_preferred_skills == snap["matched_preferred_skills"]
                assert ms_after.missing_preferred_skills == snap["missing_preferred_skills"]
                assert ms_after.summary == snap["summary"]
                assert ms_after.explanation_json == snap["explanation_json"]
                assert ms_after.created_at == snap["created_at"]

        finally:
            db.close()
