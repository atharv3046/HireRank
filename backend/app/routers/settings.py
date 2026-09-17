from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta, timezone
import uuid
import os
from pydantic import BaseModel, EmailStr
from app.core.database import get_db
from app.core.security import hash_password, create_access_token
from app.models.user import User
from app.models.job_posting import JobPosting
from app.models.candidate import Candidate
from app.models.match_score import MatchScore
from app.models.team_member import TeamMember
from app.routers.auth import get_current_user
from app.services.aggregates import compute_batch_aggregates
from app.services.email import send_team_invite_email

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
    invite_token: Optional[str] = None
    invite_url: Optional[str] = None
    email_sent: bool = False
    email_error: Optional[str] = None

class TeamResponse(BaseModel):
    seat_usage: dict
    members: List[TeamMemberRead]

class InviteTeamMemberRequest(BaseModel):
    email: EmailStr
    role: str = "Recruiter"
    name: Optional[str] = None

class AcceptInviteRequest(BaseModel):
    token: str
    password: str
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
            created_at=m.created_at.strftime("%d %b %Y") if m.created_at else "Recent",
            invite_token=m.invite_token,
            invite_url=f"/accept-invite?token={m.invite_token}" if m.invite_token else None
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
    Generates a secure invitation token and URL.
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

    token = str(uuid.uuid4())
    expires = datetime.now(timezone.utc) + timedelta(days=7)

    member = TeamMember(
        org_user_id=current_user.id,
        name=req.name or req.email.split("@")[0].title(),
        email=req.email,
        role=req.role,
        status="Invited",
        invite_token=token,
        invite_expires_at=expires
    )
    db.add(member)
    db.commit()
    db.refresh(member)

    # ── Build full invite URL ─────────────────────────────────────────
    base_url = os.getenv("APP_BASE_URL", "http://localhost:5173").rstrip("/")
    full_invite_url = f"{base_url}/accept-invite?token={member.invite_token}"

    # ── Send invitation email (non-blocking; failure doesn’t abort the invite) ─
    workspace_name = current_user.company_name or "HireRank Workspace"
    email_sent, email_err = send_team_invite_email(
        to_email=member.email,
        to_name=member.name,
        invite_url=full_invite_url,
        workspace_name=workspace_name,
        inviter_email=current_user.email,
        role=member.role,
    )

    return TeamMemberRead(
        id=member.id,
        name=member.name,
        email=member.email,
        role=member.role,
        status=member.status,
        is_primary=False,
        created_at=member.created_at.strftime("%d %b %Y") if member.created_at else "Today",
        invite_token=member.invite_token,
        invite_url=f"/accept-invite?token={member.invite_token}",
        email_sent=email_sent,
        email_error=email_err,
    )


@router.get("/team/members/{member_id}/invite-link")
def get_member_invite_link(
    member_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve or regenerate the invitation link for an invited team member.
    """
    member = db.query(TeamMember).filter(
        TeamMember.id == member_id,
        TeamMember.org_user_id == current_user.id
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")
    if member.status != "Invited":
        raise HTTPException(status_code=400, detail="Team member is already Active")

    if not member.invite_token:
        member.invite_token = str(uuid.uuid4())
        member.invite_expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        db.commit()
        db.refresh(member)

    return {
        "invite_token": member.invite_token,
        "invite_url": f"/accept-invite?token={member.invite_token}",
        "email": member.email,
        "name": member.name,
        "role": member.role
    }


@router.get("/team/invite/verify")
def verify_invite_token(token: str = Query(...), db: Session = Depends(get_db)):
    """
    Public endpoint to verify an invitation token before showing the acceptance form.
    """
    member = db.query(TeamMember).filter(TeamMember.invite_token == token).first()
    if not member:
        raise HTTPException(status_code=404, detail="Invalid invitation link")

    if member.invite_expires_at:
        exp = member.invite_expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="This invitation link has expired. Please request a new invite.")

    if member.status == "Active":
        raise HTTPException(status_code=400, detail="This invitation has already been accepted. Please sign in.")

    org_user = db.query(User).filter(User.id == member.org_user_id).first()
    workspace_name = (org_user.company_name if org_user and org_user.company_name else "HireRank Workspace")

    return {
        "valid": True,
        "email": member.email,
        "name": member.name,
        "role": member.role,
        "workspace_name": workspace_name,
        "inviter_email": org_user.email if org_user else None
    }


@router.post("/team/invite/accept")
def accept_team_invite(req: AcceptInviteRequest, db: Session = Depends(get_db)):
    """
    Public endpoint: Accepts an invitation, creates or updates the user account,
    sets team member status to Active, and logs the user in immediately.
    """
    member = db.query(TeamMember).filter(TeamMember.invite_token == req.token).first()
    if not member:
        raise HTTPException(status_code=404, detail="Invalid invitation link")

    if member.invite_expires_at:
        exp = member.invite_expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="This invitation link has expired")

    org_user = db.query(User).filter(User.id == member.org_user_id).first()
    workspace_name = (org_user.company_name if org_user and org_user.company_name else "HireRank Workspace")

    # Find or create user
    user = db.query(User).filter(User.email == member.email).first()
    if not user:
        user = User(
            email=member.email,
            password_hash=hash_password(req.password),
            role=member.role.lower(),
            company_name=workspace_name
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        user.password_hash = hash_password(req.password)
        if workspace_name:
            user.company_name = workspace_name
        db.commit()

    # Update team member status to Active
    member.status = "Active"
    if req.name and req.name.strip():
        member.name = req.name.strip()
    member.invite_token = None
    db.commit()

    # Generate token for immediate login
    access_token = create_access_token({"sub": str(user.id)})
    return {
        "access_token": access_token,
        "user_id": user.id,
        "email": user.email,
        "role": user.role,
        "workspace_name": workspace_name,
        "message": f"Welcome to {workspace_name}! Your invitation is accepted."
    }


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
