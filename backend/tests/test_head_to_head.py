"""
backend/tests/test_head_to_head.py
==================================
Unit tests for Feature 6: Head-to-Head Comparison
Recruiter moment: "Down to a few finalists — how do I decide between them?"
"""

import pytest
from app.services.comparison import (
    calculate_skill_overlap,
    calculate_score_deltas,
    generate_head_to_head_comparison,
)


def test_skill_overlap_two_known_candidates():
    """
    Test: correct deltas and skill-set overlaps for two known candidates.
    Candidate A has: Python, FastAPI, Docker, AWS
    Candidate B has: Python, Django, Docker, Kubernetes
    """
    cand_a = {
        "id": 1,
        "name": "Alex Chen",
        "skills": ["Python", "FastAPI", "Docker", "AWS"],
    }
    cand_b = {
        "id": 2,
        "name": "Sarah Miller",
        "skills": ["python", "Django", "docker", "Kubernetes"],
    }

    overlap = calculate_skill_overlap([cand_a, cand_b])

    # Common skills should be Docker and Python
    common = sorted([s.lower() for s in overlap["common_skills"]])
    assert common == ["docker", "python"]

    # Candidate 1 unique: AWS, FastAPI
    unique_a = sorted([s.lower() for s in overlap["unique_skills"]["1"]])
    assert unique_a == ["aws", "fastapi"]

    # Candidate 2 unique: Django, Kubernetes
    unique_b = sorted([s.lower() for s in overlap["unique_skills"]["2"]])
    assert unique_b == ["django", "kubernetes"]


def test_score_deltas_two_known_candidates():
    """
    Test: correct component score deltas and templated sentences.
    "{name} scores {delta} points higher on {component}."
    """
    cand_a = {
        "id": 10,
        "name": "Jordan Lee",
        "semantic_score": 85.0,
        "skills_score": 90.0,
        "experience_score": 70.0,
        "title_score": 80.0,
        "education_score": 60.0,
    }
    cand_b = {
        "id": 20,
        "name": "Taylor Swift",
        "semantic_score": 75.0,
        "skills_score": 75.0,
        "experience_score": 85.0,
        "title_score": 80.0,
        "education_score": 60.0,
    }

    deltas = calculate_score_deltas([cand_a, cand_b])
    deltas_map = {d["component_key"]: d for d in deltas}

    # Semantic delta: Jordan Lee leads by 10.0 points
    sem = deltas_map["semantic"]
    assert sem["delta"] == 10.0
    assert sem["leader_id"] == 10
    assert sem["sentence"] == "Jordan Lee scores 10.0 points higher on Semantic Context Match."

    # Skills delta: Jordan Lee leads by 15.0 points
    skills = deltas_map["skills"]
    assert skills["delta"] == 15.0
    assert skills["leader_id"] == 10
    assert skills["sentence"] == "Jordan Lee scores 15.0 points higher on Technical Skills Match."

    # Experience delta: Taylor Swift leads by 15.0 points
    exp = deltas_map["experience"]
    assert exp["delta"] == 15.0
    assert exp["leader_id"] == 20
    assert exp["sentence"] == "Taylor Swift scores 15.0 points higher on Experience & Tenure."

    # Title: tied at 80.0
    title = deltas_map["title"]
    assert title["delta"] == 0.0
    assert "tied" in title["sentence"].lower()

    # Education: tied at 60.0
    edu = deltas_map["education"]
    assert edu["delta"] == 0.0
    assert "tied" in edu["sentence"].lower()


def test_three_candidates_comparison():
    """
    Test: comparison handles 3 finalists gracefully.
    """
    candidates = [
        {"id": 1, "name": "A", "skills": ["Python", "Go"], "semantic_score": 90.0},
        {"id": 2, "name": "B", "skills": ["Python", "Rust"], "semantic_score": 80.0},
        {"id": 3, "name": "C", "skills": ["Python", "Java"], "semantic_score": 70.0},
    ]

    res = generate_head_to_head_comparison(candidates)
    assert res["candidate_count"] == 3
    assert res["skill_overlap"]["common_skills"] == ["Python"]
    assert res["skill_overlap"]["unique_skills"]["1"] == ["Go"]
    assert res["skill_overlap"]["unique_skills"]["2"] == ["Rust"]
    assert res["skill_overlap"]["unique_skills"]["3"] == ["Java"]

    sem_delta = [d for d in res["score_deltas"] if d["component_key"] == "semantic"][0]
    assert sem_delta["leader_name"] == "A"
    assert sem_delta["delta"] == 10.0  # 90.0 - 80.0 (top minus runner up)


