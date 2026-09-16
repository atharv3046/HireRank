from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
import re
from app.core.database import get_db
from app.models.user import User
from app.models.job_posting import JobPosting
from app.models.candidate import Candidate
from app.models.match_score import MatchScore
from app.models.assessment import Assessment
from app.routers.auth import get_current_user
from app.services.extraction import get_extractor

router = APIRouter(prefix="/assessments", tags=["assessments"])


# ── SCHEMAS ──────────────────────────────────────────────────────────────────

class ScreeningBatchOption(BaseModel):
    id: int
    title: str
    description: str
    required_skills: List[str]
    candidate_count: int

class ExtractBlueprintRequest(BaseModel):
    job_description: str
    batch_id: Optional[int] = None

class QuestionCategory(BaseModel):
    category: str
    count: int
    percentage: int
    topics: List[str]

class BlueprintData(BaseModel):
    estimated_duration_minutes: int
    difficulty_level: str
    categories: List[QuestionCategory]

class PassRatePreview(BaseModel):
    total_evaluated: int
    passed_count: int
    pass_rate_pct: float
    summary: str

class ExtractedBlueprintResponse(BaseModel):
    detected_title: str
    min_experience_years: float
    education_requirement: str
    required_skills: List[str]
    blueprint: BlueprintData
    pass_preview: PassRatePreview

class SimulatePassRateRequest(BaseModel):
    required_skills: List[str]
    min_experience_years: float = 0.0
    batch_id: Optional[int] = None

class CreateAssessmentRequest(BaseModel):
    title: str
    job_description: str
    required_skills: List[str]
    min_experience_years: float = 0.0
    education_requirement: Optional[str] = None
    blueprint: Dict[str, Any]

class AssessmentRead(BaseModel):
    id: int
    recruiter_id: int
    title: str
    job_description: str
    required_skills: List[str]
    min_experience_years: float
    education_requirement: Optional[str]
    blueprint_json: Dict[str, Any]
    status: str
    created_at: str


# ── HELPERS ──────────────────────────────────────────────────────────────────

def _detect_title_from_jd(jd: str) -> str:
    lines = [l.strip() for l in jd.splitlines() if l.strip()]
    if not lines:
        return "Assessment Role"
    first_line = lines[0]
    # Remove common prefixes
    cleaned = re.sub(r'^(job title|role|position|opening|we are looking for an?|we are hiring an?|we need an?|hiring:?)\s*', '', first_line, flags=re.IGNORECASE)
    if len(cleaned) <= 60 and not cleaned.endswith('.'):
        return cleaned
    # Search for role keywords
    match = re.search(r'(Senior|Lead|Staff|Principal|Junior|Mid-Level)?\s*([A-Z][A-Za-z0-9+#.\s]{2,25}(?:Developer|Engineer|Architect|Designer|Manager|Analyst|Consultant|Scientist|Specialist))', jd)
    if match:
        return match.group(0).strip()
    return "Technical Specialist"


def _compute_pass_preview(
    required_skills: List[str],
    min_experience: float,
    candidates: List[Candidate],
    match_scores: Dict[int, MatchScore]
) -> PassRatePreview:
    total = len(candidates)
    if total == 0:
        return PassRatePreview(
            total_evaluated=0,
            passed_count=0,
            pass_rate_pct=0.0,
            summary="No candidates available in workspace for preview."
        )

    req_lower = [s.lower() for s in required_skills]
    passed = 0

    for c in candidates:
        ms = match_scores.get(c.id)
        score = ms.overall_score if ms else 0
        exp = c.experience_years or 0
        skills = [s.lower() for s in (c.extracted_skills or [])]

        # Check skill overlap
        overlap = sum(1 for s in req_lower if any(s in cs or cs in s for cs in skills))
        skill_pct = (overlap / len(req_lower)) if req_lower else 1.0

        # Candidate passes if score >= 60% OR skill overlap >= 50% and exp >= min_exp
        if (score and score >= 60.0) or (skill_pct >= 0.5 and exp >= max(0, min_experience - 1)):
            passed += 1

    rate = round((passed / total) * 100, 1)
    summary = f"{passed} of {total} candidates match this blueprint ({rate}% pass rate)"

    return PassRatePreview(
        total_evaluated=total,
        passed_count=passed,
        pass_rate_pct=rate,
        summary=summary
    )


# ── ENDPOINTS ────────────────────────────────────────────────────────────────

