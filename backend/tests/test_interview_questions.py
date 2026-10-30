"""
backend/tests/test_interview_questions.py
=========================================
Unit and integration tests for Feature 7: Generative Interview Questions with Claude API.
Recruiter moment: "What do I actually ask this person in the interview?"

Requirements verified:
  1. test_prompt_injection_flagged_candidate_never_reaches_api:
     Adversarial Gate refuses to call Claude API, returns deterministic questions with warning.
  2. test_malformed_api_response_falls_back_gracefully:
     API failure / bad JSON falls back to deterministic template questions without breaking.
  3. test_based_on_tags_render_correctly:
     All 5 questions are tagged with non-empty 'question', 'based_on', and 'listen_for'.
  4. test_rate_limit_21st_call:
     Recruiter exceeding 20 calls/hr receives HTTP 429 RateLimitExceeded.
  5. test_endpoint_and_caching:
     Full router integration verifying DB caching and regenerate flag.
"""

import pytest
from unittest.mock import MagicMock, patch
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal
from app.core.security import hash_password, create_access_token
from app.models.user import User
from app.models.job_posting import JobPosting
from app.models.candidate import Candidate
from app.models.match_score import MatchScore
from app.services.interview_prep import (
    generate_candidate_interview_questions,
    build_structured_payload,
    generate_deterministic_fallback_questions,
    check_recruiter_rate_limit,
    record_recruiter_call,
    reset_rate_limits,
    RATE_LIMIT_MAX,
)


class MockCandidate:
    def __init__(
        self,
        id=1,
        is_adversarial=False,
        experience_years=5.0,
        promotion_count=2,
        avg_tenure_months=14,
        short_tenure_flag=True,
        detected_title="Senior Backend Engineer",
        extracted_skills=None,
    ):
        self.id = id
        self.is_adversarial = is_adversarial
        self.experience_years = experience_years
        self.promotion_count = promotion_count
        self.avg_tenure_months = avg_tenure_months
        self.short_tenure_flag = short_tenure_flag
        self.detected_title = detected_title
        self.extracted_skills = extracted_skills or ["Python", "PostgreSQL", "Docker"]
        self.interview_questions = None


class MockMatchScore:
    def __init__(self):
        self.matched_skills = ["Python", "Docker"]
        self.missing_skills = ["Kubernetes", "GraphQL"]
        self.missing_preferred_skills = ["AWS"]
        self.explanation_json = {
            "evidence_spans": {
                "skills": {
                    "Python": {
                        "status": "found",
                        "excerpt": "Architected Python microservices handling 20,000 requests per minute.",
                    },
                    "Docker": {
                        "status": "found",
                        "excerpt": "Containerized multi-tier applications using Docker and Docker Compose.",
                    }
                }
            }
        }


def test_prompt_injection_flagged_candidate_never_reaches_api():
    """
    SECURITY GATE TEST:
    A candidate flagged as adversarial or containing prompt injection MUST NOT trigger
    any call to the Claude API.
    Deterministic template questions must be returned with an explicit warning banner.
    """
    reset_rate_limits()
    cand = MockCandidate(id=99, is_adversarial=True)
    ms = MockMatchScore()

    with patch("anthropic.Anthropic") as mock_anthropic:
        result = generate_candidate_interview_questions(
            candidate=cand,
            match_score=ms,
            recruiter_id=42,
            regenerate=True,
        )

        # Claude API must NEVER be initialized or called
        mock_anthropic.assert_not_called()

    assert result["is_adversarial_blocked"] is True
    assert result["source"] == "template"
    assert "Adversarial Shield" in result["warning"]
    assert len(result["questions"]) == 5
    for q in result["questions"]:
        assert q["question"]
        assert q["based_on"]
        assert q["listen_for"]


def test_malformed_api_response_falls_back_gracefully():
    """
    DETERMINISTIC FALLBACK TEST:
    When the Anthropic API returns malformed JSON, network errors, or invalid schema,
    HireRank must silently fall back to deterministic template questions.
    """
    reset_rate_limits()
    cand = MockCandidate(id=101, is_adversarial=False)
    ms = MockMatchScore()

    # Mock LLM returning garbage / non-JSON text
    mock_choice = MagicMock()
    mock_choice.message.content = "I cannot answer in JSON right now."
    mock_resp = MagicMock()
    mock_resp.choices = [mock_choice]

    with patch("app.core.config.settings.OPENAI_API_KEY", "test-key-mock"):
        with patch("openai.OpenAI") as mock_openai:
            mock_client = MagicMock()
            mock_openai.return_value = mock_client
            mock_client.chat.completions.create.return_value = mock_resp

            result = generate_candidate_interview_questions(
                candidate=cand,
                match_score=ms,
                recruiter_id=42,
                regenerate=True,
            )

    assert result["source"] == "template"
    assert result["is_adversarial_blocked"] is False
    assert len(result["questions"]) == 5
    for q in result["questions"]:
        assert len(q["question"]) > 10
        assert len(q["based_on"]) > 3
        assert len(q["listen_for"]) > 10


