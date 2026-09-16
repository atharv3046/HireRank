import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal, Base, engine
from app.models.user import User
from app.models.job_posting import JobPosting
from app.models.candidate import Candidate
from app.models.match_score import MatchScore
from app.core.security import hash_password, create_access_token
from app.services.aggregates import compute_batch_aggregates

client = TestClient(app)

@pytest.fixture(scope="module")
def setup_workspace_data():
    import uuid
    db = SessionLocal()
    try:
        # Create fresh unique test recruiter
        unique_email = f"workspace_recruiter_{uuid.uuid4().hex[:8]}@hirerank.test"
        recruiter = User(
            email=unique_email,
            password_hash=hash_password("pass1234"),
            role="recruiter",
            company_name="Acme Corp"
        )
        db.add(recruiter)
        db.commit()
        db.refresh(recruiter)

        token = create_access_token({"sub": str(recruiter.id)})

        # Create 2 test jobs
        job1 = JobPosting(
            recruiter_id=recruiter.id,
            title="Backend Lead",
            description="Leading FastAPI and Python backend services with PostgreSQL and Redis.",
            min_experience_years=4.0,
            education_requirement="bachelors",
            status="active"
        )
        job1.required_skills = ["Python", "FastAPI", "PostgreSQL"]
        job1.preferred_skills = ["Redis", "Docker"]
        db.add(job1)

        job2 = JobPosting(
            recruiter_id=recruiter.id,
            title="Frontend Specialist",
            description="Building interactive web applications in React, TypeScript, and Tailwind CSS.",
            min_experience_years=3.0,
            education_requirement="bachelors",
            status="active"
        )
        job2.required_skills = ["React", "TypeScript", "Tailwind CSS"]
        db.add(job2)
        db.commit()
        db.refresh(job1)
        db.refresh(job2)

        # Candidate 1: Strong fit on job1
        c1 = Candidate(
            job_posting_id=job1.id,
            name="Alice Johnson",
            email="alice.johnson@example.com",
            phone="+1-555-0101",
            raw_text="Alice Johnson Senior Python Engineer 5 years experience in FastAPI, PostgreSQL, Redis.",
            experience_years=5.0,
            education_level="bachelors",
            detected_title="Senior Python Engineer",
            processing_status="done"
        )
        c1.extracted_skills = ["Python", "FastAPI", "PostgreSQL", "Redis"]
        db.add(c1)
        db.flush()

        ms1 = MatchScore(
            candidate_id=c1.id,
            job_posting_id=job1.id,
            overall_score=88.5,
            semantic_score=90.0,
            skills_score=95.0,
            experience_score=100.0,
            title_score=80.0,
            education_score=100.0,
            tier="Strong",
            is_capped=False,
            summary="Strong candidate"
        )
        ms1.matched_skills = ["Python", "FastAPI", "PostgreSQL"]
        ms1.missing_skills = []
        db.add(ms1)

        # Candidate 2: Potential fit (missing 1 must-have skill, capped at 59.9)
        c2 = Candidate(
            job_posting_id=job1.id,
            name="Bob Smith",
            email="bob.smith@example.com",
            phone="+1-555-0102",
            raw_text="Bob Smith Python Developer with 4 years experience in Python and PostgreSQL.",
            experience_years=4.0,
            education_level="bachelors",
            detected_title="Python Developer",
            processing_status="done"
        )
        c2.extracted_skills = ["Python", "PostgreSQL"]
        db.add(c2)
        db.flush()

        ms2 = MatchScore(
            candidate_id=c2.id,
            job_posting_id=job1.id,
            overall_score=59.9,
            semantic_score=75.0,
            skills_score=66.7,
            experience_score=100.0,
            title_score=70.0,
            education_score=100.0,
            tier="Potential",
            is_capped=True,
            cap_reason="Missing must-have skill(s) [FastAPI] capped score at 59.9%",
            summary="Potential match: missing FastAPI"
        )
        ms2.matched_skills = ["Python", "PostgreSQL"]
        ms2.missing_skills = ["FastAPI"]
        db.add(ms2)

        # Candidate 3: Unparseable file requiring manual review
        c3 = Candidate(
            job_posting_id=job1.id,
            name=None,
            email=None,
            phone=None,
            raw_text="",
            needs_manual_review=True,
            processing_status="needs_manual_review",
            error_message="Corrupted PDF header"
        )
        db.add(c3)
        db.flush()

        ms3 = MatchScore(
            candidate_id=c3.id,
            job_posting_id=job1.id,
            overall_score=None,
            tier="Needs Review",
            summary="Unable to parse — review manually"
        )
        db.add(ms3)

        # Candidate 4: on job2
        c4 = Candidate(
            job_posting_id=job2.id,
            name="Charlie Brown",
            email="charlie@example.com",
            phone="+1-555-0103",
            raw_text="Charlie Brown Frontend Dev React TypeScript",
            experience_years=3.0,
            education_level="bachelors",
            detected_title="Frontend Dev",
            processing_status="done"
        )
        c4.extracted_skills = ["React", "TypeScript"]
        db.add(c4)
        db.flush()

        ms4 = MatchScore(
            candidate_id=c4.id,
            job_posting_id=job2.id,
            overall_score=59.9,
            tier="Potential",
            is_capped=True,
            cap_reason="Missing must-have skill(s) [Tailwind CSS] capped score at 59.9%"
        )
        ms4.matched_skills = ["React", "TypeScript"]
        ms4.missing_skills = ["Tailwind CSS"]
        db.add(ms4)

        db.commit()

        yield {
            "token": token,
            "recruiter_id": recruiter.id,
            "job1_id": job1.id,
            "job2_id": job2.id,
            "c1_id": c1.id,
            "c2_id": c2.id,
            "c3_id": c3.id,
            "c4_id": c4.id
        }
    finally:
        db.close()


