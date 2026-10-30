from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.sql import func
from app.core.database import Base
import json


class InterviewInvitation(Base):
    __tablename__ = "interview_invitations"

    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(Integer, ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False, index=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id", ondelete="SET NULL"), nullable=True, index=True)
    candidate_name = Column(String, nullable=True)
    candidate_email = Column(String, nullable=False, index=True)
    token_hash = Column(String, nullable=False, unique=True, index=True)
    status = Column(String, nullable=False, default="invited", index=True)
    answers_json = Column(Text, nullable=True)
    recruiter_rating = Column(Integer, nullable=True)
    recruiter_decision = Column(String, nullable=True)
    recruiter_notes = Column(Text, nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    booked_slot_id = Column(Integer, ForeignKey("interview_slots.id", ondelete="SET NULL"), nullable=True, unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    @property
    def answers(self):
        try:
            return json.loads(self.answers_json or "{}")
        except (TypeError, ValueError):
            return {}

    @answers.setter
    def answers(self, value):
        self.answers_json = json.dumps(value or {})


class InterviewSlot(Base):
    __tablename__ = "interview_slots"
    __table_args__ = (UniqueConstraint("assessment_id", "starts_at", name="uq_assessment_slot_time"),)

    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(Integer, ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False, index=True)
    starts_at = Column(DateTime(timezone=True), nullable=False, index=True)
    duration_minutes = Column(Integer, nullable=False, default=30)
    meeting_url = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
