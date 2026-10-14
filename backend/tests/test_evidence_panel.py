"""
test_evidence_panel.py
======================
Tests for Feature 3: Evidence Panel & Traceability
Verifies deterministic extraction of exact character offsets, context excerpts,
handling of special-char skills (e.g. C++, .NET), and "Not found in resume" for missing skills.
"""

import pytest
from app.services.evidence import (
    find_skill_evidence,
    find_component_evidence,
    generate_evidence_spans,
)

SAMPLE_RESUME_TEXT = """
Jane Doe
Senior Full Stack Engineer
janedoe@example.com | (555) 123-4567 | San Francisco, CA

SUMMARY
Experienced software engineer with 6+ years designing scalable cloud-native architectures,
specializing in distributed microservices, REST APIs, and modern responsive frontend applications.

EXPERIENCE
Senior Software Engineer | TechCorp Inc.
Jan 2021 – Present (3 years 2 months)
- Architected enterprise cloud microservices using Python, FastAPI, and Docker.
- Spearheaded frontend rewrite using React and TypeScript, boosting core web vitals by 45%.
- Maintained production PostgreSQL and Redis databases with 99.99% SLA uptime.

Software Engineer | StartupCo
Jun 2018 – Dec 2020 (2 years 7 months)
- Developed RESTful backend services using Node.js and C++.
- Configured CI/CD deployment pipelines on AWS infrastructure.

EDUCATION
Master of Science in Computer Science
University of California, Berkeley (2018)

Bachelor of Science in Computer Engineering
University of Illinois Urbana-Champaign (2016)

SKILLS
Python, React, TypeScript, FastAPI, Docker, PostgreSQL, Redis, Node.js, C++, AWS
"""


def test_matched_skill_exact_offsets_and_excerpt():
    """Verify that matched skill evidence contains exact offsets and matching raw_text slice."""
    ev = find_skill_evidence(SAMPLE_RESUME_TEXT, "Python")

    assert ev["status"] == "found"
    assert ev["exact_match"] == "Python"
    assert ev["start_offset"] is not None
    assert ev["end_offset"] is not None
    assert SAMPLE_RESUME_TEXT[ev["start_offset"]:ev["end_offset"]] == "Python"
    assert "FastAPI" in ev["excerpt"] or "microservices" in ev["excerpt"]


def test_matched_skill_special_chars():
    """Verify skills with symbols like C++ or aliases resolve cleanly."""
    ev = find_skill_evidence(SAMPLE_RESUME_TEXT, "C++")

    assert ev["status"] == "found"
    assert ev["exact_match"] == "C++"
    assert SAMPLE_RESUME_TEXT[ev["start_offset"]:ev["end_offset"]] == "C++"


def test_missing_skill_not_found_guarantee():
    """Verify missing skills strictly return status='not_found' and 'Not found in resume'."""
    ev = find_skill_evidence(SAMPLE_RESUME_TEXT, "Kubernetes")

    assert ev["status"] == "not_found"
    assert ev["exact_match"] is None
    assert ev["excerpt"] == "Not found in resume"
    assert ev["start_offset"] is None
    assert ev["end_offset"] is None
    assert "Not found in resume" in ev["message"]


def test_empty_resume_skill_evidence():
    """Verify empty or None resume text returns not_found without error."""
    ev_empty = find_skill_evidence("", "Python")
    assert ev_empty["status"] == "not_found"
    assert ev_empty["excerpt"] == "Not found in resume"

    ev_none = find_skill_evidence(None, "Python")
    assert ev_none["status"] == "not_found"
    assert ev_none["excerpt"] == "Not found in resume"


def test_all_five_components_evidence():
    """Verify that evidence is generated for all 5 score factors."""
    cand_profile = {
        "skills": ["Python", "React", "TypeScript", "FastAPI", "Docker"],
        "experience_years": 5.8,
        "education_level": "masters",
        "education_details": "Master of Science in Computer Science, UC Berkeley",
        "detected_title": "Senior Software Engineer",
        "roles_count": 2,
        "avg_tenure_months": 35,
    }
    job_criteria = {
        "title": "Senior Full Stack Engineer",
        "description": "Looking for a Senior Engineer with Python, React, and AWS expertise.",
        "required_skills": ["Python", "React", "Kubernetes"],
        "preferred_skills": ["AWS", "Docker"],
        "min_years": 4.0,
        "required_education": "bachelors",
    }
    score_breakdown = {
        "semantic_score": 88.5,
        "skills_score": 66.7,
        "experience_score": 100.0,
        "title_score": 90.0,
        "education_score": 100.0,
        "matched_required_skills": ["Python", "React"],
        "missing_required_skills": ["Kubernetes"],
        "is_capped": True,
        "cap_reason": "Missing must-have skill(s) [Kubernetes] capped score at 59.9%",
    }

    comp = find_component_evidence(SAMPLE_RESUME_TEXT, cand_profile, job_criteria, score_breakdown)

    assert "semantic" in comp
    assert comp["semantic"]["score"] == 88.5
    assert comp["semantic"]["start_offset"] is not None

    assert "skills" in comp
    assert comp["skills"]["matched_count"] == 2
    assert "Kubernetes" in comp["skills"]["missing_skills"]

    assert "experience" in comp
    assert comp["experience"]["years"] == 5.8
    assert "Jan 2021" in comp["experience"]["excerpt"] or "TechCorp" in comp["experience"]["excerpt"]

    assert "title" in comp
    assert comp["title"]["detected_title"] == "Senior Software Engineer"
    assert "Senior" in comp["title"]["excerpt"]

    assert "education" in comp
    assert comp["education"]["detected_level"] == "masters"


