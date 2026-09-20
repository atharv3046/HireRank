"""
scoring_shared.py
=================
THE single canonical scoring implementation for HireRank.

Both _run_guest_pipeline (guest.py) and process_resume_pipeline
(resume_tasks.py) call score_and_save() from this module.

No scoring logic lives anywhere else. If you need to score a candidate
against a job, import and call score_and_save() — never duplicate this.

Scoring engine: HybridScorer from the standalone scoring/ package.
Weights and the 59.9 must-have-skill cap are defined there and applied
identically regardless of which entry point triggered the pipeline.
"""
from __future__ import annotations

import logging
from typing import Optional
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def score_and_save(candidate_id: int, job_id: int, db: Session) -> dict:
    """
    Run the full HybridScorer pipeline for one candidate against one job
    and persist the result to the match_scores table.

    Preconditions (both pipelines must satisfy before calling):
      - candidate.raw_text is populated
      - candidate.extracted_skills, experience_years, education_level,
        detected_title are populated (extraction already ran)
      - The JobPosting row exists with required_skills, description, etc.

    Returns a plain dict with the score breakdown for logging / status.
    The authoritative record is the upserted MatchScore DB row.
    """
    from scoring import HybridScorer, JobCriteria, ExtractedProfile, Tier
    from app.models.candidate import Candidate
    from app.models.job_posting import JobPosting
    from app.models.match_score import MatchScore

    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    job = db.query(JobPosting).filter(JobPosting.id == job_id).first()

    if not candidate:
        raise ValueError(f"Candidate {candidate_id} not found")
    if not job:
        raise ValueError(f"Job {job_id} not found")

    scorer = HybridScorer()

    job_criteria = JobCriteria(
        title=job.title,
        description=job.description,
        required_skills=job.required_skills or [],
        preferred_skills=getattr(job, "preferred_skills", []) or [],
        min_years=job.min_experience_years or 0.0,
        max_years=getattr(job, "max_experience_years", None),
        required_education=job.education_requirement,
        weights=getattr(job, "weights", None),
    )

    # ── Unparse-able / needs manual review ───────────────────────────────────
    if candidate.needs_manual_review or not (candidate.raw_text or "").strip():
        profile = ExtractedProfile(
            name=candidate.name or "",
            email=candidate.email or "",
            phone=candidate.phone or "",
            skills=[],
            years_experience=0.0,
            education_level=None,
            education_details="",
            detected_title="",
            raw_text="",
        )
        breakdown = scorer.score_candidate(
            candidate=profile,
            job=job_criteria,
            needs_manual_review=True,
        )
        _upsert_score_row(candidate_id, job_id, breakdown, db, manual=True)
        candidate.needs_manual_review = True
        candidate.processing_status = "needs_manual_review"
        db.commit()
        return _breakdown_dict(breakdown)

    # ── Normal scored path ───────────────────────────────────────────────────
    raw_text = candidate.raw_text or ""

    profile = ExtractedProfile(
        name=candidate.name or "",
        email=candidate.email or "",
        phone=candidate.phone or "",
        skills=candidate.extracted_skills or [],
        years_experience=candidate.experience_years or 0.0,
        education_level=candidate.education_level,
        education_details=candidate.education_details or "",
        detected_title=candidate.detected_title or "",
        raw_text=raw_text,
    )

    job_embedding = scorer.embedder.encode(f"{job.title}\n{job.description}")
    cand_embedding = scorer.embedder.encode(raw_text)
    candidate.embedding = cand_embedding

    breakdown = scorer.score_candidate(
        candidate=profile,
        job=job_criteria,
        candidate_embedding=cand_embedding,
        job_embedding=job_embedding,
        needs_manual_review=False,
    )

    _upsert_score_row(candidate_id, job_id, breakdown, db, manual=False)
    candidate.processing_status = "done"
    db.commit()

    return _breakdown_dict(breakdown)


# ── Internal helpers ──────────────────────────────────────────────────────────

def _upsert_score_row(
    candidate_id: int,
    job_id: int,
    breakdown,
    db: Session,
    *,
    manual: bool,
) -> None:
    from app.models.match_score import MatchScore
    from scoring import Tier

    score_row = db.query(MatchScore).filter(
        MatchScore.candidate_id == candidate_id,
        MatchScore.job_posting_id == job_id,
    ).first()
    if not score_row:
        score_row = MatchScore(candidate_id=candidate_id, job_posting_id=job_id)
        db.add(score_row)

    if manual:
        score_row.overall_score = None
        score_row.tier = Tier.NEEDS_REVIEW.value
        score_row.summary = "Unable to parse — review manually"
        score_row.explanation_json = (
            breakdown.to_dict() if hasattr(breakdown, "to_dict") else {}
        )
    else:
        score_row.overall_score = breakdown.final_score
        score_row.semantic_score = breakdown.semantic_score
        score_row.skills_score = breakdown.skills_score
        score_row.experience_score = breakdown.experience_score
        score_row.title_score = breakdown.title_score
        score_row.education_score = breakdown.education_score
        score_row.tier = breakdown.tier.value
        score_row.is_capped = breakdown.is_capped
        score_row.cap_reason = breakdown.cap_reason
        score_row.matched_skills = breakdown.matched_required_skills
        score_row.missing_skills = breakdown.missing_required_skills
        score_row.matched_preferred_skills = breakdown.matched_preferred_skills
        score_row.missing_preferred_skills = breakdown.missing_preferred_skills
        score_row.explanation_json = breakdown.to_dict()
        score_row.summary = (
            f"Overall: {breakdown.final_score}% ({breakdown.tier.value})"
        )


def _breakdown_dict(breakdown) -> dict:
    return {
        "final_score": getattr(breakdown, "final_score", None),
        "tier": str(getattr(breakdown, "tier", "")),
        "semantic_score": getattr(breakdown, "semantic_score", None),
        "skills_score": getattr(breakdown, "skills_score", None),
        "experience_score": getattr(breakdown, "experience_score", None),
        "title_score": getattr(breakdown, "title_score", None),
        "education_score": getattr(breakdown, "education_score", None),
        "is_capped": getattr(breakdown, "is_capped", False),
        "cap_reason": getattr(breakdown, "cap_reason", None),
    }
