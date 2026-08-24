from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
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
def rerank_all(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    job = db.query(JobPosting).filter(JobPosting.id == job_id, JobPosting.recruiter_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    candidates = db.query(Candidate).filter(
        Candidate.job_posting_id == job_id,
        Candidate.processing_status.in_(["done", "embedded", "extracted_fields"])
    ).all()
    
    scorer = get_scorer()
    scored = 0
    for c in candidates:
        try:
            scorer.calculate_overall_score(c.id, job_id, db)
            scored += 1
        except Exception as e:
            pass
    
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
    
    # Join candidates with match scores
    query = db.query(Candidate, MatchScore).outerjoin(
        MatchScore, (MatchScore.candidate_id == Candidate.id) & (MatchScore.job_posting_id == job_id)
    ).filter(Candidate.job_posting_id == job_id)
    
    results = query.all()
    
    candidates_with_scores = []
    for candidate, score in results:
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
            "processing_status": candidate.processing_status,
            "error_message": candidate.error_message,
            "created_at": candidate.created_at,
            "overall_score": score.overall_score if score else None,
            "semantic_score": score.semantic_score if score else None,
            "skills_score": score.skills_score if score else None,
            "experience_score": score.experience_score if score else None,
            "education_score": score.education_score if score else None,
            "matched_skills": score.matched_skills if score else [],
            "missing_skills": score.missing_skills if score else [],
            "summary": score.summary if score else None,
        }
        
        if min_score is not None and (data["overall_score"] is None or data["overall_score"] < min_score):
            continue
        if min_experience is not None and (data["experience_years"] is None or data["experience_years"] < min_experience):
            continue
        
        candidates_with_scores.append(data)
    
    # Sort
    if sort_by == "overall_score":
        candidates_with_scores.sort(key=lambda x: x["overall_score"] or 0, reverse=True)
    elif sort_by == "experience_years":
        candidates_with_scores.sort(key=lambda x: x["experience_years"] or 0, reverse=True)
    elif sort_by == "skills_score":
        candidates_with_scores.sort(key=lambda x: x["skills_score"] or 0, reverse=True)
    
    return candidates_with_scores
