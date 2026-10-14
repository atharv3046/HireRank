"""
Internal Administration & Maintenance Endpoints
==============================================
"""

from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.core.config import settings
from app.services.cleanup import cleanup_expired_guest_sessions

router = APIRouter(prefix="/internal", tags=["internal"])


def _verify_internal_access(
    x_internal_secret: Optional[str] = Header(None, alias="X-Internal-Secret")
):
    expected_secret = settings.INTERNAL_API_SECRET
    if expected_secret:
        if not x_internal_secret or x_internal_secret != expected_secret:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unauthorized: Valid X-Internal-Secret header is required"
            )
    return True


@router.post("/cleanup")
def trigger_guest_cleanup(
    _authorized: bool = Depends(_verify_internal_access),
    db: Session = Depends(get_db)
):
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
