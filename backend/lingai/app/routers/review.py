from datetime import timedelta
import random

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.core.time import utc_now_naive
from app.models.user import User, ReviewCard, Question, QuestionAttempt
from app.schemas.schemas import ReviewCardOut, ReviewSubmitRequest, ReviewSubmitResponse, RecentMistakeOut
from app.services.spaced_repetition import (
    interval_days_for_step,
    next_step_for_result,
    schedule_due_for_step,
)
from app.services.recommendation import track_user_error

router = APIRouter(prefix="/api/review", tags=["Review"])


@router.get("/recent-mistakes", response_model=list[RecentMistakeOut])
def get_recent_mistakes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return wrong answers from the user's latest practice session window."""
    latest_attempt = (
        db.query(QuestionAttempt)
        .filter(QuestionAttempt.user_id == current_user.id)
        .order_by(desc(QuestionAttempt.attempted_at))
        .first()
    )
    if not latest_attempt:
        return []

    session_start = latest_attempt.attempted_at - timedelta(minutes=90)
    attempts = (
        db.query(QuestionAttempt)
        .join(Question, QuestionAttempt.question_id == Question.id)
        .filter(
            QuestionAttempt.user_id == current_user.id,
            QuestionAttempt.is_correct.is_(False),
            QuestionAttempt.attempted_at >= session_start,
            QuestionAttempt.attempted_at <= latest_attempt.attempted_at,
            Question.id.isnot(None),
        )
        .order_by(desc(QuestionAttempt.attempted_at))
        .all()
    )

    distinct_attempts: list[QuestionAttempt] = []
    seen_question_ids: set[int] = set()
    for attempt in attempts:
        if attempt.question_id in seen_question_ids:
            continue
        seen_question_ids.add(attempt.question_id)
        distinct_attempts.append(attempt)

    return [
        RecentMistakeOut(
            attempt_id=attempt.id,
            user_answer=attempt.user_answer,
            attempted_at=attempt.attempted_at,
            question=attempt.question,
        )
        for attempt in distinct_attempts
    ]


@router.get("/mistakes", response_model=list[RecentMistakeOut])
def get_mistakes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return latest failed questions (distinct by question) for review mode."""
    attempts = (
        db.query(QuestionAttempt)
        .join(Question, QuestionAttempt.question_id == Question.id)
        .filter(
            QuestionAttempt.user_id == current_user.id,
            QuestionAttempt.is_correct.is_(False),
            Question.id.isnot(None),
        )
        .order_by(desc(QuestionAttempt.attempted_at))
        .limit(200)
        .all()
    )

    distinct_attempts: list[QuestionAttempt] = []
    seen_question_ids: set[int] = set()
    for attempt in attempts:
        if attempt.question_id in seen_question_ids:
            continue
        seen_question_ids.add(attempt.question_id)
        distinct_attempts.append(attempt)

    return [
        RecentMistakeOut(
            attempt_id=attempt.id,
            user_answer=attempt.user_answer,
            attempted_at=attempt.attempted_at,
            question=attempt.question,
        )
        for attempt in distinct_attempts
    ]


@router.get("/due", response_model=list[ReviewCardOut])
def get_due_cards(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return all review cards due today for the current user."""
    cards = (
        db.query(ReviewCard)
        .join(Question, ReviewCard.question_id == Question.id)
        .filter(
            ReviewCard.user_id == current_user.id,
            ReviewCard.due_date <= utc_now_naive(),
            Question.id.isnot(None),
        )
        .order_by(ReviewCard.due_date)
        .all()
    )

    # Keep only the earliest due card for each question to avoid duplicate review items.
    distinct_cards: list[ReviewCard] = []
    seen_question_ids: set[int] = set()
    for card in cards:
        if card.question_id in seen_question_ids:
            continue
        seen_question_ids.add(card.question_id)
        distinct_cards.append(card)

    random.shuffle(distinct_cards)
    return distinct_cards


@router.get("/srs", response_model=list[ReviewCardOut])
def get_srs_cards(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return a shuffled list of due SRS cards for the current user."""
    cards = (
        db.query(ReviewCard)
        .join(Question, ReviewCard.question_id == Question.id)
        .filter(
            ReviewCard.user_id == current_user.id,
            ReviewCard.due_date <= utc_now_naive(),
            Question.id.isnot(None),
        )
        .order_by(ReviewCard.due_date)
        .all()
    )

    distinct_cards: list[ReviewCard] = []
    seen_question_ids: set[int] = set()
    for card in cards:
        if card.question_id in seen_question_ids:
            continue
        seen_question_ids.add(card.question_id)
        distinct_cards.append(card)

    random.shuffle(distinct_cards)
    return distinct_cards


@router.post("/submit", response_model=ReviewSubmitResponse)
def submit_review(
    payload: ReviewSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    card = (
        db.query(ReviewCard)
        .join(Question, ReviewCard.question_id == Question.id)
        .filter(ReviewCard.id == payload.card_id, ReviewCard.user_id == current_user.id)
        .first()
    )
    if not card:
        raise HTTPException(404, "Review card not found")

    current_step = max(card.repetitions, 1)
    tags = str(card.question.tags or '').lower() if card.question else ''
    is_flashcard = 'flashcard' in tags or 'vocab' in tags

    if is_flashcard:
        # Flashcard lane: Again=1d(step2), Hard=3d(step3), Good=7d(step4)
        if payload.result == 'again':
            next_step = 2
        elif payload.result == 'hard':
            next_step = 3
        else:
            next_step = 4
    else:
        next_step = next_step_for_result(current_step, payload.result)

    card.repetitions = next_step
    card.interval_days = interval_days_for_step(next_step)
    card.due_date = schedule_due_for_step(next_step)
    card.last_reviewed = utc_now_naive()

    # Keep recommendation data fresh so dashboard advice updates right after review.
    # Treat "again" as a failed recall, and hard/good/easy as successful recall.
    track_user_error(
        user_id=current_user.id,
        question_id=card.question_id,
        is_correct=payload.result != 'again',
        db=db,
    )

    db.commit()
    db.refresh(card)

    return ReviewSubmitResponse(
        card_id=card.id,
        next_due_date=card.due_date,
        interval_days=card.interval_days,
    )
