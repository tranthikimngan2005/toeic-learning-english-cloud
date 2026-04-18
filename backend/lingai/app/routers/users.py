from datetime import timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.core.time import utc_now_naive
from app.models.user import User, SkillProfile, ReviewCard, QuestionAttempt
from app.schemas.schemas import UserOut, DashboardResponse, SkillProfileOut, StreakOut
from app.services.streak import get_or_create_streak

router = APIRouter(prefix="/api/users", tags=["Users"])


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/me/dashboard", response_model=DashboardResponse)
def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    streak = get_or_create_streak(db, current_user.id)

    profiles = db.query(SkillProfile).filter(SkillProfile.user_id == current_user.id).all()
    profile_out = [
        SkillProfileOut(
            skill=p.skill,
            current_level=p.current_level,
            questions_done=p.questions_done,
            questions_correct=p.questions_correct,
            accuracy=p.accuracy,
        )
        for p in profiles
    ]

    due_reviews = (
        db.query(ReviewCard)
        .filter(
            ReviewCard.user_id == current_user.id,
            ReviewCard.due_date <= utc_now_naive(),
        )
        .count()
    )

    total_done = sum(p.questions_done for p in profiles)

    return DashboardResponse(
        streak=StreakOut(
            current_streak=streak.current_streak,
            longest_streak=streak.longest_streak,
            last_active_date=streak.last_active_date,
        ),
        skill_profiles=profile_out,
        due_reviews=due_reviews,
        total_questions_done=total_done,
    )


@router.get("/me/progress", response_model=list[SkillProfileOut])
def get_progress(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profiles = db.query(SkillProfile).filter(SkillProfile.user_id == current_user.id).all()
    return [
        SkillProfileOut(
            skill=p.skill,
            current_level=p.current_level,
            questions_done=p.questions_done,
            questions_correct=p.questions_correct,
            accuracy=p.accuracy,
        )
        for p in profiles
    ]
