"""
test_weight_customizer.py
=========================
Tests for Feature 5: Weight Customizer
Verifies:
  - Dynamic 5-slider weight normalization (sums to 1.0)
  - Custom weights shifting candidate composite scores and rankings
  - Live tier impact tracking (promoted/demoted candidates between Strong/Potential/Low)
  - Persistence on JobPosting and PATCH /jobs/{id}/weights endpoint behavior
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.user import User
from app.models.job_posting import JobPosting
from app.models.candidate import Candidate
from app.models.match_score import MatchScore
from app.core.security import hash_password, create_access_token


def test_custom_weights_shift_rankings():
    """Verify that shifting weights from skills to experience reverses relative ranking."""
    from scoring import HybridScorer, JobCriteria, ExtractedProfile

    scorer = HybridScorer()

    # Candidate A: 8 years experience, but only 1 skill
    cand_a = ExtractedProfile(
        name="Experienced Veteran",
        email="a@test.com",
        phone="555-0101",
        skills=["Python"],
        years_experience=8.0,
        education_level="bachelors",
        detected_title="Senior Engineer",
        raw_text="8 years experience in Python."
    )

    # Candidate B: 2 years experience, but all 3 skills
    cand_b = ExtractedProfile(
        name="Junior Polyglot",
        email="b@test.com",
        phone="555-0102",
        skills=["Python", "PostgreSQL", "Docker"],
        years_experience=2.0,
        education_level="bachelors",
        detected_title="Software Developer",
        raw_text="2 years experience in Python, PostgreSQL, Docker."
    )

    # 1. Heavy Skills Weights (50% skills, 10% exp)
    skills_heavy_criteria = JobCriteria(
        title="Full Stack Engineer",
        description="Python PostgreSQL Docker engineer",
        required_skills=["Python", "PostgreSQL", "Docker"],
        min_years=3.0,
        weights={"semantic": 0.20, "skills": 0.55, "experience": 0.10, "title": 0.10, "education": 0.05}
    )

    score_a_skills = scorer.score_candidate(cand_a, skills_heavy_criteria, needs_manual_review=False)
    score_b_skills = scorer.score_candidate(cand_b, skills_heavy_criteria, needs_manual_review=False)

    # In skills-heavy weighting, candidate B (has all skills) should beat candidate A (missing 2 skills, capped at 59.9)
    assert score_b_skills.final_score > score_a_skills.final_score

    # 2. Heavy Experience Weights (50% exp, 15% skills) with preferred skills (no hard penalty cap)
    exp_heavy_criteria = JobCriteria(
        title="Full Stack Engineer",
        description="Engineer with extensive experience",
        required_skills=["Python"],
        preferred_skills=["PostgreSQL", "Docker"],
        min_years=4.0,
        weights={"semantic": 0.15, "skills": 0.10, "experience": 0.60, "title": 0.10, "education": 0.05}
    )

    score_a_exp = scorer.score_candidate(cand_a, exp_heavy_criteria, needs_manual_review=False)
    score_b_exp = scorer.score_candidate(cand_b, exp_heavy_criteria, needs_manual_review=False)

    # Candidate A has 8 years exp (exceeds 4yr req -> 100% exp score).
    # Candidate B has 2 years exp (below 4yr req -> lower exp score).
    assert score_a_exp.experience_score > score_b_exp.experience_score
    assert score_a_exp.final_score > score_b_exp.final_score


def test_endpoint_patch_weights_and_tier_impact():
    """Verify PATCH /jobs/{id}/weights normalizes weights, recalculates, and returns tier impact."""
    import uuid

    client = TestClient(app)
    db = SessionLocal()

    try:
        user = User(
            email=f"recruiter_weights_{uuid.uuid4().hex[:6]}@test.com",
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
            title="Senior Platform Engineer",
            description="High experience role with Python and Docker",
            min_experience_years=5.0
        )
        job.required_skills = ["Python"]
        job.preferred_skills = ["Docker"]
        db.add(job)
        db.commit()
        db.refresh(job)

        # Candidate 1: High experience (8 yrs)
        cand1 = Candidate(
            job_posting_id=job.id,
            name="Senior Dev",
            email="sr@test.com",
            raw_text="8 years of experience as Senior Platform Engineer with Python.",
            experience_years=8.0,
            education_level="bachelors",
            detected_title="Senior Platform Engineer"
        )
        cand1.extracted_skills = ["Python"]
        db.add(cand1)

        # Candidate 2: Low experience (1 yr)
        cand2 = Candidate(
            job_posting_id=job.id,
            name="Junior Dev",
            email="jr@test.com",
            raw_text="1 year experience with Python and Docker.",
            experience_years=1.0,
            education_level="bachelors",
            detected_title="Junior Developer"
        )
        cand2.extracted_skills = ["Python", "Docker"]
        db.add(cand2)
        db.commit()

        # Seed initial match scores with default weights
        ms1 = MatchScore(
            candidate_id=cand1.id,
            job_posting_id=job.id,
            overall_score=72.0,
            tier="Potential"
        )
        ms1.matched_skills = ["Python"]
        db.add(ms1)

        ms2 = MatchScore(
            candidate_id=cand2.id,
            job_posting_id=job.id,
            overall_score=68.0,
            tier="Potential"
        )
        ms2.matched_skills = ["Python", "Docker"]
        db.add(ms2)
        db.commit()

        # Call PATCH /jobs/{job_id}/weights with heavy experience weighting (e.g. 50% experience)
        payload = {
            "semantic": 0.15,
            "skills": 0.15,
            "experience": 0.50,
            "title": 0.15,
            "education": 0.05,
            "rerank": True
        }
        res = client.patch(f"/api/jobs/{job.id}/weights", json=payload, headers=headers)
        assert res.status_code == 200, res.text
        data = res.json()

        assert "weights" in data
        assert round(sum(data["weights"].values()), 2) == 1.0
        assert data["weights"]["experience"] == 0.5

        assert "tier_impact" in data
        impact = data["tier_impact"]
        assert "promoted_to_strong" in impact
        assert "demoted_from_strong" in impact
        assert "tier_changes" in impact

        # Check job in database has updated weights
        db.refresh(job)
        assert job.weights is not None
        assert job.weights["experience"] == 0.5

        # Check Candidate 1 got re-scored higher due to 8 years experience
        db.refresh(ms1)
        assert ms1.overall_score > 72.0

    finally:
        db.close()
