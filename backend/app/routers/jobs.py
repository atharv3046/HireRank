from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models.job_posting import JobPosting
from app.models.candidate import Candidate
from app.schemas.job_posting import JobPostingCreate, JobPostingUpdate, JobPostingRead, JobWeightsUpdate
from app.routers.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/jobs", tags=["jobs"])

@router.post("", response_model=JobPostingRead)
@router.post("/", response_model=JobPostingRead, include_in_schema=False)
def create_job(req: JobPostingCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    job = JobPosting(
        recruiter_id=current_user.id,
        title=req.title,
        description=req.description,
        min_experience_years=req.min_experience_years,
        education_requirement=req.education_requirement,
        status=req.status
    )
    job.required_skills = req.required_skills
    if req.weights:
        job.weights = req.weights
    db.add(job)
    db.commit()
    db.refresh(job)
    return _job_to_read(job, db)

@router.get("", response_model=List[JobPostingRead])
@router.get("/", response_model=List[JobPostingRead], include_in_schema=False)
def list_jobs(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    jobs = db.query(JobPosting).filter(JobPosting.recruiter_id == current_user.id).all()
    return [_job_to_read(j, db) for j in jobs]

@router.get("/{job_id}", response_model=JobPostingRead)
def get_job(job_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    job = db.query(JobPosting).filter(JobPosting.id == job_id, JobPosting.recruiter_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return _job_to_read(job, db)

@router.put("/{job_id}", response_model=JobPostingRead)
def update_job(job_id: int, req: JobPostingUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    job = db.query(JobPosting).filter(JobPosting.id == job_id, JobPosting.recruiter_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if req.title is not None: job.title = req.title
    if req.description is not None: job.description = req.description
    if req.required_skills is not None: job.required_skills = req.required_skills
    if req.min_experience_years is not None: job.min_experience_years = req.min_experience_years
    if req.education_requirement is not None: job.education_requirement = req.education_requirement
    if req.weights is not None: job.weights = req.weights
    if req.status is not None: job.status = req.status
    db.commit()
    db.refresh(job)
    return _job_to_read(job, db)

@router.delete("/{job_id}")
def delete_job(job_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Delete a screening batch (job posting) and cascade-delete all associated
    candidates, match scores, and resume files on disk.
    """
    from app.models.match_score import MatchScore
    import os

    job = db.query(JobPosting).filter(JobPosting.id == job_id, JobPosting.recruiter_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # 1. Delete resume files for all candidates in this batch
    candidates = db.query(Candidate).filter(Candidate.job_posting_id == job_id).all()
    for cand in candidates:
        if cand.resume_file_path:
            try:
                p = os.path.normpath(cand.resume_file_path)
                if os.path.exists(p):
                    os.remove(p)
            except Exception:
                pass

    # 2. Delete match scores
    db.query(MatchScore).filter(MatchScore.job_posting_id == job_id).delete(synchronize_session=False)

    # 3. Delete candidates
    db.query(Candidate).filter(Candidate.job_posting_id == job_id).delete(synchronize_session=False)

    # 4. Delete the job posting itself
    db.delete(job)
    db.commit()

    return {"message": "Screening batch deleted", "job_id": job_id}

@router.get("/{job_id}/export")
def export_job_candidates_csv(job_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    import csv
    import io
    from fastapi.responses import Response
    from app.models.match_score import MatchScore

    job = db.query(JobPosting).filter(JobPosting.id == job_id, JobPosting.recruiter_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    rows = (
        db.query(Candidate, MatchScore)
        .outerjoin(MatchScore, (MatchScore.candidate_id == Candidate.id) & (MatchScore.job_posting_id == job_id))
        .filter(Candidate.job_posting_id == job_id)
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Candidate ID", "Name", "Email", "Phone", "Detected Title", "Experience (Years)",
        "Education Level", "Overall Score", "Tier", "Semantic Score", "Skills Score",
        "Experience Score", "Title Score", "Education Score",
        "Matched Skills", "Missing Skills", "Is Capped", "Cap Reason"
    ])

    for c, ms in rows:
        score = ms.overall_score if ms else None
        tier = ms.tier if (ms and ms.tier) else ("Needs Review" if c.needs_manual_review else ("Strong" if score and score >= 75 else ("Potential" if score and score >= 55 else "Low")))
        writer.writerow([
            c.id,
            c.name or f"Candidate #{c.id}",
            c.email or "N/A",
            c.phone or "N/A",
            c.detected_title or "N/A",
            c.experience_years if c.experience_years is not None else "N/A",
            c.education_level or "N/A",
            round(score, 1) if score is not None else "N/A",
            tier,
            round(ms.semantic_score, 1) if ms and ms.semantic_score is not None else "N/A",
            round(ms.skills_score, 1) if ms and ms.skills_score is not None else "N/A",
            round(ms.experience_score, 1) if ms and ms.experience_score is not None else "N/A",
            round(ms.title_score, 1) if ms and ms.title_score is not None else "N/A",
            round(ms.education_score, 1) if ms and ms.education_score is not None else "N/A",
            "; ".join(ms.matched_skills) if ms and ms.matched_skills else "None",
            "; ".join(ms.missing_skills) if ms and ms.missing_skills else "None",
            "Yes" if ms and ms.is_capped else "No",
            ms.cap_reason if ms and ms.cap_reason else ""
        ])

    csv_data = output.getvalue()
    safe_title = "".join(ch if ch.isalnum() else "_" for ch in job.title)
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={safe_title}_candidates.csv"}
    )

def _job_to_read(job: JobPosting, db: Session) -> JobPostingRead:
    count = db.query(Candidate).filter(Candidate.job_posting_id == job.id).count()
    return JobPostingRead(
        id=job.id,
        recruiter_id=job.recruiter_id,
        title=job.title,
        description=job.description,
        required_skills=job.required_skills,
        min_experience_years=job.min_experience_years,
        education_requirement=job.education_requirement,
        weights=job.weights,
        status=job.status,
        created_at=job.created_at,
        candidate_count=count
    )


@router.patch("/{job_id}/weights")
def update_job_weights(
    job_id: int,
    req: JobWeightsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update 5 custom scoring factor weights for a job posting.
    Normalizes weights to sum to 1.0 (100%).
    If rerank=True, recalculates match scores for all candidates on this job
    and returns a live tier migration summary.
    """
    job = db.query(JobPosting).filter(JobPosting.id == job_id, JobPosting.recruiter_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    raw_weights = {
        "semantic": max(0.0, float(req.semantic)),
        "skills": max(0.0, float(req.skills)),
        "experience": max(0.0, float(req.experience)),
        "title": max(0.0, float(req.title)),
        "education": max(0.0, float(req.education)),
    }
    total = sum(raw_weights.values())
    if total <= 0:
        raw_weights = {"semantic": 0.35, "skills": 0.30, "experience": 0.20, "title": 0.10, "education": 0.05}
        total = 1.0

    normalized_weights = {
        k: round(v / total, 4) for k, v in raw_weights.items()
    }
    # Adjust slight rounding error so sum == 1.0
    diff = round(1.0 - sum(normalized_weights.values()), 4)
    normalized_weights["semantic"] = round(normalized_weights["semantic"] + diff, 4)

    job.weights = normalized_weights
    db.commit()

    tier_impact = {
        "promoted_to_strong": 0,
        "demoted_from_strong": 0,
        "tier_changes": [],
        "candidates_affected": 0,
        "summary": "Weights updated."
    }

    if req.rerank:
        from app.models.match_score import MatchScore
        from scoring import HybridScorer, JobCriteria, ExtractedProfile, Tier

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
            weights=normalized_weights,
        )
        job_embedding = scorer.embedder.encode(f"{job.title}\n{job.description}")

        for c in candidates:
            if c.needs_manual_review:
                continue

            ms = db.query(MatchScore).filter(
                MatchScore.candidate_id == c.id,
                MatchScore.job_posting_id == job_id
            ).first()
            if not ms:
                continue

            old_tier = ms.tier
            old_score = ms.overall_score

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

            new_score = breakdown.final_score
            new_tier = breakdown.tier.value

            ms.overall_score = new_score
            ms.semantic_score = breakdown.semantic_score
            ms.skills_score = breakdown.skills_score
            ms.experience_score = breakdown.experience_score
            ms.title_score = breakdown.title_score
            ms.education_score = breakdown.education_score
            ms.tier = new_tier
            ms.is_capped = breakdown.is_capped
            ms.cap_reason = breakdown.cap_reason

            exp_dict = breakdown.to_dict()
            try:
                from app.services.evidence import generate_evidence_spans
                cand_profile = {
                    "skills": c.extracted_skills or [],
                    "experience_years": c.experience_years or 0.0,
                    "education_level": c.education_level,
                    "education_details": c.education_details or "",
                    "detected_title": c.detected_title or "",
                    "roles_count": getattr(c, "roles_count", 0) or 0,
                    "avg_tenure_months": getattr(c, "avg_tenure_months", 0) or 0,
                }
                job_crit = {
                    "title": job.title,
                    "description": job.description,
                    "required_skills": job.required_skills or [],
                    "preferred_skills": getattr(job, "preferred_skills", []) or [],
                    "min_years": job.min_experience_years or 0.0,
                    "required_education": job.education_requirement,
                }
                exp_dict["evidence_spans"] = generate_evidence_spans(
                    c.raw_text, cand_profile, job_crit, exp_dict
                )
            except Exception:
                pass

            ms.explanation_json = exp_dict
            ms.summary = f"Overall: {new_score}% ({new_tier})"

            if old_tier != new_tier:
                tier_impact["tier_changes"].append({
                    "candidate_id": c.id,
                    "name": c.name or f"Candidate #{c.id}",
                    "old_tier": old_tier,
                    "new_tier": new_tier,
                    "old_score": old_score,
                    "new_score": new_score
                })
                if new_tier == "Strong" and old_tier != "Strong":
                    tier_impact["promoted_to_strong"] += 1
                elif old_tier == "Strong" and new_tier != "Strong":
                    tier_impact["demoted_from_strong"] += 1

        db.commit()
        tier_impact["candidates_affected"] = len(tier_impact["tier_changes"])
        promo = tier_impact["promoted_to_strong"]
        demo = tier_impact["demoted_from_strong"]
        tier_impact["summary"] = (
            f"Weights updated and batch re-ranked. "
            f"{promo} candidate(s) promoted to Strong, {demo} candidate(s) shifted from Strong."
            if (promo or demo)
            else f"Weights updated. Reranked {len(candidates)} candidate(s) with 0 net tier shifts."
        )

    return {
        "job_id": job.id,
        "weights": normalized_weights,
        "tier_impact": tier_impact
    }
