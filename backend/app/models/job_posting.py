from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import json

class JobPosting(Base):
    __tablename__ = "job_postings"

    id = Column(Integer, primary_key=True, index=True)
    recruiter_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    _required_skills = Column("required_skills", Text, default="[]")  # JSON string
    _preferred_skills = Column("preferred_skills", Text, default="[]")  # JSON string
    min_experience_years = Column(Float, default=0)
    max_experience_years = Column(Float, nullable=True)
    education_requirement = Column(String, nullable=True)  # e.g. "bachelors"
    _weights = Column("weights", Text, nullable=True)  # JSON custom weights
    status = Column(String, default="active")  # active / closed / draft
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    recruiter = relationship("User", back_populates="job_postings")
    candidates = relationship("Candidate", back_populates="job_posting")
    match_scores = relationship("MatchScore", back_populates="job_posting")

    @property
    def required_skills(self):
        return json.loads(self._required_skills or "[]")

    @required_skills.setter
    def required_skills(self, value):
        self._required_skills = json.dumps(value or [])

    @property
    def preferred_skills(self):
        return json.loads(self._preferred_skills or "[]")

    @preferred_skills.setter
    def preferred_skills(self, value):
        self._preferred_skills = json.dumps(value or [])

    @property
    def weights(self):
        if self._weights:
            try:
                return json.loads(self._weights)
            except Exception:
                return None
        return None

    @weights.setter
    def weights(self, value):
        self._weights = json.dumps(value) if value is not None else None