def test_generate_evidence_spans_combined():
    """Verify generate_evidence_spans aggregates skills and components cleanly."""
    cand_profile = {
        "skills": ["Python", "React"],
        "experience_years": 6.0,
        "education_level": "masters",
        "education_details": "Master of Science",
        "detected_title": "Senior Software Engineer",
        "roles_count": 2,
        "avg_tenure_months": 36,
    }
    job_criteria = {
        "title": "Full Stack Developer",
        "description": "Python React developer needed",
        "required_skills": ["Python", "React", "Rust"],
        "preferred_skills": ["Docker"],
        "min_years": 3.0,
    }
    score_breakdown = {
        "semantic_score": 85.0,
        "skills_score": 66.7,
        "experience_score": 100.0,
        "title_score": 80.0,
        "education_score": 100.0,
        "matched_required_skills": ["Python", "React"],
        "missing_required_skills": ["Rust"],
    }

    spans = generate_evidence_spans(SAMPLE_RESUME_TEXT, cand_profile, job_criteria, score_breakdown)

    assert "skills" in spans
    assert "components" in spans
    # Found skill
    assert spans["skills"]["Python"]["status"] == "found"
    assert spans["skills"]["Python"]["exact_match"] == "Python"
    # Missing skill
    assert spans["skills"]["Rust"]["status"] == "not_found"
    assert spans["skills"]["Rust"]["excerpt"] == "Not found in resume"


def test_endpoint_returns_evidence_spans():
    """Verify that GET /jobs/{job_id}/candidates returns explanation_json with evidence_spans."""
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
        # Setup recruiter and job
        user = User(
            email=f"recruiter_ev_{uuid.uuid4().hex[:6]}@test.com",
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
            title="Senior Backend Engineer",
            description="Looking for Python and PostgreSQL experience",
            min_experience_years=3.0
        )
        job.required_skills = ["Python", "PostgreSQL", "Kubernetes"]
        db.add(job)
        db.commit()
        db.refresh(job)

        cand = Candidate(
            job_posting_id=job.id,
            name="Bob Martin",
            email="bob@example.com",
            raw_text=SAMPLE_RESUME_TEXT,
            experience_years=5.0,
            education_level="bachelors",
            education_details="Bachelor of Science",
            detected_title="Senior Software Engineer",
            pipeline_status="Screened"
        )
        cand.extracted_skills = ["Python", "PostgreSQL"]
        db.add(cand)
        db.commit()
        db.refresh(cand)

        ms = MatchScore(
            candidate_id=cand.id,
            job_posting_id=job.id,
            overall_score=82.0,
            semantic_score=85.0,
            skills_score=66.7,
            experience_score=100.0,
            title_score=90.0,
            education_score=100.0,
            tier="Strong",
        )
        ms.matched_skills = ["Python", "PostgreSQL"]
        ms.missing_skills = ["Kubernetes"]
        db.add(ms)
        db.commit()

        # Call GET /jobs/{job.id}/candidates
        res = client.get(f"/api/jobs/{job.id}/candidates", headers=headers)
        assert res.status_code == 200, res.text
        data = res.json()
        assert len(data) >= 1
        cand_data = next(c for c in data if c["id"] == cand.id)

        # Verify explanation_json contains evidence_spans
        assert "explanation_json" in cand_data
        expl = cand_data["explanation_json"]
        assert "evidence_spans" in expl
        ev_spans = expl["evidence_spans"]
        assert "skills" in ev_spans
        assert "components" in ev_spans

        # Verify exact matched skill and missing skill
        assert ev_spans["skills"]["Python"]["status"] == "found"
        assert ev_spans["skills"]["Python"]["exact_match"] == "Python"
        assert ev_spans["skills"]["Kubernetes"]["status"] == "not_found"
        assert ev_spans["skills"]["Kubernetes"]["excerpt"] == "Not found in resume"

        # Verify components evidence
        assert "experience" in ev_spans["components"]
        assert "education" in ev_spans["components"]
        assert "semantic" in ev_spans["components"]
        assert "title" in ev_spans["components"]

    finally:
        db.close()

