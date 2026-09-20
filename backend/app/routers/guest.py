"""
Guest Session Router (Phase 2 Anonymous Screening)
==================================================
Handles:
  1. POST /guest/screen              -> Upload JD + resumes, initiate background pipeline
  2. GET  /guest/session/{id}/status -> Poll pipeline progress (real stages, not a timer)
  3. GET  /guest/session/{id}/results -> Ranked masked candidates + shared aggregate metrics
  4. POST /guest/session/{id}/claim   -> Attach session to registered user (no rescoring)

Security notes:
  - /screen is rate-limited to 5 requests per IP per hour (slowapi)
    because it triggers an expensive unauthenticated NLP pipeline.
  - /claim derives the acting user ONLY from the JWT sub claim.
    No user_id is accepted as input — clients cannot spoof identity.
  - /claim returns 409 if the session is already owned by a different user.
  - The /preview alias has been removed. Use /results exclusively.

Scoring:
  - Uses app.services.scoring_shared.score_and_save — the one canonical
    HybridScorer call shared with the authenticated upload pipeline.
"""

import logging
import os
import shutil
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Request, UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal, get_db
from app.models.user import User
from app.models.job_posting import JobPosting
from app.models.candidate import Candidate
from app.models.match_score import MatchScore
from app.models.guest_session import GuestSession
from app.routers.auth import get_current_user
from app.services.aggregates import compute_batch_aggregates
from app.services.jd_parser import JDParser

# Import from standalone scoring package (zero FastAPI dependency)
from scoring import (
    ResumeParser,
    ResumeExtractor,
    HybridScorer,
    JobCriteria,
    Tier,
)

# Rate limiter (Fix 5: protect the expensive unauthenticated pipeline)
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/guest", tags=["guest"])

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc"}
MAX_FILES = 10
MAX_FILE_MB = 10
MIN_JD_LENGTH = 50

# In-memory session registry (maps session_id -> { job_id, candidate_ids, status, stage, total, done, skipped })
_SESSIONS: Dict[str, Dict[str, Any]] = {}


def _is_session_expired(guest_sess: Optional[GuestSession], now: Optional[datetime] = None) -> bool:
    """Return True if session has an expires_at timestamp that has passed and is unclaimed."""
    if not guest_sess or not guest_sess.expires_at:
        return False
    if guest_sess.claimed_by_org_id is not None:
        return False
    if now is None:
        now = datetime.now(timezone.utc)
    exp = guest_sess.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    return exp <= now


