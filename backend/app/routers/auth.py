from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.models.user import User
from app.schemas.auth import SignupRequest, LoginRequest, TokenResponse
from app.core.config import settings
import os, httpx
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["auth"])

from fastapi.security import OAuth2PasswordBearer
from app.core.security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    user_id = payload.get("sub")
    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


@router.post("/signup", response_model=TokenResponse)
def signup(req: SignupRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=req.email,
        password_hash=hash_password(req.password),
        role=req.role,
        company_name=req.company_name
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token, user_id=user.id, email=user.email, role=user.role)

@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token, user_id=user.id, email=user.email, role=user.role)


# ── Native Google OAuth ───────────────────────────────────────────────────────

class GoogleSigninRequest(BaseModel):
    credential: str          # Google OAuth Access Token or ID Token
    company_name: str | None = None

@router.post("/google", response_model=TokenResponse)
def google_signin(req: GoogleSigninRequest, db: Session = Depends(get_db)):
    """
    Verifies a Google OAuth token directly via Google's API,
    locates or creates the HireRank User, and returns a standard JWT.
    """
    token = req.credential.strip()
    if not token:
        raise HTTPException(status_code=400, detail="Missing Google credential token")

    email = None
    name = None

    # 1. First attempt: Treat as OAuth2 access_token -> Google userinfo endpoint
    try:
        resp = httpx.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            email = data.get("email")
            name = data.get("name")
    except Exception:
        pass

    # 2. Second attempt: Treat as OpenID Connect ID Token -> Google tokeninfo endpoint
    if not email:
        try:
            resp = httpx.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": token},
                timeout=10,
            )
            if resp.status_code == 200:
                data = resp.json()
                email = data.get("email")
                name = data.get("name")
        except Exception:
            pass

    if not email:
        raise HTTPException(
            status_code=401,
            detail="Invalid Google credential or token could not be verified with Google."
        )

    # ── Find or create HireRank user ──────────────────────────────────────
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            email=email,
            password_hash=hash_password(os.urandom(32).hex()),
            role="recruiter",
            company_name=req.company_name or (name or email.split("@")[0].title()),
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    access_token = create_access_token({"sub": str(user.id)})
    return TokenResponse(
        access_token=access_token,
        user_id=user.id,
        email=user.email,
        role=user.role,
    )
