"""
backend/tests/test_templated_rejection.py
=========================================
Unit and integration tests for Feature 8: Templated Rejection Message.
Recruiter moment: "I need to reject this person without ghosting them,
but I don't have time to write a personalized email."
"""

import uuid
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal
from app.core.security import hash_password, create_access_token
from app.models.user import User
from app.models.job_posting import JobPosting
from app.models.candidate import Candidate
from app.models.match_score import MatchScore
from app.services.rejection import (
    generate_templated_rejection,
    verify_rejection_compliance,
)


def test_rejection_mentions_matched_strengths_and_missing_skills():
    """
    Test: personalized rejection acknowledging top 2 matched skills
    and constructive explanation of missing required skills.
    """
    template = generate_templated_rejection(
        candidate_name="Alex Taylor",
        job_title="Lead Data Engineer",
        company_name="CloudScale Systems",
        matched_skills=["Python", "Apache Spark", "SQL"],
        missing_required_skills=["Snowflake", "dbt"],
        candidate_experience=6.0,
        min_experience_years=5.0,
    )

    assert "Update on your application for Lead Data Engineer at CloudScale Systems" in template["subject"]
    assert "Dear Alex," in template["body"]
    # Check top matched skills
    assert "Python and Apache Spark" in template["body"]
    # Check missing required skills gap
    assert "Snowflake and dbt" in template["body"]
    assert template["gap_type"] == "missing_required_skills"
    assert template["compliance_safe"] is True
    assert "talent network" in template["body"]
    assert "Preview and edit before sending" in template["recruiter_disclaimer"]


def test_rejection_experience_gap():
    """
    Test: when candidate meets skills but has fewer years than required.
    """
    template = generate_templated_rejection(
        candidate_name="Sam Rivera",
        job_title="Senior Site Reliability Engineer",
        company_name="Vanguard Tech",
        matched_skills=["Kubernetes", "Terraform"],
        missing_required_skills=[],
        candidate_experience=3.0,
        min_experience_years=7.0,
    )

    assert template["gap_type"] == "experience_gap"
    assert "7 years" in template["body"]
    assert "Kubernetes and Terraform" in template["body"]
    assert template["compliance_safe"] is True


def test_rejection_competitive_pool():
    """
    Test: when candidate has skills and experience, but high volume of applicants.
    """
    template = generate_templated_rejection(
        candidate_name="Jordan Bell",
        job_title="Product Designer",
        company_name="DesignCraft",
        matched_skills=["Figma"],
        missing_required_skills=[],
        candidate_experience=5.0,
        min_experience_years=4.0,
    )

    assert template["gap_type"] == "competitive_pool"
    assert "high volume of qualified applications" in template["body"]
    assert "Figma" in template["body"]
    assert template["compliance_safe"] is True


def test_compliance_legal_safety_guarantee():
    """
    Test legal safety:
      - Clean templates have zero forbidden terms.
      - Compliance scanner accurately catches forbidden bias terms.
    """
    clean_template = generate_templated_rejection(
        candidate_name="Chris Doe",
        job_title="Backend Engineer",
        company_name="SafeHire",
        matched_skills=["Go", "PostgreSQL"],
        missing_required_skills=["Kafka"],
    )

    # Clean template must be 100% safe
    check = verify_rejection_compliance(clean_template["body"])
    assert check["is_safe"] is True
    assert len(check["flagged_terms"]) == 0

    # Ensure forbidden bias phrases are caught
    risky_text = "We decided not to hire you due to your graduation year and your career break."
    check_risky = verify_rejection_compliance(risky_text)
    assert check_risky["is_safe"] is False
    assert len(check_risky["flagged_terms"]) > 0


def test_rejection_endpoints_and_status_update():
    """
    Integration test:
      - GET /candidates/{id}/rejection-template
      - POST /candidates/{id}/send-rejection (marks No Hire & records sent_at)
    """
    db = SessionLocal()
    client = TestClient(app)

    try:
        unique_email = f"reject_recruiter_{uuid.uuid4().hex[:8]}@hirerank.test"
        recruiter = User(
            email=unique_email,
            password_hash=hash_password("testpass123"),
            role="recruiter",
            company_name="Atlas Innovations",
        )
        db.add(recruiter)
        db.commit()
        db.refresh(recruiter)

        token = create_access_token({"sub": str(recruiter.id)})
        headers = {"Authorization": f"Bearer {token}"}

        # Create job
        job = JobPosting(
            recruiter_id=recruiter.id,
            title="Senior DevOps Engineer",
            description="DevOps role with AWS and Kubernetes.",
            min_experience_years=5.0,
        )
        job.required_skills = ["AWS", "Kubernetes", "Terraform"]
        db.add(job)
        db.commit()
        db.refresh(job)

        # Create candidate
        candidate = Candidate(
            job_posting_id=job.id,
            name="Morgan Brooks",
            email="morgan@candidate.test",
            experience_years=4.0,
            pipeline_status="Screened",
        )
        candidate.extracted_skills = ["AWS"]
        db.add(candidate)
        db.commit()
        db.refresh(candidate)

        # Create MatchScore
        score = MatchScore(
            candidate_id=candidate.id,
            job_posting_id=job.id,
            overall_score=68.0,
            tier="Potential",
        )
        score.matched_skills = ["AWS"]
        score.missing_skills = ["Kubernetes", "Terraform"]
        db.add(score)
        db.commit()

        # 1. Fetch template
        res = client.get(f"/candidates/{candidate.id}/rejection-template", headers=headers)
        assert res.status_code == 200
        tpl_data = res.json()

        assert tpl_data["candidate_id"] == candidate.id
        assert tpl_data["job_title"] == "Senior DevOps Engineer"
        assert tpl_data["company_name"] == "Atlas Innovations"
        assert "AWS" in tpl_data["body"]
        assert "Kubernetes and Terraform" in tpl_data["body"]
        assert tpl_data["compliance_safe"] is True
        assert tpl_data["is_already_rejected"] is False

        # 2. Send rejection (updates pipeline_status to 'No Hire')
        send_res = client.post(
            f"/candidates/{candidate.id}/send-rejection",
            json={
                "subject": tpl_data["subject"],
                "body": tpl_data["body"],
                "mark_no_hire": True,
            },
            headers=headers,
        )
        assert send_res.status_code == 200
        send_data = send_res.json()

        assert send_data["success"] is True
        assert send_data["pipeline_status"] == "No Hire"
        assert send_data["rejection_sent_at"] is not None

        # Verify DB state
        db.refresh(candidate)
        assert candidate.pipeline_status == "No Hire"
        assert candidate.rejection_sent_at is not None
        assert candidate.rejection_data["subject"] == tpl_data["subject"]

    finally:
        db.close()
