import pytest
from app.services.masking import (
    mask_email,
    mask_phone,
    mask_institution_and_grad_year,
    is_candidate_post_interview,
    apply_blind_screening_to_candidate,
)


class TestBlindScreeningUnit:
    """
    Unit tests for Blind Screening (DEI & NYC LL144 compliance) masking logic.
    """

    def test_pre_interview_candidate_masked(self):
        """
        Pre-Interview candidates (e.g., pipeline_status='Screened') must have
        name, email, phone, institution, and grad-year masked.
        """
        candidate = {
            "id": 42,
            "name": "Sarah Connor",
            "email": "sarah.connor@cyberdyne.org",
            "phone": "+1 (555) 987-6543",
            "education_level": "masters",
            "education_details": "Master of Science in Artificial Intelligence - Stanford University, 2018",
            "pipeline_status": "Screened",
            "overall_score": 88.5,
            "experience_years": 6.0,
        }

        masked = apply_blind_screening_to_candidate(candidate, index=1)

        # Name masked
        assert masked["name"] == "Candidate #1"
        assert "Sarah" not in masked["name"]

        # Email masked using standard mask_email
        assert masked["email"] == "s****@cyberdyne.org"
        assert "sarah.connor" not in masked["email"]

        # Phone masked
        assert "+1 (555) 987-6543" not in str(masked["phone"])

        # Institution and graduation year masked
        assert "Stanford" not in masked["education_details"]
        assert "2018" not in masked["education_details"]
        assert "Accredited Institution" in masked["education_details"]

        # Merit data intact
        assert masked["overall_score"] == 88.5
        assert masked["experience_years"] == 6.0
        assert masked["is_masked"] is True

    def test_post_interview_candidate_unmasked(self):
        """
        Post-Interview candidates (advanced to 'Interview', 'Offer', or 'Hire')
        must have their full identity automatically revealed.
        """
        candidate = {
            "id": 42,
            "name": "Sarah Connor",
            "email": "sarah.connor@cyberdyne.org",
            "phone": "+1 (555) 987-6543",
            "education_level": "masters",
            "education_details": "Master of Science in Artificial Intelligence - Stanford University, 2018",
            "pipeline_status": "Interview",
            "overall_score": 88.5,
            "experience_years": 6.0,
        }

        unmasked = apply_blind_screening_to_candidate(candidate, index=1)

        # Full identity preserved
        assert unmasked["name"] == "Sarah Connor"
        assert unmasked["email"] == "sarah.connor@cyberdyne.org"
        assert unmasked["phone"] == "+1 (555) 987-6543"
        assert "Stanford" in unmasked["education_details"]
        assert "2018" in unmasked["education_details"]
        assert unmasked["is_masked"] is False

    def test_pipeline_status_threshold(self):
        """
        Verify status check distinguishes pre-Interview vs post-Interview.
        """
        # Pre-interview
        assert not is_candidate_post_interview("Screened")
        assert not is_candidate_post_interview("screened")
        assert not is_candidate_post_interview(None)
        assert not is_candidate_post_interview("")

        # Post-interview (earned the right to unmask)
        assert is_candidate_post_interview("Interview")
        assert is_candidate_post_interview("interview")
        assert is_candidate_post_interview("Invited")
        assert is_candidate_post_interview("Offer")
        assert is_candidate_post_interview("Hire")
        assert is_candidate_post_interview("Hired")

    def test_mask_email_reused_from_guest(self):
        """
        Verify mask_email produces expected format.
        """
        assert mask_email("alex@company.com") == "a****@company.com"
        assert mask_email("john.doe@gmail.com") == "j****@gmail.com"
        assert mask_email(None) == "c****@***.com"

    def test_mask_institution_and_grad_year_edge_cases(self):
        """
        Verify university prestige and age proxies are stripped.
        """
        out1 = mask_institution_and_grad_year("B.S. in CS from MIT 2021", "bachelors")
        assert "MIT" not in out1
        assert "2021" not in out1
        assert "Accredited Institution" in out1

        out2 = mask_institution_and_grad_year("University of California, Berkeley - 2015", "masters")
        assert "Berkeley" not in out2
        assert "2015" not in out2
        assert "Accredited Institution" in out2


