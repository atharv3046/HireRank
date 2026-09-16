from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models.job_posting import JobPosting
from app.models.candidate import Candidate
from app.schemas.job_posting import JobPostingCreate, JobPostingUpdate, JobPostingRead
from app.routers.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/jobs", tags=["jobs"])

@router.post("/", response_model=JobPostingRead)
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
    db.add(job)
    db.commit()
    db.refresh(job)
    return _job_to_read(job, db)

@router.get("/", response_model=List[JobPostingRead])
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
    if req.status is not None: job.status = req.status
    db.commit()
    db.refresh(job)
    return _job_to_read(job, db)

@router.delete("/{job_id}")
def delete_job(job_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    job = db.query(JobPosting).filter(JobPosting.id == job_id, JobPosting.recruiter_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    db.delete(job)
    db.commit()
    return {"message": "Job deleted"}

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
        status=job.status,
        created_at=job.created_at,
        candidate_count=count
    )
