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
    pipeline_status: Optional[str] = "Screened"
    error_message: Optional[str]
    roles_count: Optional[int] = 0
    promotion_count: Optional[int] = 0
    avg_tenure_months: Optional[int] = 0
    short_tenure_flag: Optional[bool] = False
    career_pattern_summary: Optional[str] = None
    is_masked: Optional[bool] = False
    is_adversarial: Optional[bool] = False
    adversarial_details: Optional[dict] = None
    interview_questions: Optional[dict] = None
    created_at: datetime

    class Config:
        from_attributes = True

class CandidateWithScore(CandidateRead):
    detected_title: Optional[str] = None
    needs_manual_review: Optional[bool] = False
    overall_score: Optional[float] = None
    semantic_score: Optional[float] = None
    skills_score: Optional[float] = None
    experience_score: Optional[float] = None
    title_score: Optional[float] = None
    education_score: Optional[float] = None
    tier: Optional[str] = "Low"
    is_capped: Optional[bool] = False
    cap_reason: Optional[str] = None
    matched_skills: List[str] = []
    missing_skills: List[str] = []
    matched_preferred_skills: List[str] = []
    missing_preferred_skills: List[str] = []
    summary: Optional[str] = None
    explanation_json: Optional[dict] = None
    job_title: Optional[str] = None
    pipeline_status: Optional[str] = "Screened"