def test_based_on_tags_render_correctly():
    """
    TAG & EXPLAINABILITY TEST:
    Verify that every question has a clear, recruiter-facing `based_on` tag
    derived from missing skills, career trajectory (short tenure, promotions),
    and evidence spans.
    """
    cand = MockCandidate(
        id=202,
        is_adversarial=False,
        short_tenure_flag=True,
        promotion_count=3,
    )
    ms = MockMatchScore()
    ms.missing_skills = ["Kubernetes", "Cassandra"]

    structured_data = build_structured_payload(cand, ms)

    # 1. Test structured payload does not leak raw text
    assert "raw_text" not in structured_data
    assert "Kubernetes" in structured_data["missing_required_skills"]
    assert structured_data["promotion_count"] == 3
    assert structured_data["short_tenure_flag"] is True

    # 2. Test fallback generation
    questions = generate_deterministic_fallback_questions(structured_data)
    assert len(questions) == 5

    based_ons = [q["based_on"] for q in questions]

    # Must contain missing skill tag
    assert any("missing skill: Kubernetes" in b for b in based_ons)
    # Must contain short tenure tag
    assert any("short average tenure" in b for b in based_ons)
    # Must contain promotions tag
    assert any("3 promotions" in b for b in based_ons)

    for q in questions:
        assert isinstance(q["question"], str) and q["question"].strip()
        assert isinstance(q["based_on"], str) and q["based_on"].strip()
        assert isinstance(q["listen_for"], str) and q["listen_for"].strip()


def test_rate_limit_21st_call():
    """
    RATE LIMIT TEST:
    Recruiter is limited to 20 generative calls per hour.
    The 21st call in the 1-hour window must return HTTP 429.
    """
    reset_rate_limits()
    recruiter_id = 999

    # Record 20 calls
    for _ in range(RATE_LIMIT_MAX):
        check_recruiter_rate_limit(recruiter_id)
        record_recruiter_call(recruiter_id)

    # 21st call must raise HTTPException 429
    with pytest.raises(HTTPException) as excinfo:
        check_recruiter_rate_limit(recruiter_id)

    assert excinfo.value.status_code == 429
    assert "Rate limit exceeded" in excinfo.value.detail


def test_candidate_interview_questions_api_endpoint_and_caching():
    """
    FULL ENDPOINT & CACHING INTEGRATION TEST:
    Tests GET/POST /candidates/{id}/interview-questions:
      - Validates candidate authentication/authorization
      - Checks questions generation
      - Validates caching (second call returns cached without recalculating)
      - Validates regenerate query parameter
    """
    reset_rate_limits()
    db = SessionLocal()
    client = TestClient(app)

    try:
        import uuid
        unique_email = f"interview_tester_{uuid.uuid4().hex[:8]}@hirerank.test"
        recruiter = User(
            email=unique_email,
            password_hash=hash_password("testpass123"),
            role="recruiter",
            company_name="Interview Test Co",
        )
        db.add(recruiter)
        db.commit()
        db.refresh(recruiter)

        token = create_access_token({"sub": str(recruiter.id)})
        headers = {"Authorization": f"Bearer {token}"}

        # Create job
        job = JobPosting(
            recruiter_id=recruiter.id,
            title="Senior Platform Engineer",
            description="Platform engineering with Go and Kubernetes.",
            min_experience_years=5.0,
        )
        job.required_skills = ["Go", "Kubernetes", "Terraform"]
        db.add(job)
        db.commit()
        db.refresh(job)

        # Create candidate
        candidate = Candidate(
            job_posting_id=job.id,
            name="Morgan Vance",
            email="morgan@platform.io",
            experience_years=6.0,
            promotion_count=2,
            avg_tenure_months=18,
            short_tenure_flag=False,
            detected_title="Platform Engineer",
            is_adversarial=False,
        )
        candidate.extracted_skills = ["Go", "Docker", "Linux"]
        db.add(candidate)
        db.commit()
        db.refresh(candidate)

        # Create MatchScore
        score = MatchScore(
            candidate_id=candidate.id,
            job_posting_id=job.id,
            overall_score=82.0,
            tier="Strong",
        )
        score.matched_skills = ["Go"]
        score.missing_skills = ["Kubernetes", "Terraform"]
        score.explanation_json = {
            "evidence_spans": {
                "skills": {
                    "Go": {"status": "found", "excerpt": "Developed backend microservices in Go."}
                }
            }
        }
        db.add(score)
        db.commit()

        # 1. First call: generate questions
        res1 = client.get(f"/candidates/{candidate.id}/interview-questions", headers=headers)
        assert res1.status_code == 200
        data1 = res1.json()
        assert data1["candidate_id"] == candidate.id
        assert len(data1["questions"]) == 5
        assert data1["source"] in ("template", "claude")
        assert data1["is_adversarial_blocked"] is False

        # 2. Second call without regenerate: should return cached
        res2 = client.get(f"/candidates/{candidate.id}/interview-questions", headers=headers)
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["source"] == "cached"
        assert len(data2["questions"]) == 5

        # 3. Third call with regenerate=true: forces regeneration
        res3 = client.post(
            f"/candidates/{candidate.id}/interview-questions?regenerate=true",
            headers=headers
        )
        assert res3.status_code == 200
        data3 = res3.json()
        assert data3["source"] in ("template", "claude")

        # 4. Test candidate adversarial gate through endpoint
        candidate.is_adversarial = True
        db.commit()

        res_adv = client.post(
            f"/candidates/{candidate.id}/interview-questions?regenerate=true",
            headers=headers
        )
        assert res_adv.status_code == 200
        data_adv = res_adv.json()
        assert data_adv["is_adversarial_blocked"] is True
        assert "Adversarial Shield" in data_adv["warning"]

    finally:
        db.close()
