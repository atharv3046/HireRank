from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime

class JobPostingCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str
    description: str
    required_skills: List[str] = []
    min_experience_years: float = 0
    education_requirement: Optional[str] = None
    weights: Optional[dict] = None
    status: str = "active"

class JobPostingUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: Optional[str] = None
    description: Optional[str] = None
    required_skills: Optional[List[str]] = None
    min_experience_years: Optional[float] = None
    education_requirement: Optional[str] = None
    weights: Optional[dict] = None
    status: Optional[str] = None

class JobWeightsUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    semantic: float = 0.35
    skills: float = 0.30
    experience: float = 0.20
    title: float = 0.10
    education: float = 0.05
    rerank: bool = True

class JobPostingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    recruiter_id: int
    title: str
    description: str
    required_skills: List[str]
    min_experience_years: float
    education_requirement: Optional[str]
    weights: Optional[dict] = None
    status: str
    created_at: datetime
    candidate_count: int = 0
