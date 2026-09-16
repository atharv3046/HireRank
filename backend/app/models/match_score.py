from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey, Text, String, Boolean, UniqueConstraint
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
    overall_score = Column(Float, nullable=True)  # Nullable for unparseable candidates
    semantic_score = Column(Float, nullable=True)
    skills_score = Column(Float, nullable=True)
    experience_score = Column(Float, nullable=True)
    title_score = Column(Float, nullable=True, default=0.0)
    education_score = Column(Float, nullable=True)
    tier = Column(String, default="Low")  # Strong / Potential / Low / Needs Review
    is_capped = Column(Boolean, default=False)
    cap_reason = Column(String, nullable=True)
    _matched_skills = Column("matched_skills", Text, default="[]")  # JSON
    _missing_skills = Column("missing_skills", Text, default="[]")  # JSON
    _matched_preferred_skills = Column("matched_preferred_skills", Text, default="[]")
    _missing_preferred_skills = Column("missing_preferred_skills", Text, default="[]")
    summary = Column(Text, nullable=True)
    _explanation_json = Column("explanation_json", Text, nullable=True)  # Full ScoreBreakdown JSON
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

    @property
    def matched_preferred_skills(self):
        return json.loads(self._matched_preferred_skills or "[]")

    @matched_preferred_skills.setter
    def matched_preferred_skills(self, value):
        self._matched_preferred_skills = json.dumps(value or [])

    @property
    def missing_preferred_skills(self):
        return json.loads(self._missing_preferred_skills or "[]")

    @missing_preferred_skills.setter
    def missing_preferred_skills(self, value):
        self._missing_preferred_skills = json.dumps(value or [])

    @property
    def explanation_json(self):
        if self._explanation_json:
            try:
                return json.loads(self._explanation_json)
            except Exception:
                return {}
        return {}

    @explanation_json.setter
    def explanation_json(self, value):
        self._explanation_json = json.dumps(value or {})
