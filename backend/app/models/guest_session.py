from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import json

class GuestSession(Base):
    __tablename__ = "guest_sessions"

    id = Column(String, primary_key=True, index=True)  # session_id UUID string
    job_id = Column(Integer, ForeignKey("job_postings.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True, index=True)  # created_at + 24 hours (null once claimed)
    claimed_by_org_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    status = Column(String, default="processing")  # processing / done / error
    stage = Column(String, default="parsing")       # parsing / extracting / scoring / ranking / done
    total = Column(Integer, default=0)
    done = Column(Integer, default=0)
    _skipped = Column("skipped", Text, default="[]")

    job = relationship("JobPosting")
    claimed_by = relationship("User")

    @property
    def skipped(self):
        return json.loads(self._skipped or "[]")

    @skipped.setter
    def skipped(self, value):
        self._skipped = json.dumps(value or [])
