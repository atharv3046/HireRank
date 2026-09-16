from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, EmailStr
from app.core.database import get_db
from app.models.user import User
from app.models.job_posting import JobPosting
from app.models.candidate import Candidate
from app.models.match_score import MatchScore
from app.models.team_member import TeamMember
from app.routers.auth import get_current_user
from app.services.aggregates import compute_batch_aggregates

router = APIRouter(prefix="/settings", tags=["settings"])


# ── SCHEMAS ──────────────────────────────────────────────────────────────────

class CompanyProfileResponse(BaseModel):
    workspace_name: str
    admin_email: str
    domain: str
    org_id: str
    role: str

class UpdateCompanyProfileRequest(BaseModel):
    workspace_name: str
    domain: Optional[str] = None
    admin_email: Optional[EmailStr] = None

class TeamMemberRead(BaseModel):
    id: int
    name: Optional[str]
    email: str
    role: str
    status: str
    is_primary: bool = False
    created_at: str

class TeamResponse(BaseModel):
    seat_usage: dict
    members: List[TeamMemberRead]

class InviteTeamMemberRequest(BaseModel):
    email: EmailStr
    role: str = "Recruiter"
    name: Optional[str] = None

class UpdateTeamMemberRequest(BaseModel):
    role: Optional[str] = None
    status: Optional[str] = None


# ── ENDPOINTS ────────────────────────────────────────────────────────────────

@router.get("/profile", response_model=CompanyProfileResponse)
def get_company_profile(current_user: User = Depends(get_current_user)):
    """
    Get company/workspace profile data for the current recruiter.
    """
    workspace_name = current_user.company_name or "HireRank Workspace"
    email_domain = current_user.email.split("@")[1] if "@" in current_user.email else "hirerank.ai"
    domain = getattr(current_user, "domain", None) or (email_domain if email_domain != "gmail.com" else f"{workspace_name.lower().replace(' ', '')}.com")
    org_id = f"org_{current_user.id:04d}"

    return CompanyProfileResponse(
        workspace_name=workspace_name,
        admin_email=current_user.email,
        domain=domain,
        org_id=org_id,
        role=current_user.role or "Admin"
    )