def _get_or_create_guest_user(db: Session) -> User:
    """Return or lazily create the shared guest user account."""
    from app.core.security import hash_password

    GUEST_EMAIL = "guest@hirerank.internal"
    user = db.query(User).filter(User.email == GUEST_EMAIL).first()
    if not user:
        user = User(
            email=GUEST_EMAIL,
            password_hash=hash_password(uuid.uuid4().hex),
            role="guest",
            company_name="Guest Sandbox",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def _run_guest_pipeline(session_id: str, job_id: int, candidate_ids: List[int]):
    """
    Background pipeline wired to the shared scoring_shared.score_and_save
    function, which uses HybridScorer (standalone scoring/ package):
      1. Parsing  (pdfplumber + pypdf fallback, docx, scanned-image detection)
      2. Extracting (spaCy NER, 530-skill taxonomy, timeline deduplication)
      3. Scoring via score_and_save (HybridScorer, 59.9 must-have cap)
      4. Ranking & tier assignment

    Scoring is identical to the authenticated upload path — both call
    app.services.scoring_shared.score_and_save.
    """
    from app.services.scoring_shared import score_and_save

    sess = _SESSIONS.get(session_id)
    db = SessionLocal()
    try:
        sess_row = db.query(GuestSession).filter(GuestSession.id == session_id).first()
        job = db.query(JobPosting).filter(JobPosting.id == job_id).first()
        if not job:
            if sess:
                sess["status"] = "error"
            if sess_row:
                sess_row.status = "error"
                db.commit()
            return

        extractor = ResumeExtractor()
        total = len(candidate_ids)

        for i, cid in enumerate(candidate_ids):
            candidate = db.query(Candidate).filter(Candidate.id == cid).first()
            if not candidate:
                continue

            file_path = Path(candidate.resume_file_path) if candidate.resume_file_path else None

            # ── Stage 1: Parsing ──────────────────────────────────────────────
            if sess:
                sess["stage"] = "parsing"
            if sess_row:
                sess_row.stage = "parsing"
                db.commit()

            if file_path and file_path.exists():
                parsed = ResumeParser.parse(file_path)
            else:
                parsed = ResumeParser.parse(candidate.resume_file_path or "")

            # Discard raw file bytes immediately after text extraction (Guest Data Retention Policy)
            if file_path and file_path.exists():
                try:
                    file_path.unlink(missing_ok=True)
                except Exception as err:
                    logger.warning("Could not unlink raw resume file %s: %s", file_path, err)
            candidate.resume_file_path = None

            if parsed.needs_manual_review:
                candidate.needs_manual_review = True
                candidate.processing_status = "needs_manual_review"
                candidate.raw_text = parsed.raw_text
                candidate.error_message = "; ".join(parsed.parse_notes)
                candidate.extracted_skills = []
                candidate.experience_years = 0.0
                candidate.education_level = None
                candidate.education_details = ""
                candidate.detected_title = ""
                db.commit()

                # Score as needs_manual_review
                score_and_save(cid, job_id, db)
                if sess:
                    sess["skipped"] = sess.get("skipped", 0) + 1
                    sess["done"] = i + 1
                if sess_row:
                    sess_row.skipped = sess_row.skipped + 1
                    sess_row.done = i + 1
                    db.commit()
                continue

            candidate.raw_text = parsed.raw_text
            db.commit()

            # ── Stage 2: Extracting ───────────────────────────────────────────
            if sess:
                sess["stage"] = "extracting"
            if sess_row:
                sess_row.stage = "extracting"
                db.commit()

            profile = extractor.extract_from_text(parsed.raw_text)

            # Backfill candidate fields
            if profile.name and not candidate.name:
                candidate.name = profile.name
            if profile.email and not candidate.email:
                candidate.email = profile.email
            if profile.phone and not candidate.phone:
                candidate.phone = profile.phone

            candidate.extracted_skills = profile.skills
            candidate.experience_years = profile.years_experience
            candidate.education_level = profile.education_level
            candidate.education_details = profile.education_details
            candidate.detected_title = profile.detected_title
            candidate.processing_status = "extracted"
            db.commit()

            # ── Stage 3 & 4: Score + Rank via the shared canonical function ───
            if sess:
                sess["stage"] = "scoring"
            if sess_row:
                sess_row.stage = "scoring"
                db.commit()

            score_and_save(cid, job_id, db)

            if sess:
                sess["stage"] = "ranking"
            if sess_row:
                sess_row.stage = "ranking"
                db.commit()

            if sess:
                sess["done"] = i + 1
            if sess_row:
                sess_row.done = i + 1
                db.commit()

        # Remove temporary guest folder now that all raw files have been unlinked
        tmp_dir = Path(settings.UPLOAD_DIR) / "guest" / session_id
        if tmp_dir.exists():
            shutil.rmtree(tmp_dir, ignore_errors=True)

        if sess:
            sess["stage"] = "done"
            sess["status"] = "completed"
        if sess_row:
            sess_row.stage = "done"
            sess_row.status = "completed"
            db.commit()

    except Exception as exc:
        logger.error("Guest pipeline failed for session %s: %s", session_id, exc, exc_info=True)
        if sess:
            sess["status"] = "error"
            sess["error"] = str(exc)
        if sess_row:
            sess_row.status = "error"
            sess_row.error_message = str(exc)
            db.commit()
    finally:
        db.close()


# ─────────────────────────────────────────────────────────────────────────────
# 1. POST /guest/screen  (rate-limited: 5/hour per IP)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/screen")
@limiter.limit("5/hour")
async def guest_screen(
    request: Request,
    background_tasks: BackgroundTasks,
    job_description: str = Form(...),
    files: List[UploadFile] = File(default=[]),
):
    """
    Accepts raw JD + up to 10 resume files (PDF/DOCX, max 10MB each).
    Rate-limited to 5 requests per IP per hour to protect the NLP pipeline.
    """
    cleaned_jd = job_description.strip()
    if len(cleaned_jd) < MIN_JD_LENGTH:
        raise HTTPException(
            status_code=422,
            detail=f"Job description must be at least {MIN_JD_LENGTH} characters (got {len(cleaned_jd)})."
        )

    if not files:
        raise HTTPException(status_code=422, detail="At least one resume file is required.")

    if len(files) > MAX_FILES:
        raise HTTPException(status_code=422, detail=f"Maximum {MAX_FILES} files allowed per screening batch.")

    for f in files:
        ext = Path(f.filename or "").suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=422,
                detail=f"'{f.filename}' has unsupported format. Only PDF and DOCX files are allowed."
            )

    session_id = str(uuid.uuid4())
    tmp_dir = Path(settings.UPLOAD_DIR) / "guest" / session_id
    tmp_dir.mkdir(parents=True, exist_ok=True)

    db = SessionLocal()
    try:
        guest_user = _get_or_create_guest_user(db)

        parsed_jd = JDParser().parse(cleaned_jd)

        job = JobPosting(
            recruiter_id=guest_user.id,
            title=parsed_jd.title or "Guest Screening",
            description=cleaned_jd,
            min_experience_years=parsed_jd.min_years,
            max_experience_years=parsed_jd.max_years if hasattr(parsed_jd, "max_years") else None,
            education_requirement=parsed_jd.required_education,
            status="active",
        )
        job.required_skills = parsed_jd.required_skills or []
        job.preferred_skills = parsed_jd.preferred_skills or []
        db.add(job)
        db.commit()
        db.refresh(job)

        candidate_ids: List[int] = []
        skipped: List[str] = []

        for upload in files:
            ext = Path(upload.filename or "").suffix.lower()
            fname = f"{uuid.uuid4()}{ext}"
            fpath = tmp_dir / fname

            contents = await upload.read()
            # Fix 8 (guest side): server-side size check matching frontend limit
            if len(contents) > MAX_FILE_MB * 1024 * 1024:
                skipped.append(f"{upload.filename} exceeds {MAX_FILE_MB} MB limit.")
                continue

            fpath.write_bytes(contents)

            candidate = Candidate(
                job_posting_id=job.id,
                resume_file_path=str(fpath),
                processing_status="uploaded",
            )
            db.add(candidate)
            db.commit()
            db.refresh(candidate)
            candidate_ids.append(candidate.id)

        _SESSIONS[session_id] = {
            "job_id": job.id,
            "candidate_ids": candidate_ids,
            "status": "processing",
            "stage": "parsing",
            "total": len(candidate_ids),
            "done": 0,
            "skipped": skipped,
        }

        now = datetime.now(timezone.utc)
        guest_session_record = GuestSession(
            id=session_id,
            job_id=job.id,
            created_at=now,
            expires_at=now + timedelta(hours=24),
            claimed_by_org_id=None,
            status="processing",
            stage="parsing",
            total=len(candidate_ids),
            done=0,
        )
        guest_session_record.skipped = skipped
        db.add(guest_session_record)
        db.commit()

        background_tasks.add_task(_run_guest_pipeline, session_id, job.id, candidate_ids)

        return {
            "session_id": session_id,
            "job_id": job.id,
            "candidate_count": len(candidate_ids),
            "skipped": skipped,
        }

    except Exception:
        db.rollback()
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise
    finally:
        db.close()


