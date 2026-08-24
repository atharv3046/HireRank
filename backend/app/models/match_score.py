from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import json

class MatchScore(Base):
    __tablename__ = "match_scores"
    __table_args__ = (UniqueConstraint("candidate_id", "job_posting_id", name="uq_candidate_job"),)

    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), nullable=False)
    job_posting_id = Column(Integer, ForeignKey("job_postings.id"), nullable=False)
    overall_score = Column(Float, default=0)
    semantic_score = Column(Float, default=0)
    skills_score = Column(Float, default=0)
    experience_score = Column(Float, default=0)
    education_score = Column(Float, default=0)
    _matched_skills = Column("matched_skills", Text, default="[]")  # JSON
    _missing_skills = Column("missing_skills", Text, default="[]")  # JSON
    summary = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    candidate = relationship("Candidate", back_populates="match_scores")
    job_posting = relationship("JobPosting", back_populates="match_scores")

    @property
    def matched_skills(self):
        return json.loads(self._matched_skills or "[]")

    @matched_skills.setter
    def matched_skills(self, value):
        self._matched_skills = json.dumps(value or [])

    @property
    def missing_skills(self):
        return json.loads(self._missing_skills or "[]")

    @missing_skills.setter
    def missing_skills(self, value):
        self._missing_skills = json.dumps(value or [])
