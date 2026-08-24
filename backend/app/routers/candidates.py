from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
import os, shutil, uuid
from app.core.database import get_db, SessionLocal
from app.core.config import settings
from app.models.candidate import Candidate
from app.models.job_posting import JobPosting
from app.schemas.candidate import CandidateRead
from app.routers.auth import get_current_user
from app.models.user import User

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
    return {"candidate_id": candidate_id, "status": candidate.processing_status, "error": candidate.error_message}