# ─────────────────────────────────────────────────────────────────────────────
# 2. GET /guest/session/{session_id}/status
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/session/{session_id}/status")
def guest_session_status(session_id: str):
    """Poll pipeline progress for the processing screen."""
    db = SessionLocal()
    try:
        sess = _SESSIONS.get(session_id)
        guest_sess = db.query(GuestSession).filter(GuestSession.id == session_id).first()

        if not sess and not guest_sess:
            raise HTTPException(status_code=404, detail="Screening session not found or expired.")

        if _is_session_expired(guest_sess):
            raise HTTPException(status_code=404, detail="Screening session not found or expired.")

        if sess:
            status = sess["status"]
            stage = sess["stage"]
            total = sess["total"] or 1
            done = sess["done"]
        else:
            status = guest_sess.status
            stage = guest_sess.stage
            total = guest_sess.total or 1
            done = guest_sess.done

        pct = int((done / total) * 100) if status != "done" else 100

        return {
            "session_id": session_id,
            "status": status,
            "stage": stage,
            "total": total,
            "done": done,
            "progress_pct": pct,
        }
    finally:
        db.close()


# ─────────────────────────────────────────────────────────────────────────────
# 3. GET /guest/session/{session_id}/results  (single canonical route)
# Fix 6: /preview alias removed — use /results exclusively.
# ─────────────────────────────────────────────────────────────────────────────

