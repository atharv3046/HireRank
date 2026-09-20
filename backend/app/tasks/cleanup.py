"""
cleanup.py
==========
Scheduled cleanup job for expired, unclaimed GuestSessions.

Runs hourly via APScheduler (started in main.py on app startup).

What gets deleted for each expired unclaimed session:
  1. Physical resume files at uploads/guest/<session_id>/
  2. MatchScore rows for the session's candidates
  3. Candidate rows
  4. JobPosting row
  5. GuestSession row

What is NEVER touched:
  - Sessions where claimed_by_org_id IS NOT NULL (user owns this data)
  - Sessions where expires_at IS NULL (claimed sessions lose their TTL)
  - Any data belonging to authenticated users' own jobs

This enforces the "auto-deleted within 24 hours" promise shown in the UI.
"""
from __future__ import annotations

import logging
import shutil
from datetime import datetime, timezone
from pathlib import Path

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.guest_session import GuestSession
from app.models.candidate import Candidate
from app.models.match_score import MatchScore
from app.models.job_posting import JobPosting

logger = logging.getLogger(__name__)


def delete_expired_guest_sessions() -> dict:
    """
    Find and hard-delete all GuestSessions where:
      - expires_at < now()      (TTL has passed)
      - claimed_by_org_id IS NULL  (never claimed by a real user)

    Returns a summary dict for logging.
    """
    now = datetime.now(timezone.utc)
    db = SessionLocal()
    sessions_deleted = 0
    candidates_deleted = 0
    files_deleted = 0
    errors = []

    try:
        # Find all expired, unclaimed sessions
        expired = db.query(GuestSession).filter(
            GuestSession.claimed_by_org_id.is_(None),
            GuestSession.expires_at.isnot(None),
            GuestSession.expires_at < now,
        ).all()

        for guest_sess in expired:
            session_id = guest_sess.id
            job_id = guest_sess.job_id

            try:
                # 1. Delete physical files at uploads/guest/<session_id>/
                session_dir = Path(settings.UPLOAD_DIR) / "guest" / session_id
                if session_dir.exists():
                    shutil.rmtree(session_dir, ignore_errors=True)
                    files_deleted += 1
                    logger.debug("Deleted guest file dir: %s", session_dir)

                # 2. Get all candidates for this job
                candidate_ids = [
                    row[0]
                    for row in db.query(Candidate.id)
                    .filter(Candidate.job_posting_id == job_id)
                    .all()
                ]

                # 3. Delete MatchScore rows
                if candidate_ids:
                    db.query(MatchScore).filter(
                        MatchScore.candidate_id.in_(candidate_ids)
                    ).delete(synchronize_session=False)

                # 4. Delete Candidate rows
                db.query(Candidate).filter(
                    Candidate.job_posting_id == job_id
                ).delete(synchronize_session=False)
                candidates_deleted += len(candidate_ids)

                # 5. Delete GuestSession row
                db.delete(guest_sess)

                # 6. Delete JobPosting row (only if owned by guest user)
                job = db.query(JobPosting).filter(JobPosting.id == job_id).first()
                if job:
                    # Safety check: only delete jobs owned by the guest user account
                    from app.models.user import User
                    guest_user = db.query(User).filter(
                        User.email == "guest@hirerank.internal"
                    ).first()
                    if guest_user and job.recruiter_id == guest_user.id:
                        db.delete(job)

                db.commit()
                sessions_deleted += 1
                logger.info("Cleaned up expired guest session %s (job %s)", session_id, job_id)

            except Exception as e:
                db.rollback()
                errors.append(f"session {session_id}: {e}")
                logger.error("Error cleaning up session %s: %s", session_id, e, exc_info=True)

    finally:
        db.close()

    summary = {
        "sessions_deleted": sessions_deleted,
        "candidates_deleted": candidates_deleted,
        "file_dirs_deleted": files_deleted,
        "errors": errors,
        "ran_at": now.isoformat(),
    }
    if sessions_deleted > 0 or errors:
        logger.info("Guest session cleanup complete: %s", summary)
    return summary


def start_cleanup_scheduler():
    """
    Start APScheduler to run delete_expired_guest_sessions() every hour.
    Called once from main.py on app startup.
    """
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.triggers.interval import IntervalTrigger

        scheduler = BackgroundScheduler()
        scheduler.add_job(
            delete_expired_guest_sessions,
            trigger=IntervalTrigger(hours=1),
            id="guest_session_cleanup",
            name="Delete expired unclaimed guest sessions",
            replace_existing=True,
            misfire_grace_time=300,
        )
        scheduler.start()
        logger.info("Guest session cleanup scheduler started (runs every hour)")
        return scheduler
    except Exception as e:
        logger.error("Failed to start cleanup scheduler: %s", e)
        return None
