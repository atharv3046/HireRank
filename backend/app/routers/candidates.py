from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, Query, Response
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import hashlib, secrets
import os, shutil, uuid, csv, io
from app.core.database import get_db, SessionLocal
from app.core.config import settings
from app.models.candidate import Candidate
from app.models.job_posting import JobPosting
from app.models.match_score import MatchScore
from app.schemas.candidate import CandidateRead, CandidateWithScore
from app.routers.auth import get_current_user
from app.models.user import User
from app.models.assessment import Assessment
from app.models.interview import InterviewInvitation
from app.services.email import send_assessment_invitation_email

router = APIRouter(tags=["candidates"])

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc"}
MAX_PDF_PAGES = 8

def validate_file_magic_bytes(contents: bytes, filename: str) -> str:
    """
    Inspect magic bytes to verify file format matches allowed document types.
    Returns the canonical extension ('.pdf', '.docx', or '.doc').
    Raises HTTPException(422) if magic byte signature fails.
    """
    if contents.startswith(b"%PDF-"):
        return ".pdf"
    if contents.startswith(b"PK\x03\x04"):
        return ".docx"
    if contents.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"):
        return ".doc"
    raise HTTPException(
        status_code=422,
        detail=f"File '{filename}' has invalid magic byte signature. Only genuine PDF and DOCX files are allowed."
    )