def test_endpoint_compare_candidates():
    """
    Integration test: POST /candidates/compare with database records.
    """
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
        user = User(
            email=f"compare_{uuid.uuid4().hex[:6]}@example.com",
            password_hash=hash_password("Password123!"),
            company_name="Compare Inc."
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        token = create_access_token({"sub": str(user.id)})
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Create a job
        job = JobPosting(
            recruiter_id=user.id,
            title="Principal Architect",
            description="Looking for a Principal Architect with cloud and distributed systems.",
            min_experience_years=8.0,
            education_requirement="bachelors"
        )
        job.required_skills = ["Python", "AWS", "Kubernetes"]
        db.add(job)
        db.commit()
        db.refresh(job)
        job_id = job.id

        # 2. Create two candidate records with MatchScores
        cand1 = Candidate(
            job_posting_id=job.id,
            name="Alice Smith",
            email="alice@techcorp.io",
            phone="+1 555-0100",
            experience_years=8.0,
            pipeline_status="Screened",
            education_level="masters",
            detected_title="Principal Architect"
        )
        cand1.extracted_skills = ["Python", "AWS", "Kubernetes", "Docker"]
        db.add(cand1)
        db.commit()
        db.refresh(cand1)
        cid1 = cand1.id

        ms1 = MatchScore(
            candidate_id=cand1.id,
            job_posting_id=job.id,
            overall_score=88.0,
            semantic_score=85.0,
            skills_score=90.0,
            experience_score=85.0,
            title_score=90.0,
            education_score=75.0,
            tier="Strong"
        )
        ms1.matched_skills = ["Python", "AWS", "Kubernetes"]
        db.add(ms1)

        cand2 = Candidate(
            job_posting_id=job.id,
            name="Bob Jones",
            email="bob@cloudfirm.org",
            phone="+1 555-0200",
            experience_years=6.0,
            pipeline_status="Screened",
            education_level="bachelors",
            detected_title="Senior Infrastructure Engineer"
        )
        cand2.extracted_skills = ["Python", "Kubernetes", "Terraform", "GCP"]
        db.add(cand2)
        db.commit()
        db.refresh(cand2)
        cid2 = cand2.id

        ms2 = MatchScore(
            candidate_id=cand2.id,
            job_posting_id=job.id,
            overall_score=78.0,
            semantic_score=75.0,
            skills_score=70.0,
            experience_score=80.0,
            title_score=75.0,
            education_score=65.0,
            tier="Potential"
        )
        ms2.matched_skills = ["Python", "Kubernetes"]
        db.add(ms2)
        db.commit()

        # 3. Test validation: must provide 2 or 3 candidates
        single_res = client.post(
            "/candidates/compare",
            json={"candidate_ids": [cid1]},
            headers=headers,
        )
        assert single_res.status_code == 400

        # 4. Compare the two candidates
        comp_res = client.post(
            "/candidates/compare",
            json={"candidate_ids": [cid1, cid2]},
            headers=headers,
        )
        assert comp_res.status_code == 200
        data = comp_res.json()

        assert data["candidate_count"] == 2
        assert len(data["candidates"]) == 2
        assert "skill_overlap" in data
        assert "score_deltas" in data
        assert len(data["score_deltas"]) == 5

        # 5. Test blind screening mode on comparison
        blind_res = client.post(
            "/candidates/compare?blind_screening=true",
            json={"candidate_ids": [cid1, cid2]},
            headers=headers,
        )
        assert blind_res.status_code == 200
        blind_data = blind_res.json()
        names = [c["name"] for c in blind_data["candidates"]]
        assert "Candidate #1" in names
        assert "Candidate #2" in names

    finally:
        db.close()
