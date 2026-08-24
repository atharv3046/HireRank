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
