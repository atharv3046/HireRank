"""
Internal Administration & Maintenance Endpoints
==============================================
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.cleanup import cleanup_expired_guest_sessions

router = APIRouter(prefix="/internal", tags=["internal"])


@router.post("/cleanup")
def trigger_guest_cleanup(db: Session = Depends(get_db)):
    """
    Triggers immediate sweep to purge expired, unclaimed guest sessions
    and cascade delete associated jobs, candidates, match scores, and raw files.
    """
    result = cleanup_expired_guest_sessions(db)
    return {
        "status": "ok",
        "result": result,
        **result,
    }