class TestBlindScreeningEndpoint:
    """
    Test that API returns masked fields when blind_screening=True for pre-Interview,
    and returns full identity for post-Interview candidates.
    """

    def test_endpoint_blind_screening_pre_and_post_interview(self):
        import uuid
        from fastapi.testclient import TestClient
        from app.main import app
        from app.core.database import SessionLocal
        from app.models.user import User
        from app.models.job_posting import JobPosting
        from app.models.candidate import Candidate
        from app.models.match_score import MatchScore
        from app.core.security import hash_password, create_access_token

        client = TestClient(app)
        db = SessionLocal()

        try:
            # 1. Setup recruiter and job
            user = User(
                email=f"recruiter_blind_{uuid.uuid4().hex[:6]}@test.com",
                password_hash=hash_password("testpass123"),
                role="recruiter"
            )
            db.add(user)
            db.commit()
            db.refresh(user)

            token = create_access_token({"sub": str(user.id)})
            headers = {"Authorization": f"Bearer {token}"}

            job = JobPosting(
                recruiter_id=user.id,
                title="Staff AI Engineer",
                description="Staff level engineer",
                min_experience_years=5.0
            )
            job.required_skills = ["Python"]
            db.add(job)
            db.commit()
            db.refresh(job)

            # Candidate A: Pre-Interview (Screened)
            cand_pre = Candidate(
                job_posting_id=job.id,
                name="Alice Wonder",
                email="alice.wonder@mit.edu",
                phone="+1 (555) 111-2222",
                education_level="masters",
                education_details="MIT Master of Science - 2019",
                pipeline_status="Screened"
            )
            cand_pre.extracted_skills = ["Python"]
            db.add(cand_pre)
            db.commit()
            db.refresh(cand_pre)

            ms_pre = MatchScore(
                candidate_id=cand_pre.id,
                job_posting_id=job.id,
                overall_score=85.0,
                tier="Strong"
            )
            db.add(ms_pre)

            # Candidate B: Post-Interview (Interview stage)
            cand_post = Candidate(
                job_posting_id=job.id,
                name="Bob Builder",
                email="bob.builder@construction.org",
                phone="+1 (555) 333-4444",
                education_level="bachelors",
                education_details="Stanford B.S. in CS - 2016",
                pipeline_status="Interview"
            )
            cand_post.extracted_skills = ["Python"]
            db.add(cand_post)
            db.commit()
            db.refresh(cand_post)

            ms_post = MatchScore(
                candidate_id=cand_post.id,
                job_posting_id=job.id,
                overall_score=80.0,
                tier="Strong"
            )
            db.add(ms_post)
            db.commit()

            # 2. Call endpoint with blind_screening=true
            resp = client.get(f"/jobs/{job.id}/candidates?blind_screening=true", headers=headers)
            assert resp.status_code == 200
            candidates = resp.json()
            assert len(candidates) == 2

            # Find candidates in response
            ret_pre = next(c for c in candidates if c["id"] == cand_pre.id)
            ret_post = next(c for c in candidates if c["id"] == cand_post.id)

            # Pre-Interview candidate must be MASKED
            assert "Alice" not in ret_pre["name"]
            assert ret_pre["name"].startswith("Candidate #")
            assert "alice.wonder" not in ret_pre["email"]
            assert ret_pre["email"] == "a****@mit.edu"
            assert ret_pre["is_masked"] is True
            assert "MIT" not in ret_pre["education_details"]
            assert "2019" not in ret_pre["education_details"]

            # Post-Interview candidate must be UNMASKED (full identity)
            assert ret_post["name"] == "Bob Builder"
            assert ret_post["email"] == "bob.builder@construction.org"
            assert ret_post["phone"] == "+1 (555) 333-4444"
            assert "Stanford" in ret_post["education_details"]
            assert ret_post["is_masked"] is False

        finally:
            db.close()