def _build_session_results(session_id: str) -> Dict[str, Any]:
    db = SessionLocal()
    try:
        sess = _SESSIONS.get(session_id)
        guest_sess = db.query(GuestSession).filter(GuestSession.id == session_id).first()

        if not sess and not guest_sess:
            raise HTTPException(status_code=404, detail="Screening session not found or expired.")

        if _is_session_expired(guest_sess):
            raise HTTPException(status_code=404, detail="Screening session not found or expired.")

        status = sess["status"] if sess else guest_sess.status
        if status != "done":
            raise HTTPException(status_code=202, detail="Processing not yet complete.")

        job_id = sess["job_id"] if sess else guest_sess.job_id
        job = db.query(JobPosting).filter(JobPosting.id == job_id).first()
        if not job:
            raise HTTPException(status_code=404, detail="Associated job posting not found.")

        rows = (
            db.query(Candidate, MatchScore)
            .outerjoin(
                MatchScore,
                (MatchScore.candidate_id == Candidate.id) & (MatchScore.job_posting_id == job_id)
            )
            .filter(Candidate.job_posting_id == job_id)
            .all()
        )

        def mask_email(email: Optional[str]) -> str:
            if not email or "@" not in email:
                return "c****@***.com"
            local, domain = email.split("@", 1)
            return local[0] + "****@" + domain

        candidates_out = []
        for i, (c, ms) in enumerate(rows):
            score = ms.overall_score if ms else None
            tier = ms.tier if ms and ms.tier else ("Needs Review" if c.needs_manual_review else "Low")
            candidates_out.append({
                "id": c.id,
                "name_masked": f"Candidate #{i + 1}",
                "email_masked": mask_email(c.email),
                "score": score,
                "tier": tier,
                "needs_manual_review": c.needs_manual_review,
                "skills_score": ms.skills_score if ms else None,
                "experience_score": ms.experience_score if ms else None,
                "matched_skills": ms.matched_skills if ms else [],
                "missing_skills": ms.missing_skills if ms else [],
                "years_experience": c.experience_years,
                "explanation": ms.explanation_json if ms else {},
            })

        candidates_out.sort(
            key=lambda x: (x["score"] is not None, x["score"] if x["score"] is not None else -1),
            reverse=True,
        )
        for rank_idx, cand in enumerate(candidates_out, start=1):
            cand["name_masked"] = f"Candidate #{rank_idx}"

        stats = compute_batch_aggregates(candidates_out)

        return {
            "session_id": session_id,
            "job_id": job_id,
            "job_title": job.title if job else "Screening",
            "candidates": candidates_out,
            "stats": stats,
        }
    finally:
        db.close()


@router.get("/session/{session_id}/results")
def guest_session_results(session_id: str):
    """Ranked masked candidates and shared aggregate stats."""
    return _build_session_results(session_id)


# ─────────────────────────────────────────────────────────────────────────────
# 4. POST /guest/session/{session_id}/claim
#
# Fix 1: user_id query param removed. Identity derived from JWT sub only.
# Fix 2: 409 Conflict if already claimed by a different user.
#         200 (idempotent) if claimed by the same user again.
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/session/{session_id}/claim")
def claim_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Transfers ownership of the anonymous screening batch from the guest user
    to the authenticated user (identity from JWT, never from client input).

    Returns:
      200 — claimed successfully, or already owned by this same user (idempotent)
      404 — session not found or expired
      409 — session already claimed by a DIFFERENT user
    """
    sess = _SESSIONS.get(session_id)
    guest_sess = db.query(GuestSession).filter(GuestSession.id == session_id).first()

    if not sess and not guest_sess:
        raise HTTPException(status_code=404, detail="Session not found or already claimed.")

    if _is_session_expired(guest_sess):
        raise HTTPException(status_code=404, detail="Session expired and cannot be claimed.")

    # Fix 2: ownership check before any transfer
    if guest_sess and guest_sess.claimed_by_org_id is not None:
        if guest_sess.claimed_by_org_id == current_user.id:
            # Idempotent — same user claiming again (e.g. page refresh)
            job_id = guest_sess.job_id
            return {
                "claimed": True,
                "job_id": job_id,
                "candidate_count": guest_sess.total,
                "already_owned": True,
            }
        else:
            # Different user — refuse with 409
            raise HTTPException(
                status_code=409,
                detail="This screening session has already been claimed by another account.",
            )

    job_id = guest_sess.job_id if guest_sess else sess["job_id"]
    job = db.query(JobPosting).filter(JobPosting.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Associated job posting not found.")

    # ATOMIC TRANSACTION: transfer ownership + clear expiry
    job.recruiter_id = current_user.id

    if guest_sess:
        guest_sess.claimed_by_org_id = current_user.id
        guest_sess.expires_at = None

    db.commit()

    total = guest_sess.total if guest_sess else (sess.get("total", 0) if sess else 0)
    _SESSIONS.pop(session_id, None)

    return {
        "claimed": True,
        "job_id": job.id,
        "candidate_count": total,
    }
