from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, Query, Response
from sqlalchemy.orm import Session
from typing import List, Optional
import os, shutil, uuid, csv, io
from app.core.database import get_db, SessionLocal
from app.core.config import settings
from app.models.candidate import Candidate
from app.models.job_posting import JobPosting
from app.models.match_score import MatchScore
from app.schemas.candidate import CandidateRead, CandidateWithScore
from app.routers.auth import get_current_user
from app.models.user import User
from app.services.email import send_candidate_invite_email

router = APIRouter(tags=["candidates"])

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc"}

def _extract_text_from_file(file_path: str) -> tuple[str, str]:
    """Returns (raw_text, status). status is 'extracted' or 'needs_ocr'."""
    ext = os.path.splitext(file_path)[1].lower()
    
    if ext == ".pdf":
        try:
            import pdfplumber
            with pdfplumber.open(file_path) as pdf:
                text = "\n".join(page.extract_text() or "" for page in pdf.pages)
            if text.strip():
                return text, "extracted"
            # Try pypdf fallback
            from pypdf import PdfReader
            reader = PdfReader(file_path)
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
            if text.strip():
                return text, "extracted"
            return "", "needs_ocr"
        except Exception as e:
            return "", "error"
    
    elif ext in (".docx", ".doc"):
        try:
            from docx import Document
            doc = Document(file_path)
            text = "\n".join(para.text for para in doc.paragraphs)
            return text, "extracted"
        except Exception:
            return "", "error"
    
    return "", "error"


def _run_pipeline_in_background(candidate_id: int, job_id: int):
    """Run processing pipeline in a background thread — pipeline manages its own DB session."""
    try:
        from app.tasks.resume_tasks import process_resume_pipeline
        process_resume_pipeline(candidate_id, job_id)
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Background pipeline error for candidate {candidate_id}: {e}")


