from datetime import date, timedelta
from sqlalchemy.orm import Session
from app.models.user import Streak, User
from app.core.time import utc_now_naive


def update_streak(db: Session, user: User) -> Streak:
    streak = db.query(Streak).filter(Streak.user_id == user.id).first()
    if not streak:
        streak = Streak(user_id=user.id, current_streak=0, longest_streak=0)
        db.add(streak)
        db.flush()

    today = date.today()
    last = streak.last_active_date.date() if streak.last_active_date else None

    if last == today:
        pass  # already recorded today
    elif last == today - timedelta(days=1):
        streak.current_streak += 1
        streak.last_active_date = utc_now_naive()
    else:
        # missed a day or first activity
        streak.current_streak = 1
        streak.last_active_date = utc_now_naive()

    streak.longest_streak = max(streak.longest_streak, streak.current_streak)
    db.commit()
    db.refresh(streak)
    return streak


def get_or_create_streak(db: Session, user_id: int) -> Streak:
    streak = db.query(Streak).filter(Streak.user_id == user_id).first()
    if not streak:
        streak = Streak(user_id=user_id, current_streak=0, longest_streak=0)
        db.add(streak)
        db.commit()
        db.refresh(streak)
    return streak