def test_dashboard_summary_uses_compute_batch_aggregates(setup_workspace_data):
    """Test GET /api/dashboard/summary aligns with compute_batch_aggregates."""
    token = setup_workspace_data["token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/dashboard/summary", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert data["total_batches"] == 2
    assert data["total_candidates"] == 4
    assert data["total_strong"] == 1
    assert data["total_potential"] == 2
    assert data["total_needs_review"] == 1
    assert data["total_low"] == 0
    assert data["quota_used"] == 4
    assert data["quota_limit"] == 60

    # Average score: only computed over numeric scores (88.5, 59.9, 59.9) = 208.3 / 3 = 69.4
    assert data["overall_average_score"] == 69.4

    # Verify tier distribution dict matches
    assert data["tier_distribution"]["Strong"] == 1
    assert data["tier_distribution"]["Potential"] == 2
    assert data["tier_distribution"]["Needs Review"] == 1
    assert data["tier_distribution"]["Low"] == 0


def test_job_candidates_unblurred_roster(setup_workspace_data):
    """Test GET /api/jobs/{id}/candidates returns full unblurred information & components."""
    token = setup_workspace_data["token"]
    job1_id = setup_workspace_data["job1_id"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get(f"/jobs/{job1_id}/candidates", headers=headers)
    assert res.status_code == 200
    candidates = res.json()
    assert len(candidates) == 3

    # Alice: unblurred name, email, phone, overall_score
    alice = next(c for c in candidates if c["name"] == "Alice Johnson")
    assert alice["email"] == "alice.johnson@example.com"
    assert alice["phone"] == "+1-555-0101"
    assert alice["overall_score"] == 88.5
    assert alice["tier"] == "Strong"
    assert alice["is_capped"] is False
    assert alice["title_score"] == 80.0

    # Bob: capped at 59.9
    bob = next(c for c in candidates if c["name"] == "Bob Smith")
    assert bob["overall_score"] == 59.9
    assert bob["tier"] == "Potential"
    assert bob["is_capped"] is True
    assert "FastAPI" in bob["cap_reason"]

    # Needs review candidate
    unparseable = next(c for c in candidates if c["needs_manual_review"])
    assert unparseable["tier"] == "Needs Review"
    assert unparseable["overall_score"] is None


def test_job_rerank_all(setup_workspace_data):
    """Test POST /api/jobs/{id}/rerank re-scores candidates without re-upload."""
    token = setup_workspace_data["token"]
    job1_id = setup_workspace_data["job1_id"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post(f"/jobs/{job1_id}/rerank", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["job_posting_id"] == job1_id
    assert data["candidates_scored"] == 3


def test_job_export_csv(setup_workspace_data):
    """Test GET /api/jobs/{id}/export returns CSV with all columns."""
    token = setup_workspace_data["token"]
    job1_id = setup_workspace_data["job1_id"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get(f"/jobs/{job1_id}/export", headers=headers)
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/csv")
    csv_text = res.text
    assert "Candidate ID,Name,Email,Phone,Detected Title" in csv_text
    assert "Alice Johnson" in csv_text
    assert "Bob Smith" in csv_text
    assert "Needs Review" in csv_text


def test_cross_batch_candidates_search_and_filter(setup_workspace_data):
    """Test GET /api/candidates cross-batch query with tier and skill filtering."""
    token = setup_workspace_data["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # All candidates across batches
    res = client.get("/candidates", headers=headers)
    assert res.status_code == 200
    all_c = res.json()
    assert len(all_c) == 4

    # Filter by tier=Strong
    res_strong = client.get("/candidates?tier=Strong", headers=headers)
    assert res_strong.status_code == 200
    strong_list = res_strong.json()
    assert len(strong_list) == 1
    assert strong_list[0]["name"] == "Alice Johnson"

    # Filter by skill=React
    res_react = client.get("/candidates?skill=React", headers=headers)
    assert res_react.status_code == 200
    react_list = res_react.json()
    assert len(react_list) == 1
    assert react_list[0]["name"] == "Charlie Brown"

    # Search by text
    res_search = client.get("/candidates?search=alice", headers=headers)
    assert res_search.status_code == 200
    search_list = res_search.json()
    assert len(search_list) == 1
    assert search_list[0]["name"] == "Alice Johnson"


def test_cross_batch_export_csv(setup_workspace_data):
    """Test POST /api/candidates/export downloads cross-batch CSV."""
    token = setup_workspace_data["token"]
    c1_id = setup_workspace_data["c1_id"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post("/candidates/export", json=[c1_id], headers=headers)
    assert res.status_code == 200
    assert "Alice Johnson" in res.text
    assert "Backend Lead" in res.text