@router.put("/profile", response_model=CompanyProfileResponse)
def update_company_profile(
    req: UpdateCompanyProfileRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update workspace name, domain, and optionally admin email.
    """
    current_user.company_name = req.workspace_name
    if req.domain is not None:
        current_user.domain = req.domain

    if req.admin_email and req.admin_email != current_user.email:
        # Check if email is already taken
        existing = db.query(User).filter(User.email == req.admin_email, User.id != current_user.id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email is already in use by another workspace account")
        current_user.email = req.admin_email

    db.commit()
    db.refresh(current_user)

    return get_company_profile(current_user)


@router.get("/team", response_model=TeamResponse)
def get_team_members(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get team seat usage and member roster for the recruiter's organization.
    """
    members = db.query(TeamMember).filter(TeamMember.org_user_id == current_user.id).all()

    # If no members yet, automatically seed the primary admin as member #1
    if not members:
        primary_admin = TeamMember(
            org_user_id=current_user.id,
            name=current_user.email.split("@")[0].title().replace(".", " "),
            email=current_user.email,
            role="Admin",
            status="Active"
        )
        db.add(primary_admin)
        db.commit()
        db.refresh(primary_admin)
        members = [primary_admin]

    member_items = [
        TeamMemberRead(
            id=m.id,
            name=m.name or m.email.split("@")[0].title(),
            email=m.email,
            role=m.role,
            status=m.status,
            is_primary=(m.email == current_user.email),
            created_at=m.created_at.strftime("%d %b %Y") if m.created_at else "Recent"
        )
        for m in members
    ]

    used_seats = len(member_items)
    max_seats = 5

    return TeamResponse(
        seat_usage={"used": used_seats, "total": max_seats, "percentage": round((used_seats / max_seats) * 100)},
        members=member_items
    )


@router.post("/team/invite", response_model=TeamMemberRead)
def invite_team_member(
    req: InviteTeamMemberRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Invite a new team member. Validates seat capacity (5-seat limit).
    """
    # Ensure primary admin is seeded
    admin_exists = db.query(TeamMember).filter(TeamMember.org_user_id == current_user.id).first()
    if not admin_exists:
        primary_admin = TeamMember(
            org_user_id=current_user.id,
            name=current_user.email.split("@")[0].title().replace(".", " "),
            email=current_user.email,
            role="Admin",
            status="Active"
        )
        db.add(primary_admin)
        db.commit()

    existing_count = db.query(TeamMember).filter(TeamMember.org_user_id == current_user.id).count()
    if existing_count >= 5:
        raise HTTPException(
            status_code=400,
            detail="Seat limit reached (5/5). Please upgrade your plan to invite more team members."
        )

    already_invited = db.query(TeamMember).filter(
        TeamMember.org_user_id == current_user.id,
        TeamMember.email == req.email
    ).first()
    if already_invited:
        raise HTTPException(status_code=400, detail=f"Team member with email {req.email} already exists")

    member = TeamMember(
        org_user_id=current_user.id,
        name=req.name or req.email.split("@")[0].title(),
        email=req.email,
        role=req.role,
        status="Invited"
    )
    db.add(member)
    db.commit()
    db.refresh(member)

    return TeamMemberRead(
        id=member.id,
        name=member.name,
        email=member.email,
        role=member.role,
        status=member.status,
        is_primary=False,
        created_at=member.created_at.strftime("%d %b %Y") if member.created_at else "Today"
    )


@router.delete("/team/members/{member_id}")
def remove_team_member(
    member_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Remove a team member from the organization workspace.
    """
    member = db.query(TeamMember).filter(
        TeamMember.id == member_id,
        TeamMember.org_user_id == current_user.id
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")

    if member.email == current_user.email:
        raise HTTPException(status_code=400, detail="Cannot remove primary workspace owner/admin")

    db.delete(member)
    db.commit()
    return {"success": True, "message": f"Removed {member.email} from workspace"}


@router.patch("/team/members/{member_id}", response_model=TeamMemberRead)
def update_team_member(
    member_id: int,
    req: UpdateTeamMemberRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update team member role or status.
    """
    member = db.query(TeamMember).filter(
        TeamMember.id == member_id,
        TeamMember.org_user_id == current_user.id
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")

    if req.role:
        member.role = req.role
    if req.status:
        member.status = req.status

    db.commit()
    db.refresh(member)

    return TeamMemberRead(
        id=member.id,
        name=member.name,
        email=member.email,
        role=member.role,
        status=member.status,
        is_primary=(member.email == current_user.email),
        created_at=member.created_at.strftime("%d %b %Y") if member.created_at else "Recent"
    )


@router.get("/billing")
def get_billing_and_plan(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Unified usage tracking against plan quotas, tracing directly to compute_batch_aggregates.
    """
    jobs = db.query(JobPosting).filter(JobPosting.recruiter_id == current_user.id).all()
    job_ids = [j.id for j in jobs]

    # Shared aggregation logic
    if job_ids:
        rows = (
            db.query(Candidate, MatchScore)
            .outerjoin(MatchScore, (MatchScore.candidate_id == Candidate.id) & (MatchScore.job_posting_id == Candidate.job_posting_id))
            .filter(Candidate.job_posting_id.in_(job_ids))
            .all()
        )
        candidate_items = [
            {"score": ms.overall_score if ms else None, "tier": ms.tier if ms and ms.tier else "Low"}
            for _, ms in rows
        ]
        agg = compute_batch_aggregates(candidate_items)
        screened_count = agg["total_processed"]
    else:
        screened_count = 0

    evaluations_count = len(job_ids)
    team_members_count = db.query(TeamMember).filter(TeamMember.org_user_id == current_user.id).count() or 1

    screenings_limit = 60
    evaluations_limit = 10
    seats_limit = 5

    return {
        "current_plan": "Free Trial",
        "billing_cycle": "Monthly",
        "renewal_date": "Next billing cycle: Free tier active",
        "usage": {
            "screenings": {
                "used": screened_count,
                "limit": screenings_limit,
                "percentage": round(min(100.0, (screened_count / screenings_limit) * 100))
            },
            "evaluations": {
                "used": evaluations_count,
                "limit": evaluations_limit,
                "percentage": round(min(100.0, (evaluations_count / evaluations_limit) * 100))
            },
            "team_seats": {
                "used": team_members_count,
                "limit": seats_limit,
                "percentage": round(min(100.0, (team_members_count / seats_limit) * 100))
            }
        },
        "plans": [
            {
                "name": "Free Trial",
                "price": "$0",
                "period": "forever",
                "badge": "Current Plan",
                "screenings": "60 candidate resumes",
                "evaluations": "10 pipeline evaluations",
                "seats": "Up to 5 team members",
                "features": [
                    "4-Tier AI Candidate Ranking",
                    "5-Factor Score Decomposition",
                    "CSV Candidate Export",
                    "24h Guest Retention Enforced"
                ],
                "is_current": True
            },
            {
                "name": "Pro Recruiter",
                "price": "$149",
                "period": "/month",
                "badge": "Most Popular",
                "screenings": "1,000 candidate resumes/mo",
                "evaluations": "100 pipeline evaluations/mo",
                "seats": "15 team members",
                "features": [
                    "Everything in Free Trial",
                    "Custom Rubric Question Generation",
                    "Priority Async Processing",
                    "Advanced Candidate Analytics",
                    "Dedicated Support"
                ],
                "is_current": False
            },
            {
                "name": "Enterprise Scale",
                "price": "$499",
                "period": "/month",
                "badge": "High Volume",
                "screenings": "Unlimited resumes",
                "evaluations": "Unlimited evaluations",
                "seats": "Unlimited team members",
                "features": [
                    "Everything in Pro Recruiter",
                    "Custom Skills Taxonomy Calibration",
                    "SSO & Custom Domain Integration",
                    "99.9% SLA & 24/7 Phone Support"
                ],
                "is_current": False
            }
        ]
    }
