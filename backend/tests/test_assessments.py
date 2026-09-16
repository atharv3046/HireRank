import pytest
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

@pytest.fixture
def assessment_test_user():
    db = SessionLocal()
    try:
        unique_email = f"assess_test_{uuid.uuid4().hex[:8]}@hirerank.test"
        user = User(
            email=unique_email,
            password_hash=hash_password("assesspass123"),
            role="recruiter",
            company_name="NeuralTech Labs"
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create a sample job posting for import
        job = JobPosting(
            recruiter_id=user.id,
            title="Senior Full Stack Engineer",
            description="We are seeking a Senior Full Stack Engineer with 4+ years experience in React, TypeScript, Python, FastAPI, and PostgreSQL. Bachelors degree required.",
            min_experience_years=4.0,
            education_requirement="bachelors"
        )
        job.required_skills = ["React", "TypeScript", "Python", "FastAPI", "PostgreSQL"]
        db.add(job)
        db.commit()
        db.refresh(job)

        # Create 2 sample candidates for the job
        c1 = Candidate(
            job_posting_id=job.id,
            name="Alice Walker",
            email="alice@example.com",
            experience_years=5.0,
            education_level="bachelors",
            processing_status="done"
        )
        c1.extracted_skills = ["React", "TypeScript", "Python", "FastAPI"]

        c2 = Candidate(
            job_posting_id=job.id,
            name="Bob Martin",
            email="bob@example.com",
            experience_years=1.5,
            education_level="high_school",
            processing_status="done"
        )
        c2.extracted_skills = ["HTML", "CSS"]

        db.add_all([c1, c2])
        db.commit()
        db.refresh(c1)
        db.refresh(c2)

        # Add match score
        ms1 = MatchScore(
            candidate_id=c1.id,
            job_posting_id=job.id,
            overall_score=85.0,
            semantic_score=82.0,
            skills_score=90.0,
            experience_score=85.0,
            education_score=80.0
        )
        ms2 = MatchScore(
            candidate_id=c2.id,
            job_posting_id=job.id,
            overall_score=35.0,
            semantic_score=40.0,
            skills_score=30.0,
            experience_score=25.0,
            education_score=20.0
        )
        db.add_all([ms1, ms2])
        db.commit()

        user_id = user.id
        job_id = job.id
        user_email = user.email
        job_title = job.title
        token = create_access_token({"sub": str(user_id)})
        return {
            "user_id": user_id,
            "user_email": user_email,
            "job_id": job_id,
            "job_title": job_title,
            "token": token,
            "auth_headers": {"Authorization": f"Bearer {token}"}
        }
    finally:
        db.close()


def test_list_importable_batches(assessment_test_user):
    headers = assessment_test_user["auth_headers"]
    res = client.get("/assessments/batches", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    batch = next((b for b in data if b["id"] == assessment_test_user["job_id"]), None)
    assert batch is not None
    assert batch["title"] == "Senior Full Stack Engineer"
    assert batch["candidate_count"] == 2
    assert "Python" in batch["required_skills"]


def test_extract_blueprint_validation(assessment_test_user):
    headers = assessment_test_user["auth_headers"]
    # Too short job description
    res = client.post("/assessments/extract-blueprint", json={"job_description": "short"}, headers=headers)
    assert res.status_code == 400
    assert "at least 20 characters" in res.json()["detail"]


def test_extract_blueprint_success(assessment_test_user):
    headers = assessment_test_user["auth_headers"]
    jd = "Role: Senior Backend Architect. Requires 5+ years experience in Python, FastAPI, Docker, and PostgreSQL. Master degree required."
    payload = {
        "job_description": jd,
        "batch_id": assessment_test_user["job_id"]
    }
    res = client.post("/assessments/extract-blueprint", json=payload, headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert "Senior Backend Architect" in data["detected_title"]
    assert data["min_experience_years"] >= 4.0
    assert "Python" in data["required_skills"]
    assert "blueprint" in data
    assert data["blueprint"]["estimated_duration_minutes"] == 45
    assert len(data["blueprint"]["categories"]) == 4

    # Check pass preview
    pass_prev = data["pass_preview"]
    assert pass_prev["total_evaluated"] == 2
    assert pass_prev["passed_count"] >= 1  # Alice passes
    assert pass_prev["pass_rate_pct"] > 0


def test_simulate_pass_rate(assessment_test_user):
    headers = assessment_test_user["auth_headers"]
    payload = {
        "required_skills": ["React", "TypeScript", "Python"],
        "min_experience_years": 3.0,
        "batch_id": assessment_test_user["job_id"]
    }
    res = client.post("/assessments/simulate-pass-rate", json=payload, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total_evaluated"] == 2
    assert data["passed_count"] == 1
    assert data["pass_rate_pct"] == 50.0


def test_create_and_list_assessment(assessment_test_user):
    headers = assessment_test_user["auth_headers"]
    payload = {
        "title": "Lead Python Platform Engineer",
        "job_description": "We need a Lead Python Platform Engineer with 6+ years experience in Python, FastAPI, Distributed Systems, and Docker.",
        "required_skills": ["Python", "FastAPI", "Docker", "System Design"],
        "min_experience_years": 6.0,
        "education_requirement": "bachelors",
        "blueprint": {
            "estimated_duration_minutes": 45,
            "difficulty_level": "Senior",
            "categories": [
                {"category": "Technical", "count": 4, "percentage": 40, "topics": ["Python", "FastAPI"]}
            ]
        }
    }

    create_res = client.post("/assessments/", json=payload, headers=headers)
    assert create_res.status_code == 200
    created = create_res.json()
    assert created["title"] == "Lead Python Platform Engineer"
    assert created["status"] == "active"
    assert "Python" in created["required_skills"]
    assert created["min_experience_years"] == 6.0

    # Test listing
    list_res = client.get("/assessments/", headers=headers)
    assert list_res.status_code == 200
    items = list_res.json()
    assert len(items) >= 1
    found = next((a for a in items if a["id"] == created["id"]), None)
    assert found is not None
    assert found["title"] == "Lead Python Platform Engineer"
