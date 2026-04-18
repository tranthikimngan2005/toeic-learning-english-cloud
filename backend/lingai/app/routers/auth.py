from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.models.user import User, SkillProfile, Streak, SkillEnum, LevelEnum
from app.schemas.schemas import RegisterRequest, TokenResponse

router = APIRouter(prefix="/api/auth", tags=["Auth"])


def _init_user_data(db: Session, user: User):
    """Create default skill profiles and streak for new user."""
    for skill in SkillEnum:
        db.add(SkillProfile(user_id=user.id, skill=skill, current_level=LevelEnum.A1))
    db.add(Streak(user_id=user.id, current_streak=0, longest_streak=0))
    db.commit()


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")

    user = User(
        username=payload.username,
        email=payload.email,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    _init_user_data(db, user)

    token = create_access_token({"sub": user.id})
    return TokenResponse(access_token=token, user_id=user.id, username=user.username, role=user.role)


@router.post("/login", response_model=TokenResponse)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # OAuth2PasswordRequestForm uses 'username' field — we accept email or username
    user = (
        db.query(User).filter(User.email == form.username).first()
        or db.query(User).filter(User.username == form.username).first()
    )
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is banned")

    token = create_access_token({"sub": user.id})
    return TokenResponse(access_token=token, user_id=user.id, username=user.username, role=user.role)