def _extract_text_from_file(file_path: str) -> tuple[str, str]:
    """Returns (raw_text, status). status is 'extracted', 'needs_ocr', 'encrypted', or 'error'."""
    ext = os.path.splitext(file_path)[1].lower()
    
    if ext == ".pdf":
        try:
            import pdfplumber
            with pdfplumber.open(file_path) as pdf:
                pages_text = []
                for idx, page in enumerate(pdf.pages[:MAX_PDF_PAGES]):
                    pt = page.extract_text() or ""
                    if pt.strip():
                        pages_text.append(pt)
                text = "\n".join(pages_text)
            if text.strip():
                return text, "extracted"
            # Try pypdf fallback
            from pypdf import PdfReader
            from pypdf.errors import FileNotDecryptedError
            reader = PdfReader(file_path)
            if getattr(reader, "is_encrypted", False):
                try:
                    reader.decrypt("")
                except (Exception, FileNotDecryptedError):
                    return "", "encrypted"
            pages_text = []
            for idx, page in enumerate(reader.pages[:MAX_PDF_PAGES]):
                pt = page.extract_text() or ""
                if pt.strip():
                    pages_text.append(pt)
            text = "\n".join(pages_text)
            if text.strip():
                return text, "extracted"
            return "", "needs_ocr"
        except Exception as e:
            err_str = str(e).lower()
            if "encrypt" in err_str or "password" in err_str:
                return "", "encrypted"
            return "", "error"
    
    elif ext in (".docx", ".doc"):
        try:
            from docx import Document
            doc = Document(file_path)
            paragraphs = [para.text for para in doc.paragraphs if para.text.strip()]
            for table in doc.tables:
                for row in table.rows:
                    for cell in row.cells:
                        if cell.text.strip():
                            paragraphs.append(cell.text.strip())
            text = "\n".join(paragraphs)
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
    """
    Upload a single resume (PDF/DOCX, max 10 MB server-side) for an authenticated job.
    Enforces server-side file size and magic byte signature verification.
    """
    job = db.query(JobPosting).filter(JobPosting.id == job_id, JobPosting.recruiter_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type not supported. Allowed: {ALLOWED_EXTENSIONS}")

    MAX_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB
    contents = await file.read()
    if len(contents) > MAX_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File '{file.filename}' exceeds the 10 MB size limit ({len(contents) // (1024 * 1024)} MB uploaded)."
        )

    # Validate true file magic bytes (prevents extension spoofing)
    validated_ext = validate_file_magic_bytes(contents, file.filename or "upload")

    # Write to a temp file only for text extraction — deleted immediately after
    file_id = str(uuid.uuid4())
    file_path = os.path.join(settings.UPLOAD_DIR, f"{file_id}{validated_ext}")
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    with open(file_path, "wb") as f:
        f.write(contents)

    # Extract text synchronously (fast — just PDF/DOCX parsing)
    raw_text, status = _extract_text_from_file(file_path)

    # Adversarial Shield security scan
    from app.services.adversarial import analyze_resume_for_adversarial
    adv_scan = analyze_resume_for_adversarial(raw_text, file_path) if raw_text else {"is_flagged": False}
    is_adv = bool(adv_scan.get("is_flagged", False))

    # Delete the temp file immediately — all data we need is now in raw_text.
    # We do NOT persist resume_file_path; the file is not needed beyond this point.
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
    except Exception:
        pass  # Non-fatal: orphan will be cleaned up by the periodic cleanup job

    candidate = Candidate(
        job_posting_id=job_id,
        resume_file_path=None,  # file deleted above — not stored on disk
        raw_text=raw_text if raw_text else None,
        processing_status="needs_manual_review" if is_adv else ("processing" if (status == "extracted" and raw_text) else status),
        is_adversarial=is_adv,
    )
    if is_adv:
        candidate.adversarial_details = adv_scan
        candidate.needs_manual_review = True
        first_rule = adv_scan.get("detections", [{}])[0].get("rule", "Prompt Injection")
        candidate.error_message = (
            f"Adversarial Shield Alert: {adv_scan.get('threat_count', 1)} threat(s) detected "
            f"({first_rule}). Quarantined for review."
        )
    elif status == "encrypted":
        candidate.needs_manual_review = True
        candidate.error_message = "File is password-protected or encrypted. Please review manually."

    db.add(candidate)
    db.commit()
    db.refresh(candidate)

    # Kick off NLP + scoring in background — returns response immediately
    if status == "extracted" and raw_text and not is_adv:
        background_tasks.add_task(_run_pipeline_in_background, candidate.id, job_id)

    return {
        "candidate_id": candidate.id,
        "processing_status": candidate.processing_status,
        "filename": file.filename,
        "message": "Resume uploaded — AI processing started in background"
    }


@router.get("/candidates/{candidate_id}", response_model=CandidateRead)
def get_candidate(candidate_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Retrieve candidate details ensuring IDOR protection (must belong to recruiter's jobs)."""
    jobs = db.query(JobPosting).filter(JobPosting.recruiter_id == current_user.id).all()
    job_ids = [j.id for j in jobs]
    candidate = db.query(Candidate).filter(
        Candidate.id == candidate_id,
        Candidate.job_posting_id.in_(job_ids)
    ).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return candidate


@router.get("/candidates/{candidate_id}/status")
def get_candidate_status(candidate_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Retrieve candidate status ensuring IDOR protection (must belong to recruiter's jobs)."""
    jobs = db.query(JobPosting).filter(JobPosting.recruiter_id == current_user.id).all()
    job_ids = [j.id for j in jobs]
    candidate = db.query(Candidate).filter(
        Candidate.id == candidate_id,
        Candidate.job_posting_id.in_(job_ids)
    ).first()
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
@router.get("/candidates/", response_model=List[CandidateWithScore], include_in_schema=False)
def list_all_candidates(
    search: Optional[str] = Query(None),
    tier: Optional[str] = Query(None),
    skill: Optional[str] = Query(None),
    job_id: Optional[int] = Query(None),
    pipeline_status: Optional[str] = Query(None),
    sort_by: str = Query("score_desc"),
    blind_screening: bool = Query(False),
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

        expl = (ms.explanation_json if ms else {}) or {}
        if "evidence_spans" not in expl and c.raw_text:
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
                    "title": job.title if job else "",
                    "description": job.description if job else "",
                    "required_skills": getattr(job, "required_skills", []) or [],
                    "preferred_skills": getattr(job, "preferred_skills", []) or [],
                    "min_years": getattr(job, "min_experience_years", 0.0) or 0.0,
                    "required_education": getattr(job, "education_requirement", None),
                }
                score_data = {
                    "semantic_score": ms.semantic_score if ms else None,
                    "skills_score": ms.skills_score if ms else None,
                    "experience_score": ms.experience_score if ms else None,
                    "title_score": ms.title_score if ms else None,
                    "education_score": ms.education_score if ms else None,
                    "matched_required_skills": ms.matched_skills if ms else [],
                    "missing_required_skills": ms.missing_skills if ms else [],
                    "is_capped": ms.is_capped if ms else False,
                    "cap_reason": ms.cap_reason if ms else None,
                }
                expl["evidence_spans"] = generate_evidence_spans(
                    c.raw_text, cand_profile, job_crit, score_data
                )
            except Exception as e:
                logger.warning("Failed to on-the-fly populate evidence_spans in list_all_candidates: %s", e)

        is_adv = bool(getattr(c, "is_adversarial", False))
        adv_details = getattr(c, "adversarial_details", None)
        if not is_adv and c.raw_text:
            try:
                from app.services.adversarial import scan_text_for_injections
                text_injections = scan_text_for_injections(c.raw_text)
                if text_injections:
                    is_adv = True
                    adv_details = {
                        "is_flagged": True,
                        "threat_level": "HIGH",
                        "threat_count": len(text_injections),
                        "detections": text_injections,
                        "action_taken": "Flagged for manual review & gated from generative interview prompting."
                    }
            except Exception as e:
                logger.warning("Adversarial check error: %s", e)

        if adv_details and "adversarial_shield" not in expl:
            expl["adversarial_shield"] = adv_details

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
            "roles_count": getattr(c, "roles_count", 0) or 0,
            "promotion_count": getattr(c, "promotion_count", 0) or 0,
            "avg_tenure_months": getattr(c, "avg_tenure_months", 0) or 0,
            "short_tenure_flag": bool(getattr(c, "short_tenure_flag", False)),
            "career_pattern_summary": getattr(c, "career_pattern_summary", None) or (
                f"{int(c.experience_years * 12)}mo exp" if c.experience_years else None
            ),
            "needs_manual_review": c.needs_manual_review or is_adv,
            "processing_status": "needs_manual_review" if is_adv else c.processing_status,
            "pipeline_status": c_status,
            "is_adversarial": is_adv,
            "adversarial_details": adv_details,
            "error_message": c.error_message or (
                "Adversarial Shield Alert: Prompt injection or hidden content detected. Quarantined for review."
                if is_adv else None
            ),
            "created_at": c.created_at,
            "overall_score": score_val,
            "semantic_score": ms.semantic_score if ms else None,
            "skills_score": ms.skills_score if ms else None,
            "experience_score": ms.experience_score if ms else None,
            "title_score": ms.title_score if ms else None,
            "education_score": ms.education_score if ms else None,
            "tier": "Needs Review" if is_adv else t,
            "is_capped": ms.is_capped if ms else False,
            "cap_reason": ms.cap_reason if ms else None,
            "matched_skills": ms.matched_skills if ms else [],
            "missing_skills": ms.missing_skills if ms else [],
            "matched_preferred_skills": ms.matched_preferred_skills if ms else [],
            "missing_preferred_skills": ms.missing_preferred_skills if ms else [],
            "summary": ms.summary if ms else None,
            "explanation_json": expl,
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

    if blind_screening:
        from app.services.masking import apply_blind_screening_to_candidate
        results = [
            apply_blind_screening_to_candidate(item, index=idx + 1)
            for idx, item in enumerate(results)
        ]

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


from pydantic import BaseModel, ConfigDict

class BulkInviteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    candidate_ids: List[int]
    message: Optional[str] = None
    stage: Optional[str] = "assessment"

@router.post("/candidates/bulk-invite")
def bulk_invite_candidates(
    req: BulkInviteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Send real candidate interview links for candidates in the recruiter's workspace."""
    jobs = db.query(JobPosting).filter(JobPosting.recruiter_id == current_user.id).all()
    job_ids = [j.id for j in jobs]
    
    candidates = (
        db.query(Candidate)
        .filter(Candidate.id.in_(req.candidate_ids), Candidate.job_posting_id.in_(job_ids))
        .all()
    )
    
    if not candidates:
        raise HTTPException(status_code=404, detail="No matching candidates found for this recruiter")

    job_map = {j.id: j for j in jobs}
    assessment_map = {}
    emails_sent = 0
    invited_count = 0
    manual_links = []
    for c in candidates:
        if not c.email or "@" not in c.email:
            continue
        job = job_map.get(c.job_posting_id)
        if not job:
            continue
        assessment = assessment_map.get(job.id)
        if not assessment:
            assessment = db.query(Assessment).filter(
                Assessment.recruiter_id == current_user.id,
                Assessment.title == f"{job.title} Interview",
            ).first()
            if not assessment:
                assessment = Assessment(
                    recruiter_id=current_user.id,
                    title=f"{job.title} Interview",
                    job_description=job.description,
                    min_experience_years=job.min_experience_years or 0,
                    education_requirement=job.education_requirement,
                    status="active",
                )
                assessment.required_skills = job.required_skills or []
                skills = job.required_skills or [job.title]
                assessment.blueprint_json = {
                    "estimated_duration_minutes": 30,
                    "difficulty_level": "Role interview",
                    "categories": [{"category": "Role skills and experience", "count": min(5, max(1, len(skills))), "percentage": 100, "topics": skills[:5]}],
                }
                db.add(assessment)
                db.flush()
            assessment_map[job.id] = assessment

        token = secrets.token_urlsafe(32)
        invite_url = f"{settings.APP_BASE_URL.rstrip('/')}/interview/{token}"
        invitation = InterviewInvitation(
            assessment_id=assessment.id,
            candidate_id=c.id,
            candidate_name=c.name,
            candidate_email=c.email,
            token_hash=hashlib.sha256(token.encode("utf-8")).hexdigest(),
            status="invited",
            expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        )
        db.add(invitation)
        db.flush()
        invited_count += 1
        sent, error = send_assessment_invitation_email(
            to_email=c.email,
            candidate_name=c.name,
            assessment_title=assessment.title,
            company_name=current_user.company_name or "HireRank",
            recruiter_email=current_user.email,
            invite_url=invite_url,
            message=(req.message if not (req.message or "").lower().startswith("invited as ") else None),
            duration_minutes=30,
        )
        if sent:
            c.pipeline_status = "Invited"
            emails_sent += 1
        else:
            invitation.status = "delivery_failed"
            manual_links.append({"email": c.email, "url": invite_url, "error": error})

    db.commit()

    message = f"Created {invited_count} interview invitation(s); {emails_sent} email(s) delivered."
    if manual_links:
        message += " Configure email delivery or send these secure links manually: " + "; ".join(
            f"{item['email']} -> {item['url']}" for item in manual_links
        )
    return {
        "success": invited_count > 0,
        "invited_count": invited_count,
        "emails_sent": emails_sent,
        "candidate_ids": [c.id for c in candidates if c.email and "@" in c.email],
        "manual_links": manual_links,
        "message": message,
    }


class UpdatePipelineStatusRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
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


class UpdateCandidateDetailsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: Optional[str] = None
    name: Optional[str] = None
    phone: Optional[str] = None


@router.patch("/candidates/{candidate_id}")
def update_candidate_details(
    candidate_id: int,
    req: UpdateCandidateDetailsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update candidate's contact details (email, name, phone).
    Propagates changes to associated interview invitations so outreach reaches the updated address.
    """
    jobs = db.query(JobPosting).filter(JobPosting.recruiter_id == current_user.id).all()
    job_ids = [j.id for j in jobs]
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id, Candidate.job_posting_id.in_(job_ids)).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if req.email is not None:
        clean_email = req.email.strip()
        if clean_email and "@" not in clean_email:
            raise HTTPException(status_code=422, detail="Invalid email address format")
        candidate.email = clean_email or None
        from app.models.interview import InterviewInvitation
        for inv in db.query(InterviewInvitation).filter(InterviewInvitation.candidate_id == candidate.id).all():
            inv.candidate_email = clean_email

    if req.name is not None:
        candidate.name = req.name.strip() or None
        from app.models.interview import InterviewInvitation
        for inv in db.query(InterviewInvitation).filter(InterviewInvitation.candidate_id == candidate.id).all():
            inv.candidate_name = candidate.name

    if req.phone is not None:
        candidate.phone = req.phone.strip() or None

    db.commit()
    db.refresh(candidate)
    return {
        "id": candidate.id,
        "name": candidate.name,
        "email": candidate.email,
        "phone": candidate.phone,
        "message": "Candidate details updated successfully"
    }


class BulkDeleteCandidatesRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
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


class CompareCandidatesRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    candidate_ids: List[int]


@router.post("/candidates/compare")
def compare_candidates_endpoint(
    req: CompareCandidatesRequest,
    blind_screening: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Feature 6: Head-to-Head Comparison (Recruiter moment: "Down to a few finalists — how do I decide between them?")
    Compares 2 or 3 finalist candidates on:
      - 5 score components (Semantic, Skills, Experience, Title, Education)
      - Skill overlap matrix (Common / Unique to each)
      - Deterministic templated score gap sentences: "{name} scores {delta} points higher on {component}."
    """
    if len(req.candidate_ids) < 2 or len(req.candidate_ids) > 3:
        raise HTTPException(
            status_code=400,
            detail="Head-to-head comparison requires selecting exactly 2 or 3 candidates."
        )

    jobs = db.query(JobPosting).filter(JobPosting.recruiter_id == current_user.id).all()
    job_ids = [j.id for j in jobs]

    candidates = db.query(Candidate).filter(
        Candidate.id.in_(req.candidate_ids),
        Candidate.job_posting_id.in_(job_ids)
    ).all()

    if len(candidates) != len(req.candidate_ids):
        raise HTTPException(status_code=404, detail="One or more selected candidates not found or unauthorized.")

    from app.services.comparison import generate_head_to_head_comparison
    from app.services.masking import apply_blind_screening_to_candidate

    cand_map = {c.id: c for c in candidates}
    ordered_candidates = [cand_map[cid] for cid in req.candidate_ids]

    candidate_dicts = []
    for idx, cand in enumerate(ordered_candidates):
        ms = db.query(MatchScore).filter(MatchScore.candidate_id == cand.id).first()
        cdict = {
            "id": cand.id,
            "name": cand.name or f"Candidate #{cand.id}",
            "email": cand.email,
            "phone": cand.phone,
            "title": cand.detected_title or "Candidate",
            "detected_title": cand.detected_title or "Candidate",
            "experience_years": cand.experience_years or 0.0,
            "pipeline_status": cand.pipeline_status or "Screened",
            "career_pattern_summary": cand.career_pattern_summary,
            "extracted_skills": cand.extracted_skills or [],
            "skills": cand.extracted_skills or [],
            "matched_skills": ms.matched_skills if ms else [],
            "missing_skills": ms.missing_skills if ms else [],
            "overall_score": ms.overall_score if ms else 0.0,
            "semantic_score": ms.semantic_score if ms else 0.0,
            "skills_score": ms.skills_score if ms else 0.0,
            "experience_score": ms.experience_score if ms else 0.0,
            "title_score": ms.title_score if ms else 0.0,
            "education_score": ms.education_score if ms else 0.0,
            "tier": ms.tier if ms else "Low",
        }

        if blind_screening:
            cdict = apply_blind_screening_to_candidate(cdict, index=idx + 1)

        candidate_dicts.append(cdict)

    return generate_head_to_head_comparison(candidate_dicts)


class InterviewQuestionsRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    regenerate: Optional[bool] = False


@router.get("/candidates/{candidate_id}/interview-questions")
@router.post("/candidates/{candidate_id}/interview-questions")
def get_or_generate_interview_questions_endpoint(
    candidate_id: int,
    regenerate: bool = Query(False),
    req: Optional[InterviewQuestionsRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Feature 7: Generative Interview Questions with ChatGPT API
    Recruiter moment: "What do I actually ask this person in the interview?"
    - Adversarial Gate: Checks candidate.is_adversarial and refuses OpenAI API if flagged.
    - Structured-Only Input: Never passes raw resume text.
    - Caches questions on Candidate model.
    - Rate limit: 20 calls/hr per recruiter.
    - Deterministic fallback on API errors.
    """
    force_regenerate = regenerate or (req.regenerate if req else False)

    jobs = db.query(JobPosting).filter(JobPosting.recruiter_id == current_user.id).all()
    job_ids = [j.id for j in jobs]
    candidate = db.query(Candidate).filter(
        Candidate.id == candidate_id,
        Candidate.job_posting_id.in_(job_ids)
    ).first()

    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    from app.services.interview_prep import generate_candidate_interview_questions

    match_score = db.query(MatchScore).filter(MatchScore.candidate_id == candidate.id).first()

    result = generate_candidate_interview_questions(
        candidate=candidate,
        match_score=match_score,
        recruiter_id=current_user.id,
        regenerate=force_regenerate,
    )

    # Persist cache on candidate record
    if result.get("source") in ("chatgpt", "template"):
        candidate.interview_questions = result
        db.commit()

    return result


class SendRejectionRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    subject: str
    body: str
    mark_no_hire: Optional[bool] = True


@router.get("/candidates/{candidate_id}/rejection-template")
def get_candidate_rejection_template_endpoint(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Feature 8: Templated Rejection Message
    Recruiter moment: "I need to reject this person without ghosting them,
    but I don't have time to write a personalized email."
    - Deterministic, not LLM.
    - Personal & Constructive: references matched strengths and honest primary gap.
    - Compliance & Legal Safety: Zero protected characteristics.
    """
    jobs = db.query(JobPosting).filter(JobPosting.recruiter_id == current_user.id).all()
    job_ids = [j.id for j in jobs]
    candidate = db.query(Candidate).filter(
        Candidate.id == candidate_id,
        Candidate.job_posting_id.in_(job_ids)
    ).first()

    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    job = db.query(JobPosting).filter(JobPosting.id == candidate.job_posting_id).first()
    match_score = db.query(MatchScore).filter(MatchScore.candidate_id == candidate.id).first()

    from app.services.rejection import generate_templated_rejection
    import urllib.parse

    matched_skills = match_score.matched_skills if match_score else (candidate.extracted_skills or [])
    missing_required = match_score.missing_skills if match_score else (job.required_skills if job else [])
    cand_exp = candidate.experience_years or 0.0
    min_exp = job.min_experience_years or 0.0 if job else 0.0
    overall_score = match_score.overall_score if match_score else None
    company_name = current_user.company_name or "Our Team"
    job_title = job.title if job else "Software Engineer"

    template = generate_templated_rejection(
        candidate_name=candidate.name,
        job_title=job_title,
        company_name=company_name,
        matched_skills=matched_skills,
        missing_required_skills=missing_required,
        candidate_experience=cand_exp,
        min_experience_years=min_exp,
        overall_score=overall_score,
    )

    cand_email = candidate.email or ""
    mailto_params = urllib.parse.urlencode({
        "subject": template["subject"],
        "body": template["body"]
    })
    mailto_link = f"mailto:{cand_email}?{mailto_params}" if cand_email else None

    return {
        "candidate_id": candidate.id,
        "candidate_name": candidate.name or f"Candidate #{candidate.id}",
        "candidate_email": cand_email,
        "job_title": job_title,
        "company_name": company_name,
        "subject": template["subject"],
        "body": template["body"],
        "gap_type": template["gap_type"],
        "referenced_strengths": template["referenced_strengths"],
        "referenced_gaps": template["referenced_gaps"],
        "compliance_safe": template["compliance_safe"],
        "compliance_badge": template["compliance_badge"],
        "recruiter_disclaimer": template["recruiter_disclaimer"],
        "mailto_link": mailto_link,
        "is_already_rejected": candidate.pipeline_status == "No Hire" or candidate.rejection_sent_at is not None,
        "rejection_sent_at": candidate.rejection_sent_at.isoformat() if candidate.rejection_sent_at else None,
    }


@router.post("/candidates/{candidate_id}/send-rejection")
def send_candidate_rejection_endpoint(
    candidate_id: int,
    req: SendRejectionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Feature 8: Send or record candidate rejection note.
    Attempts delivery via SMTP/Resend, records rejection timestamp,
    and updates candidate.pipeline_status to 'No Hire'.
    """
    import urllib.parse
    from datetime import datetime
    from app.services.email import send_candidate_rejection_email

    jobs = db.query(JobPosting).filter(JobPosting.recruiter_id == current_user.id).all()
    job_ids = [j.id for j in jobs]
    candidate = db.query(Candidate).filter(
        Candidate.id == candidate_id,
        Candidate.job_posting_id.in_(job_ids)
    ).first()

    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    company_name = current_user.company_name or "HireRank"
    email_delivered = False
    delivery_error = None

    if candidate.email and "@" in candidate.email:
        email_delivered, delivery_error = send_candidate_rejection_email(
            to_email=candidate.email,
            candidate_name=candidate.name,
            subject=req.subject,
            body=req.body,
            company_name=company_name,
            from_name=company_name,
        )

    # Update candidate status to No Hire
    if req.mark_no_hire:
        candidate.pipeline_status = "No Hire"

    now_utc = datetime.now(timezone.utc)
    candidate.rejection_sent_at = now_utc
    candidate.rejection_data = {
        "subject": req.subject,
        "body": req.body,
        "sent_at": now_utc.isoformat(),
        "delivered": email_delivered,
        "delivery_error": delivery_error,
    }
    db.commit()
    db.refresh(candidate)

    cand_email = candidate.email or ""
    mailto_params = urllib.parse.urlencode({
        "subject": req.subject,
        "body": req.body
    })
    mailto_link = f"mailto:{cand_email}?{mailto_params}" if cand_email else None

    return {
        "success": True,
        "candidate_id": candidate.id,
        "pipeline_status": candidate.pipeline_status,
        "email_delivered": email_delivered,
        "delivery_error": delivery_error,
        "mailto_link": mailto_link,
        "rejection_sent_at": candidate.rejection_sent_at.isoformat(),
        "message": (
            f"Candidate rejection note recorded and status updated to '{candidate.pipeline_status}'."
            + (f" Email successfully delivered to {candidate.email}." if email_delivered else "")
        ),
    }




