from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class MatchScoreRead(BaseModel):
    id: int
    candidate_id: int
    job_posting_id: int
    overall_score: float
    semantic_score: float
    skills_score: float
    experience_score: float
    education_score: float
    matched_skills: List[str]
    missing_skills: List[str]
    summary: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class RerankResponse(BaseModel):
    job_posting_id: int
    candidates_scored: int
    message: str
