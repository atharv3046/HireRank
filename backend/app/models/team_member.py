from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base

class TeamMember(Base):
    __tablename__ = "team_members"

    id = Column(Integer, primary_key=True, index=True)
    org_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=True)
    email = Column(String, nullable=False)
    role = Column(String, default="Recruiter")  # Admin / Recruiter / Reviewer
    status = Column(String, default="Active")  # Active / Invited
    created_at = Column(DateTime(timezone=True), server_default=func.now())
