from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from app.core.database import Base
import json

class Assessment(Base):
    __tablename__ = "assessments"

    id = Column(Integer, primary_key=True, index=True)
    recruiter_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    job_description = Column(Text, nullable=False)
    _required_skills = Column("required_skills", Text, default="[]")
    min_experience_years = Column(Float, default=0.0)
    education_requirement = Column(String, nullable=True)
    _blueprint_json = Column("blueprint_json", Text, default="{}")
    status = Column(String, default="active")  # active / draft / archived
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    @property
    def required_skills(self):
        return json.loads(self._required_skills or "[]")

    @required_skills.setter
    def required_skills(self, value):
        self._required_skills = json.dumps(value or [])

    @property
    def blueprint_json(self):
        return json.loads(self._blueprint_json or "{}")

    @blueprint_json.setter
    def blueprint_json(self, value):
        self._blueprint_json = json.dumps(value or {})