@router.get("/batches", response_model=List[ScreeningBatchOption])
def list_importable_batches(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List recruiter's candidate screening batches to import into Assessment wizard.
    """
    jobs = db.query(JobPosting).filter(JobPosting.recruiter_id == current_user.id).all()
    results = []
    for j in jobs:
        count = db.query(Candidate).filter(Candidate.job_posting_id == j.id).count()
        results.append(
            ScreeningBatchOption(
                id=j.id,
                title=j.title,
                description=j.description,
                required_skills=j.required_skills or [],
                candidate_count=count
            )
        )
    return results


@router.post("/extract-blueprint", response_model=ExtractedBlueprintResponse)
def extract_blueprint(
    req: ExtractBlueprintRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Extracts skills, role title, experience, education, and compiles live question blueprint.
    """
    if not req.job_description or len(req.job_description.strip()) < 20:
        raise HTTPException(status_code=400, detail="Job description must be at least 20 characters")

    extractor = get_extractor()
    jd = req.job_description.strip()

    # Title detection
    title = _detect_title_from_jd(jd)

    # Skills extraction
    skills = extractor.extract_skills(jd)
    if not skills:
        # Fallback keyword extraction
        words = re.findall(r'\b[A-Za-z0-9#+.]{2,15}\b', jd)
        common_tech = ["Python", "FastAPI", "React", "TypeScript", "SQL", "Docker", "AWS", "Git"]
        skills = [t for t in common_tech if any(t.lower() == w.lower() for w in words)] or ["Python", "Problem Solving"]

    # Experience extraction
    exp = extractor.extract_experience_years(jd)
    if exp == 0.0:
        exp_match = re.search(r'(\d+)\+?\s*years?', jd, re.IGNORECASE)
        if exp_match:
            try: exp = float(exp_match.group(1))
            except ValueError: exp = 2.0
        else:
            exp = 2.0

    # Education extraction
    edu_info = extractor.extract_education(jd)
    edu_req = edu_info.get("level") or "bachelors"

    # Blueprint categories
    categories = [
        QuestionCategory(
            category="Technical & Coding Proficiency",
            count=4,
            percentage=40,
            topics=skills[:4] if len(skills) >= 4 else skills + ["Code Structure", "Clean Code"]
        ),
        QuestionCategory(
            category="System Architecture & Scalability",
            count=3,
            percentage=30,
            topics=["Scalable API Design", "Data Modeling", "Failure Handling"]
        ),
        QuestionCategory(
            category="Algorithms & Problem Solving",
            count=2,
            percentage=20,
            topics=["Time Complexity", "Edge Case Analysis"]
        ),
        QuestionCategory(
            category="Behavioral & Engineering Practices",
            count=1,
            percentage=10,
            topics=["Code Review Culture", "Stakeholder Communication"]
        )
    ]

    blueprint = BlueprintData(
        estimated_duration_minutes=45,
        difficulty_level="Mid-Senior",
        categories=categories
    )

    # Compute candidate pass preview
    user_jobs = db.query(JobPosting).filter(JobPosting.recruiter_id == current_user.id).all()
    job_ids = [req.batch_id] if req.batch_id else [j.id for j in user_jobs]

    candidates = db.query(Candidate).filter(Candidate.job_posting_id.in_(job_ids)).all() if job_ids else []
    scores = db.query(MatchScore).filter(MatchScore.job_posting_id.in_(job_ids)).all() if job_ids else []
    score_map = {ms.candidate_id: ms for ms in scores}

    pass_preview = _compute_pass_preview(skills, exp, candidates, score_map)

    return ExtractedBlueprintResponse(
        detected_title=title,
        min_experience_years=exp,
        education_requirement=edu_req,
        required_skills=skills,
        blueprint=blueprint,
        pass_preview=pass_preview
    )


@router.post("/simulate-pass-rate", response_model=PassRatePreview)
def simulate_pass_rate(
    req: SimulatePassRateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Dynamically recalculate pass preview as recruiter edits skills or experience.
    """
    user_jobs = db.query(JobPosting).filter(JobPosting.recruiter_id == current_user.id).all()
    job_ids = [req.batch_id] if req.batch_id else [j.id for j in user_jobs]

    candidates = db.query(Candidate).filter(Candidate.job_posting_id.in_(job_ids)).all() if job_ids else []
    scores = db.query(MatchScore).filter(MatchScore.job_posting_id.in_(job_ids)).all() if job_ids else []
    score_map = {ms.candidate_id: ms for ms in scores}

    return _compute_pass_preview(req.required_skills, req.min_experience_years, candidates, score_map)


@router.post("/", response_model=AssessmentRead)
def create_assessment(
    req: CreateAssessmentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Save and launch an assessment pipeline.
    """
    assessment = Assessment(
        recruiter_id=current_user.id,
        title=req.title,
        job_description=req.job_description,
        min_experience_years=req.min_experience_years,
        education_requirement=req.education_requirement,
        status="active"
    )
    assessment.required_skills = req.required_skills
    assessment.blueprint_json = req.blueprint

    db.add(assessment)
    db.commit()
    db.refresh(assessment)

    return AssessmentRead(
        id=assessment.id,
        recruiter_id=assessment.recruiter_id,
        title=assessment.title,
        job_description=assessment.job_description,
        required_skills=assessment.required_skills,
        min_experience_years=assessment.min_experience_years,
        education_requirement=assessment.education_requirement,
        blueprint_json=assessment.blueprint_json,
        status=assessment.status,
        created_at=assessment.created_at.strftime("%d %b %Y")
    )


@router.get("/", response_model=List[AssessmentRead])
def list_assessments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List assessments created by recruiter.
    """
    items = db.query(Assessment).filter(Assessment.recruiter_id == current_user.id).all()
    return [
        AssessmentRead(
            id=a.id,
            recruiter_id=a.recruiter_id,
            title=a.title,
            job_description=a.job_description,
            required_skills=a.required_skills,
            min_experience_years=a.min_experience_years,
            education_requirement=a.education_requirement,
            blueprint_json=a.blueprint_json,
            status=a.status,
            created_at=a.created_at.strftime("%d %b %Y")
        )
        for a in items
    ]