@router.post("/jobs/{job_id}/upload")
async def upload_resume(
    job_id: int,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    job = db.query(JobPosting).filter(JobPosting.id == job_id, JobPosting.recruiter_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type not supported. Allowed: {ALLOWED_EXTENSIONS}")
    
    # Save file
    file_id = str(uuid.uuid4())
    file_path = os.path.join(settings.UPLOAD_DIR, f"{file_id}{ext}")
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    
    # Extract text synchronously (fast — just PDF/DOCX parsing)
    raw_text, status = _extract_text_from_file(file_path)
    
    candidate = Candidate(
        job_posting_id=job_id,
        resume_file_path=file_path,
        raw_text=raw_text if raw_text else None,
        processing_status="processing" if (status == "extracted" and raw_text) else status
    )
    db.add(candidate)
    db.commit()
    db.refresh(candidate)
    
    # Kick off NLP + scoring in background — returns response immediately
    if status == "extracted" and raw_text:
        background_tasks.add_task(_run_pipeline_in_background, candidate.id, job_id)
    
    return {
        "candidate_id": candidate.id,
        "processing_status": candidate.processing_status,
        "filename": file.filename,
        "message": "Resume uploaded — AI processing started in background"
    }


@router.get("/candidates/{candidate_id}", response_model=CandidateRead)
def get_candidate(candidate_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return candidate

@router.get("/candidates/{candidate_id}/status")
def get_candidate_status(candidate_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Also pull the overall_score from match_scores if available
    from app.models.match_score import MatchScore
    ms = db.query(MatchScore).filter(MatchScore.candidate_id == candidate_id).first()

    return {
        "candidate_id": candidate_id,
        "processing_status": candidate.processing_status,   # frontend reads this key
        "status": candidate.processing_status,              # keep for backwards compat
        "error": candidate.error_message,
        "overall_score": ms.overall_score if ms else None,
    }


@router.get("/candidates", response_model=List[CandidateWithScore])
def list_all_candidates(
    search: Optional[str] = Query(None),
    tier: Optional[str] = Query(None),
    skill: Optional[str] = Query(None),
    job_id: Optional[int] = Query(None),
    pipeline_status: Optional[str] = Query(None),
    sort_by: str = Query("score_desc"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Cross-batch candidate query across all job postings belonging to the logged-in recruiter.
    Supports search (name, email, skills, job title), tier filter, pipeline status filter, job filter, and sorting.
    """
    jobs = db.query(JobPosting).filter(JobPosting.recruiter_id == current_user.id).all()
    job_map = {j.id: j for j in jobs}
    if not job_map:
        return []

    rows = (
        db.query(Candidate, MatchScore)
        .outerjoin(MatchScore, (MatchScore.candidate_id == Candidate.id) & (MatchScore.job_posting_id == Candidate.job_posting_id))
        .filter(Candidate.job_posting_id.in_(list(job_map.keys())))
        .all()
    )

    results = []
    for c, ms in rows:
        job = job_map.get(c.job_posting_id)
        job_title = job.title if job else f"Job #{c.job_posting_id}"

        score_val = ms.overall_score if ms else None
        t = ms.tier if (ms and ms.tier) else ("Needs Review" if c.needs_manual_review else ("Strong" if score_val and score_val >= 75 else ("Potential" if score_val and score_val >= 55 else "Low")))
        c_status = getattr(c, "pipeline_status", "Screened") or "Screened"

        item = {
            "id": c.id,
            "job_posting_id": c.job_posting_id,
            "name": c.name,
            "email": c.email,
            "phone": c.phone,
            "extracted_skills": c.extracted_skills or [],
            "experience_years": c.experience_years,
            "education_level": c.education_level,
            "education_details": c.education_details,
            "detected_title": c.detected_title,
            "needs_manual_review": c.needs_manual_review,
            "processing_status": c.processing_status,
            "pipeline_status": c_status,
            "error_message": c.error_message,
            "created_at": c.created_at,
            "overall_score": score_val,
            "semantic_score": ms.semantic_score if ms else None,
            "skills_score": ms.skills_score if ms else None,
            "experience_score": ms.experience_score if ms else None,
            "title_score": ms.title_score if ms else None,
            "education_score": ms.education_score if ms else None,
            "tier": t,
            "is_capped": ms.is_capped if ms else False,
            "cap_reason": ms.cap_reason if ms else None,
            "matched_skills": ms.matched_skills if ms else [],
            "missing_skills": ms.missing_skills if ms else [],
            "matched_preferred_skills": ms.matched_preferred_skills if ms else [],
            "missing_preferred_skills": ms.missing_preferred_skills if ms else [],
            "summary": ms.summary if ms else None,
            "explanation_json": ms.explanation_json if ms else {},
            "job_title": job_title,
        }

        # Per-job filter
        if job_id and c.job_posting_id != job_id:
            continue

        # Pipeline status filter (All, Invited, Hire, No Hire)
        if pipeline_status and pipeline_status.lower() not in ("all", "all candidates"):
            norm_filter = pipeline_status.lower().replace(" ", "").replace("_", "")
            norm_status = c_status.lower().replace(" ", "").replace("_", "")
            if norm_filter != norm_status:
                continue

        # Tier filtering
        if tier and tier.lower() != "all" and t.lower() != tier.lower():
            continue

        if skill and skill.strip():
            sq = skill.lower().strip()
            has_sk = any(sq in s.lower() for s in item["extracted_skills"]) or any(sq in s.lower() for s in item["matched_skills"])
            if not has_sk:
                continue

        if search and search.strip():
            sq = search.lower().strip()
            name_m = bool(item["name"] and sq in item["name"].lower())
            email_m = bool(item["email"] and sq in item["email"].lower())
            title_m = bool(sq in job_title.lower())
            skill_m = any(sq in s.lower() for s in item["extracted_skills"]) or any(sq in s.lower() for s in item["matched_skills"])
            if not (name_m or email_m or title_m or skill_m):
                continue

        results.append(item)

    # Sorting
    if sort_by == "score_desc":
        results.sort(key=lambda x: (x["overall_score"] is not None, x["overall_score"] or 0), reverse=True)
    elif sort_by == "score_asc":
        results.sort(key=lambda x: (x["overall_score"] is None, x["overall_score"] if x["overall_score"] is not None else 999))
    elif sort_by == "exp_desc":
        results.sort(key=lambda x: x["experience_years"] or 0, reverse=True)
    elif sort_by == "newest":
        results.sort(key=lambda x: x["created_at"], reverse=True)

    return results


@router.post("/candidates/export")
def export_candidates_csv(
    candidate_ids: Optional[List[int]] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Export selected or all candidates for the recruiter to CSV.
    """
    jobs = db.query(JobPosting).filter(JobPosting.recruiter_id == current_user.id).all()
    job_map = {j.id: j for j in jobs}
    if not job_map:
        raise HTTPException(status_code=400, detail="No job postings found")

    query = (
        db.query(Candidate, MatchScore)
        .outerjoin(MatchScore, (MatchScore.candidate_id == Candidate.id) & (MatchScore.job_posting_id == Candidate.job_posting_id))
        .filter(Candidate.job_posting_id.in_(list(job_map.keys())))
    )
    if candidate_ids:
        query = query.filter(Candidate.id.in_(candidate_ids))

    rows = query.all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Candidate ID", "Batch Title", "Name", "Email", "Phone", "Detected Title",
        "Experience (Years)", "Education Level", "Overall Score", "Tier",
        "Semantic Score", "Skills Score", "Experience Score", "Title Score", "Education Score",
        "Matched Skills", "Missing Skills", "Is Capped", "Cap Reason"
    ])

    for c, ms in rows:
        job = job_map.get(c.job_posting_id)
        job_title = job.title if job else "N/A"
        score = ms.overall_score if ms else None
        tier = ms.tier if (ms and ms.tier) else ("Needs Review" if c.needs_manual_review else ("Strong" if score and score >= 75 else ("Potential" if score and score >= 55 else "Low")))

        writer.writerow([
            c.id,
            job_title,
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
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=hirerank_candidates.csv"}
    )


from pydantic import BaseModel

class BulkInviteRequest(BaseModel):
    candidate_ids: List[int]
    message: Optional[str] = None
    stage: Optional[str] = "assessment"

@router.post("/candidates/bulk-invite")
def bulk_invite_candidates(
    req: BulkInviteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Simulates sending interview or assessment invitations to a batch of candidates.
    Validates candidates belong to recruiter's jobs and marks them as 'Invited'.
    """
    jobs = db.query(JobPosting).filter(JobPosting.recruiter_id == current_user.id).all()
    job_ids = [j.id for j in jobs]
    
    candidates = (
        db.query(Candidate)
        .filter(Candidate.id.in_(req.candidate_ids), Candidate.job_posting_id.in_(job_ids))
        .all()
    )
    
    if not candidates:
        raise HTTPException(status_code=404, detail="No matching candidates found for this recruiter")

    # Map job titles for email content
    job_map = {j.id: j.title for j in jobs}

    emails_sent = 0
    for c in candidates:
        c.pipeline_status = "Invited"
        if c.email and "@" in c.email:
            job_title = job_map.get(c.job_posting_id, "Open Role")
            sent, _ = send_candidate_invite_email(
                to_email=c.email,
                candidate_name=c.name,
                job_title=job_title,
                company_name=current_user.company_name or "HireRank",
                recruiter_email=current_user.email,
                message=req.message,
                stage=req.stage or "assessment",
            )
            if sent:
                emails_sent += 1

    db.commit()

    invited_count = len(candidates)
    return {
        "success": True,
        "invited_count": invited_count,
        "emails_sent": emails_sent,
        "candidate_ids": [c.id for c in candidates],
        "message": f"Successfully invited {invited_count} candidate(s)" + (f" ({emails_sent} email(s) delivered)" if emails_sent > 0 else "")
    }


class UpdatePipelineStatusRequest(BaseModel):
    pipeline_status: str  # Screened / Invited / Hire / No Hire

@router.patch("/candidates/{candidate_id}/pipeline-status")
def update_candidate_pipeline_status(
    candidate_id: int,
    req: UpdatePipelineStatusRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a candidate's pipeline status (Screened, Invited, Hire, No Hire).
    """
    jobs = db.query(JobPosting).filter(JobPosting.recruiter_id == current_user.id).all()
    job_ids = [j.id for j in jobs]
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id, Candidate.job_posting_id.in_(job_ids)).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    candidate.pipeline_status = req.pipeline_status
    db.commit()
    db.refresh(candidate)
    return {
        "id": candidate.id,
        "pipeline_status": candidate.pipeline_status,
        "message": f"Status updated to {candidate.pipeline_status}"
    }


class BulkDeleteCandidatesRequest(BaseModel):
    candidate_ids: List[int]


@router.delete("/candidates/{candidate_id}")
def delete_candidate(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a candidate record, associated match score, and uploaded resume file.
    """
    jobs = db.query(JobPosting).filter(JobPosting.recruiter_id == current_user.id).all()
    job_ids = [j.id for j in jobs]
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id, Candidate.job_posting_id.in_(job_ids)).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if candidate.resume_file_path:
        try:
            p = os.path.normpath(candidate.resume_file_path)
            if os.path.exists(p):
                os.remove(p)
        except Exception:
            pass

    db.query(MatchScore).filter(MatchScore.candidate_id == candidate_id).delete(synchronize_session=False)
    db.delete(candidate)
    db.commit()

    return {"message": "Candidate deleted successfully", "candidate_id": candidate_id}


@router.post("/candidates/bulk-delete")
def bulk_delete_candidates(
    req: BulkDeleteCandidatesRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete multiple candidates and their associated resume files and match scores.
    """
    jobs = db.query(JobPosting).filter(JobPosting.recruiter_id == current_user.id).all()
    job_ids = [j.id for j in jobs]
    candidates = db.query(Candidate).filter(Candidate.id.in_(req.candidate_ids), Candidate.job_posting_id.in_(job_ids)).all()
    
    deleted_ids = []
    for cand in candidates:
        if cand.resume_file_path:
            try:
                p = os.path.normpath(cand.resume_file_path)
                if os.path.exists(p):
                    os.remove(p)
            except Exception:
                pass
        deleted_ids.append(cand.id)
    
    if deleted_ids:
        db.query(MatchScore).filter(MatchScore.candidate_id.in_(deleted_ids)).delete(synchronize_session=False)
        db.query(Candidate).filter(Candidate.id.in_(deleted_ids)).delete(synchronize_session=False)
        db.commit()

    return {"message": f"Deleted {len(deleted_ids)} candidate(s)", "deleted_ids": deleted_ids}


