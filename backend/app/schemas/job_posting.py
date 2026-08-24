from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class JobPostingCreate(BaseModel):
    title: str
    description: str
    required_skills: List[str] = []
    min_experience_years: float = 0
    education_requirement: Optional[str] = None
    status: str = "active"

class JobPostingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    required_skills: Optional[List[str]] = None
    min_experience_years: Optional[float] = None
    education_requirement: Optional[str] = None
    status: Optional[str] = None

class JobPostingRead(BaseModel):
    id: int
    recruiter_id: int
    title: str
    description: str
    required_skills: List[str]
    min_experience_years: float
    education_requirement: Optional[str]
    status: str
    created_at: datetime
    candidate_count: int = 0

    class Config:
        from_attributes = True
