from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class CandidateRead(BaseModel):
    id: int
    job_posting_id: int
    name: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    extracted_skills: List[str]
    experience_years: Optional[float]
    education_level: Optional[str]
    education_details: Optional[str]
    processing_status: str
    error_message: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class CandidateWithScore(CandidateRead):
    overall_score: Optional[float] = None
    semantic_score: Optional[float] = None
    skills_score: Optional[float] = None
    experience_score: Optional[float] = None
    education_score: Optional[float] = None
    matched_skills: List[str] = []
    missing_skills: List[str] = []
    summary: Optional[str] = None
