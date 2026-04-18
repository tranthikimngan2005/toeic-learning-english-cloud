"""Recommendation helpers based on user error tracking."""

from __future__ import annotations

from datetime import timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.core.time import utc_now_naive
from app.models.user import Question, UserErrorTrack, QuestionAttempt


def _update_user_error_with_db(db: Session, user_id: int, question_id: int, is_correct: bool) -> UserErrorTrack | None:
    """
    Update per-user error tracking for a question.

    Rules:
        - Incorrect answer: first failure schedules review in 3 days.
            Repeated failures schedule review in 1 day.
    - Correct answer on a due review: either move next review to 7 days later,
      or mark as mastered when the learner has recovered enough.
    """
    now = utc_now_naive()
    track = (
        db.query(UserErrorTrack)
        .filter(
            UserErrorTrack.user_id == user_id,
            UserErrorTrack.question_id == question_id,
        )
        .first()
    )

    if not is_correct:
        if not track:
            track = UserErrorTrack(
                user_id=user_id,
                question_id=question_id,
                error_count=1,
                last_attempt=now,
                next_review=now + timedelta(days=3),
                status="pending",
            )
            db.add(track)
        else:
            track.error_count += 1
            track.last_attempt = now
            track.next_review = now + timedelta(days=1)
            track.status = "pending"

        db.commit()
        db.refresh(track)
        return track

    if not track:
        return None

    is_due_review = (
        track.status == "pending"
        and track.next_review is not None
        and track.next_review <= now
    )

    if is_due_review:
        track.last_attempt = now
        # If the learner has only one active error left, consider it mastered.
        if track.error_count <= 1:
            track.status = "mastered"
            track.next_review = None
            track.error_count = 0
        else:
            track.error_count -= 1
            track.next_review = now + timedelta(days=7)
            track.status = "pending"

        db.commit()
        db.refresh(track)

    return track


def update_user_error(
    user_id: int,
    question_id: int,
    is_correct: bool,
    db: Session,
) -> UserErrorTrack | None:
    """Update user error tracking using the active SQLAlchemy session."""
    return _update_user_error_with_db(db, user_id, question_id, is_correct)


def track_user_error(
    user_id: int,
    question_id: int,
    is_correct: bool,
    db: Session,
) -> UserErrorTrack | None:
    """Compatibility alias used by the practice submission flow."""
    return update_user_error(user_id, question_id, is_correct, db)


def get_recommendations(user_id: int, db: Session) -> list[dict[str, Any]]:
    """
    Return due recommendation items for a user.

    Each item includes the question and its next_review datetime.
    """
    now = utc_now_naive()

    # 1) Immediate signal from latest failed results (question_attempts).
    failed_attempts = (
        db.query(QuestionAttempt)
        .join(Question, Question.id == QuestionAttempt.question_id)
        .filter(
            QuestionAttempt.user_id == user_id,
            QuestionAttempt.is_correct.is_(False),
        )
        .order_by(QuestionAttempt.attempted_at.desc())
        .limit(200)
        .all()
    )

    recommendations: list[dict[str, Any]] = []
    seen_question_ids: set[int] = set()

    for attempt in failed_attempts:
        qid = int(attempt.question_id)
        if qid in seen_question_ids:
            continue
        seen_question_ids.add(qid)
        recommendations.append(
            {
                "question": attempt.question,
                "next_review": attempt.attempted_at,
            }
        )

    # 2) Keep pending scheduled error tracks to support spaced follow-up recommendations.
    tracks = (
        db.query(UserErrorTrack)
        .join(Question, Question.id == UserErrorTrack.question_id)
        .filter(
            UserErrorTrack.user_id == user_id,
            UserErrorTrack.status == "pending",
            UserErrorTrack.next_review.isnot(None),
            UserErrorTrack.next_review <= now,
        )
        .order_by(UserErrorTrack.next_review.asc())
        .all()
    )

    for track in tracks:
        qid = int(track.question_id)
        if qid in seen_question_ids:
            continue
        seen_question_ids.add(qid)
        recommendations.append(
            {
                "question": track.question,
                "next_review": track.next_review,
            }
        )

    return recommendations
