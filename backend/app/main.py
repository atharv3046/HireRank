from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import Base, engine, SessionLocal
from app.routers import auth, jobs, candidates, scoring
import app.models  # Import all models to register them

# Create all tables
Base.metadata.create_all(bind=engine)

# ── Seed demo user & sample data on startup ──────────────────────────────────
def _seed_demo():
    from app.models.user import User
    from app.models.job_posting import JobPosting
    from app.core.security import hash_password

    db = SessionLocal()
    try:
        DEMO_EMAIL = "demo@recruitai.com"
        if db.query(User).filter(User.email == DEMO_EMAIL).first():
            return  # already seeded

        demo_user = User(
            email=DEMO_EMAIL,
            password_hash=hash_password("demo1234"),
            role="recruiter",
            company_name="RecruitAI Demo"
        )
        db.add(demo_user)
        db.flush()  # get demo_user.id

        # Sample job posting
        job = JobPosting(
            recruiter_id=demo_user.id,
            title="Senior Python Engineer",
            description=(
                "We are looking for a Senior Python Engineer to join our platform team. "
                "You will design and build scalable backend services, work with our data "
                "infrastructure, and mentor junior engineers. Experience with FastAPI, "
                "PostgreSQL, Docker, and Kubernetes is highly valued."
            ),
            min_experience_years=5,
            education_requirement="bachelors",
            status="active"
        )
        job.required_skills = [
            "Python", "FastAPI", "PostgreSQL", "Docker", "Kubernetes",
            "Redis", "AWS", "REST API", "Git", "Linux"
        ]
        db.add(job)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[seed] Warning: {e}")
    finally:
        db.close()

_seed_demo()
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Resume Screening API",
    description="AI-powered resume screening and candidate ranking system",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(jobs.router)
app.include_router(candidates.router)
app.include_router(scoring.router)

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "Resume Screening API"}

@app.get("/")
def root():
    return {"message": "Resume Screening API", "docs": "/docs"}

@app.post("/auth/demo-login")
def demo_login():
    """One-click demo access — returns a token for the pre-seeded demo account."""
    from app.models.user import User
    from app.models.job_posting import JobPosting
    from app.core.security import hash_password, create_access_token

    DEMO_EMAIL = "demo@recruitai.com"
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == DEMO_EMAIL).first()

        if not user:
            # Seed inline so we get the user in the same session
            user = User(
                email=DEMO_EMAIL,
                password_hash=hash_password("demo1234"),
                role="recruiter",
                company_name="RecruitAI Demo"
            )
            db.add(user)
            db.flush()

            job = JobPosting(
                recruiter_id=user.id,
                title="Senior Python Engineer",
                description=(
                    "We are looking for a Senior Python Engineer to join our platform team. "
                    "You will design and build scalable backend services, work with our data "
                    "infrastructure, and mentor junior engineers. Experience with FastAPI, "
                    "PostgreSQL, Docker, and Kubernetes is highly valued."
                ),
                min_experience_years=5,
                education_requirement="bachelors",
                status="active"
            )
            job.required_skills = [
                "Python", "FastAPI", "PostgreSQL", "Docker", "Kubernetes",
                "Redis", "AWS", "REST API", "Git", "Linux"
            ]
            db.add(job)
            db.commit()
            db.refresh(user)

        token = create_access_token({"sub": str(user.id)})
        return {
            "access_token": token,
            "token_type": "bearer",
            "user_id": user.id,
            "email": user.email,
            "role": user.role
        }
    except Exception as e:
        db.rollback()
        raise
    finally:
        db.close()


