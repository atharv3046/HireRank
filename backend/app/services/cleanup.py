"""
Guest Data Retention Cleanup Service
====================================
Hard-deletes expired, unclaimed guest screening sessions (TTL 24 hours).
Cascades deletion to JobPosting, Candidate, MatchScore, and temporary disk files.
Claimed sessions (claimed_by_org_id IS NOT NULL) are strictly preserved.
"""

from __future__ import annotations

import logging
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict, Any

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.guest_session import GuestSession
from app.models.job_posting import JobPosting
from app.models.candidate import Candidate
from app.models.match_score import MatchScore

logger = logging.getLogger(__name__)


def cleanup_expired_guest_sessions(db: Session, current_time: Optional[datetime] = None) -> Dict[str, Any]:
    """
    Finds all GuestSession records where:
      expires_at <= current_time AND claimed_by_org_id IS NULL
    
    Hard-deletes:
      1. Resume files and temp directories on disk
      2. MatchScore rows
      3. Candidate rows
      4. JobPosting rows
      5. GuestSession rows
      6. In-memory session tracking cache
    """
    if current_time is None:
        current_time = datetime.now(timezone.utc)

    # Resilient cross-database comparison (SQLite stores naive, Postgres stores aware)
    curr = current_time
    if curr.tzinfo is None:
        curr = curr.replace(tzinfo=timezone.utc)

    unclaimed_sessions = (
        db.query(GuestSession)
        .filter(
            GuestSession.expires_at.is_not(None),
            GuestSession.claimed_by_org_id.is_(None),
        )
        .all()
    )

    expired_sessions = []
    for s in unclaimed_sessions:
        exp = s.expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp <= curr:
            expired_sessions.append(s)

    deleted_sessions_count = 0
    deleted_jobs_count = 0
    deleted_candidates_count = 0
    deleted_scores_count = 0

    # Import in-memory registry to clear cache as well
    try:
        from app.routers.guest import _SESSIONS
    except ImportError:
        _SESSIONS = {}

    for sess in expired_sessions:
        session_id = sess.id
        job_id = sess.job_id

        logger.info("Cleaning up expired guest session %s (job_id=%s, expires_at=%s)", session_id, job_id, sess.expires_at)

        # 1. Clean disk files for session
        session_dir = Path(settings.UPLOAD_DIR) / "guest" / session_id
        if session_dir.exists():
            shutil.rmtree(session_dir, ignore_errors=True)

        if job_id:
            # Clean any candidate files that may still reference disk paths
            candidates = db.query(Candidate).filter(Candidate.job_posting_id == job_id).all()
            for cand in candidates:
                if cand.resume_file_path:
                    try:
                        p = Path(cand.resume_file_path)
                        if p.exists():
                            p.unlink(missing_ok=True)
                    except Exception as e:
                        logger.warning("Could not delete candidate file %s: %s", cand.resume_file_path, e)

            # 2. Delete MatchScores
            score_del = (
                db.query(MatchScore)
                .filter(MatchScore.job_posting_id == job_id)
                .delete(synchronize_session=False)
            )
            deleted_scores_count += score_del

            # 3. Delete Candidates
            cand_del = (
                db.query(Candidate)
                .filter(Candidate.job_posting_id == job_id)
                .delete(synchronize_session=False)
            )
            deleted_candidates_count += cand_del

            # 4. Delete JobPosting
            job_del = (
                db.query(JobPosting)
                .filter(JobPosting.id == job_id)
                .delete(synchronize_session=False)
            )
            deleted_jobs_count += job_del

        # 5. Delete GuestSession row
        db.delete(sess)
        deleted_sessions_count += 1

        # 6. Purge from in-memory cache
        _SESSIONS.pop(session_id, None)

    db.commit()

    return {
        "expired_sessions_deleted": deleted_sessions_count,
        "jobs_deleted": deleted_jobs_count,
        "candidates_deleted": deleted_candidates_count,
        "scores_deleted": deleted_scores_count,
    }
