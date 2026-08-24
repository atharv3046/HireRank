from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import json

class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(Integer, primary_key=True, index=True)
    job_posting_id = Column(Integer, ForeignKey("job_postings.id"), nullable=False)
    resume_file_path = Column(String, nullable=True)
    name = Column(String, nullable=True)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    _extracted_skills = Column("extracted_skills", Text, default="[]")  # JSON
    experience_years = Column(Float, nullable=True)
    education_level = Column(String, nullable=True)  # phd/masters/bachelors/associate/high_school
    education_details = Column(Text, nullable=True)
    raw_text = Column(Text, nullable=True)
    _embedding = Column("embedding", Text, nullable=True)  # JSON list of floats for SQLite
    processing_status = Column(String, default="uploaded")  # uploaded/extracting/extracted/scoring/done/error/needs_ocr
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    job_posting = relationship("JobPosting", back_populates="candidates")
    match_scores = relationship("MatchScore", back_populates="candidate")

    @property
    def extracted_skills(self):
        return json.loads(self._extracted_skills or "[]")

    @extracted_skills.setter
    def extracted_skills(self, value):
        self._extracted_skills = json.dumps(value or [])

    @property
    def embedding(self):
        if self._embedding:
            return json.loads(self._embedding)
        return None

    @embedding.setter
    def embedding(self, value):
        self._embedding = json.dumps(value) if value is not None else None
