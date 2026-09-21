from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import logging
from app.core.database import get_db
from app.models.candidate import Candidate
from app.models.job_posting import JobPosting
from app.models.match_score import MatchScore
from app.schemas.candidate import CandidateWithScore
from app.schemas.scoring import MatchScoreRead, RerankResponse
from app.routers.auth import get_current_user
from app.models.user import User
from app.services.scoring import get_scorer
from app.services.extraction import get_extractor
from app.services.embeddings import get_embedding_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["scoring"])


@router.post("/candidates/{candidate_id}/extract")
def trigger_extraction(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    extractor = get_extractor()
    result = extractor.extract_all(candidate_id, db)
    db.refresh(candidate)
    return {"candidate_id": candidate_id, "extracted": result, "status": candidate.processing_status}


@router.post("/candidates/{candidate_id}/embed")
def trigger_embedding(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    svc = get_embedding_service()
    svc.embed_candidate(candidate_id, db)
    db.refresh(candidate)
    return {"candidate_id": candidate_id, "embedded": True, "status": candidate.processing_status}


@router.post("/jobs/{job_id}/score-candidate/{candidate_id}")
def score_candidate(
    job_id: int,
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    job = db.query(JobPosting).filter(JobPosting.id == job_id, JobPosting.recruiter_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    scorer = get_scorer()
    result = scorer.calculate_overall_score(candidate_id, job_id, db)
    return result


@router.post("/jobs/{job_id}/rerank-all", response_model=RerankResponse)
@router.post("/jobs/{job_id}/rerank", response_model=RerankResponse)
def rerank_all(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from scoring import HybridScorer, JobCriteria, ExtractedProfile, Tier

    job = db.query(JobPosting).filter(JobPosting.id == job_id, JobPosting.recruiter_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    candidates = db.query(Candidate).filter(Candidate.job_posting_id == job_id).all()

    scorer = HybridScorer()
    job_criteria = JobCriteria(
        title=job.title,
        description=job.description,
        required_skills=job.required_skills,
        preferred_skills=getattr(job, "preferred_skills", []) or [],
        min_years=job.min_experience_years or 0.0,
        max_years=getattr(job, "max_experience_years", None),
        required_education=job.education_requirement,
        weights=getattr(job, "weights", None),
    )
    job_embedding = scorer.embedder.encode(f"{job.title}\n{job.description}")

    scored = 0
    for c in candidates:
        try:
            if c.needs_manual_review:
                score_row = db.query(MatchScore).filter(
                    MatchScore.candidate_id == c.id,
                    MatchScore.job_posting_id == job_id
                ).first()
                if not score_row:
                    score_row = MatchScore(candidate_id=c.id, job_posting_id=job_id)
                    db.add(score_row)
                score_row.overall_score = None
                score_row.tier = Tier.NEEDS_REVIEW.value
                score_row.summary = "Unable to parse — review manually"
                db.commit()
                scored += 1
                continue

            profile = ExtractedProfile(
                name=c.name or "",
                email=c.email or "",
                phone=c.phone or "",
                skills=c.extracted_skills or [],
                years_experience=c.experience_years or 0.0,
                education_level=c.education_level,
                education_details=c.education_details or "",
                detected_title=c.detected_title or "",
                raw_text=c.raw_text or ""
            )

            cand_embedding = c.embedding
            if not cand_embedding and c.raw_text:
                cand_embedding = scorer.embedder.encode(c.raw_text)
                c.embedding = cand_embedding

            breakdown = scorer.score_candidate(
                candidate=profile,
                job=job_criteria,
                candidate_embedding=cand_embedding,
                job_embedding=job_embedding,
                needs_manual_review=False
            )

            score_row = db.query(MatchScore).filter(
                MatchScore.candidate_id == c.id,
                MatchScore.job_posting_id == job_id
            ).first()
            if not score_row:
                score_row = MatchScore(candidate_id=c.id, job_posting_id=job_id)
                db.add(score_row)

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
            score_row.summary = f"Overall: {breakdown.final_score}% ({breakdown.tier.value})"

            c.processing_status = "done"
            db.commit()
            scored += 1
        except Exception as e:
            db.rollback()
            logger.warning("Error re-ranking candidate %s: %s", c.id, e)
            continue

    return RerankResponse(
        job_posting_id=job_id,
        candidates_scored=scored,
        message=f"Re-ranked {scored} candidates"
    )


@router.get("/jobs/{job_id}/candidates")
def get_ranked_candidates(
    job_id: int,
    sort_by: str = Query("overall_score", enum=["overall_score", "experience_years", "skills_score"]),
    min_score: Optional[float] = Query(None),
    min_experience: Optional[float] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    job = db.query(JobPosting).filter(JobPosting.id == job_id, JobPosting.recruiter_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    query = db.query(Candidate, MatchScore).outerjoin(
        MatchScore, (MatchScore.candidate_id == Candidate.id) & (MatchScore.job_posting_id == job_id)
    ).filter(Candidate.job_posting_id == job_id)
    
    results = query.all()
    
    candidates_with_scores = []
    for candidate, score in results:
        t = score.tier if (score and score.tier) else ("Needs Review" if candidate.needs_manual_review else _tier(score.overall_score if score else None))
        data = {
            "id": candidate.id,
            "job_posting_id": candidate.job_posting_id,
            "name": candidate.name,
            "email": candidate.email,
            "phone": candidate.phone,
            "extracted_skills": candidate.extracted_skills,
            "experience_years": candidate.experience_years,
            "education_level": candidate.education_level,
            "education_details": candidate.education_details,
            "detected_title": candidate.detected_title,
            "needs_manual_review": candidate.needs_manual_review,
            "processing_status": candidate.processing_status,
            "pipeline_status": getattr(candidate, "pipeline_status", "Screened") or "Screened",
            "error_message": candidate.error_message,
            "created_at": candidate.created_at,
            "overall_score": score.overall_score if score else None,
            "semantic_score": score.semantic_score if score else None,
            "skills_score": score.skills_score if score else None,
            "experience_score": score.experience_score if score else None,
            "title_score": score.title_score if score else None,
            "education_score": score.education_score if score else None,
            "tier": t,
            "is_capped": score.is_capped if score else False,
            "cap_reason": score.cap_reason if score else None,
            "matched_skills": score.matched_skills if score else [],
            "missing_skills": score.missing_skills if score else [],
            "matched_preferred_skills": score.matched_preferred_skills if score else [],
            "missing_preferred_skills": score.missing_preferred_skills if score else [],
            "summary": score.summary if score else None,
            "explanation_json": score.explanation_json if score else {},
            "job_title": job.title,
        }
        
        if min_score is not None and (data["overall_score"] is None or data["overall_score"] < min_score):
            continue
        if min_experience is not None and (data["experience_years"] is None or data["experience_years"] < min_experience):
            continue
        
        candidates_with_scores.append(data)
    
    if sort_by == "overall_score":
        candidates_with_scores.sort(key=lambda x: x["overall_score"] or 0, reverse=True)
    elif sort_by == "experience_years":
        candidates_with_scores.sort(key=lambda x: x["experience_years"] or 0, reverse=True)
    elif sort_by == "skills_score":
        candidates_with_scores.sort(key=lambda x: x["skills_score"] or 0, reverse=True)
    
    return candidates_with_scores


# ── Shared tier helper ──
def _tier(score) -> str:
    if score is None: return "Low"
    if score >= 75:   return "Strong"
    if score >= 55:   return "Potential"
    return "Low"


@router.get("/jobs/{job_id}/stats")
def get_job_stats(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Aggregate stats for a single batch (job posting) using compute_batch_aggregates().
    """
    from app.services.aggregates import compute_batch_aggregates

    job = db.query(JobPosting).filter(
        JobPosting.id == job_id,
        JobPosting.recruiter_id == current_user.id
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    rows = (
        db.query(Candidate, MatchScore)
        .outerjoin(MatchScore, (MatchScore.candidate_id == Candidate.id) &
                   (MatchScore.job_posting_id == job_id))
        .filter(Candidate.job_posting_id == job_id)
        .all()
    )

    candidate_items = []
    numeric_scores = []
    for c, ms in rows:
        score = ms.overall_score if ms else None
        tier = ms.tier if (ms and ms.tier) else ("Needs Review" if c.needs_manual_review else _tier(score))
        candidate_items.append({
            "score": score,
            "tier": tier,
            "needs_manual_review": c.needs_manual_review,
        })
        if score is not None:
            numeric_scores.append(score)

    agg = compute_batch_aggregates(candidate_items)

    return {
        "job_id": job_id,
        "total_processed": agg["total_processed"],
        "strong_count": agg["strong_count"],
        "potential_count": agg["potential_count"],
        "low_count": agg["low_count"],
        "needs_review_count": agg["needs_review_count"],
        "average_score": agg["average_score"],
        "top_score": round(max(numeric_scores), 1) if numeric_scores else None,
        "tier_distribution": agg["tier_distribution"],
    }


@router.get("/dashboard/summary")
def dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Top-level numbers for Screen 6 computed strictly using compute_batch_aggregates().
    All counts derived from DB — never hardcoded.
    """
    from app.services.aggregates import compute_batch_aggregates

    QUOTA_LIMIT = 60

    jobs = db.query(JobPosting).filter(JobPosting.recruiter_id == current_user.id).all()
    job_ids = [j.id for j in jobs]

    if not job_ids:
        return {
            "total_batches": 0,
            "total_candidates": 0,
            "total_strong": 0,
            "total_potential": 0,
            "total_low": 0,
            "total_needs_review": 0,
            "overall_average_score": None,
            "quota_used": 0,
            "quota_limit": QUOTA_LIMIT,
            "tier_distribution": {
                "Strong": 0,
                "Potential": 0,
                "Low": 0,
                "Needs Review": 0,
            }
        }

    rows = (
        db.query(Candidate, MatchScore)
        .outerjoin(MatchScore, (MatchScore.candidate_id == Candidate.id))
        .filter(Candidate.job_posting_id.in_(job_ids))
        .all()
    )

    candidate_items = []
    for c, ms in rows:
        score = ms.overall_score if ms else None
        tier = ms.tier if (ms and ms.tier) else ("Needs Review" if c.needs_manual_review else _tier(score))
        candidate_items.append({
            "score": score,
            "tier": tier,
            "needs_manual_review": c.needs_manual_review,
        })

    agg = compute_batch_aggregates(candidate_items)

    total_candidates = agg["total_processed"]
    strong = agg["strong_count"]
    potential = agg["potential_count"]
    qualified = strong + potential
    efficiency_pct = round((qualified / total_candidates * 100), 1) if total_candidates > 0 else 0.0

    # Group candidate real timestamps for hiring velocity chart
    from collections import defaultdict
    from datetime import datetime, timedelta

    timeline_counts = defaultdict(int)
    hourly_counts = defaultdict(int)

    for c, ms in rows:
        if c.created_at:
            date_key = c.created_at.strftime("%Y-%m-%d")
            hour_key = c.created_at.strftime("%H:00")
            timeline_counts[date_key] += 1
            hourly_counts[hour_key] += 1

    velocity_points = []
    if timeline_counts:
        sorted_dates = sorted(timeline_counts.keys())
        dates = [datetime.strptime(d, "%Y-%m-%d").date() for d in sorted_dates]
        min_d = min(dates)
        max_d = max(dates)

        # Pad to ensure at least a 7-day window for informative trajectory
        if (max_d - min_d).days < 6:
            start_d = max_d - timedelta(days=6)
        else:
            start_d = min_d

        cur_d = start_d
        while cur_d <= max_d:
            cur_str = cur_d.strftime("%Y-%m-%d")
            velocity_points.append({
                "date": cur_str,
                "count": timeline_counts.get(cur_str, 0),
            })
            cur_d += timedelta(days=1)
    else:
        today = datetime.utcnow().date()
        for i in range(6, -1, -1):
            cur_str = (today - timedelta(days=i)).strftime("%Y-%m-%d")
            velocity_points.append({"date": cur_str, "count": 0})

    hourly_points = [
        {"hour": h, "count": hourly_counts[h]}
        for h in sorted(hourly_counts.keys())
    ]

    return {
        "total_batches": len(jobs),
        "total_candidates": agg["total_processed"],
        "total_strong": agg["strong_count"],
        "total_potential": agg["potential_count"],
        "total_low": agg["low_count"],
        "total_needs_review": agg["needs_review_count"],
        "overall_average_score": agg["average_score"],
        "quota_used": agg["total_processed"],
        "quota_limit": QUOTA_LIMIT,
        "tier_distribution": agg["tier_distribution"],
        "efficiency_pct": efficiency_pct,
        "velocity": velocity_points,
        "velocity_hourly": hourly_points,
    }
