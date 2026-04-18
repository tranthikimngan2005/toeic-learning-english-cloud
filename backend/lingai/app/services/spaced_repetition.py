"""
Spaced repetition scheduling.

This module keeps SM-2 utilities for legacy tests and level progression,
and adds a fixed 5-step schedule for wrong-answer recommendation cards.
"""
import random
from datetime import datetime, timedelta
from app.models.user import ReviewResultEnum
from app.core.time import utc_now_naive

GRADE_MAP = {
    ReviewResultEnum.again: 0,
    ReviewResultEnum.hard:  1,
    ReviewResultEnum.good:  3,
    ReviewResultEnum.easy:  5,
}

# Fixed schedule for wrong-answer cards:
# 1) 10-30 minutes
# 2) 1 day
# 3) 3 days
# 4) 7 days
# 5) 14-28 days
MAX_REVIEW_STEP = 5


def _first_step_delta() -> timedelta:
    return timedelta(minutes=random.randint(10, 30))


def _step_delta(step: int) -> timedelta:
    if step <= 1:
        return _first_step_delta()
    if step == 2:
        return timedelta(days=1)
    if step == 3:
        return timedelta(days=3)
    if step == 4:
        return timedelta(days=7)
    # step >= 5
    return timedelta(days=random.randint(14, 28))


def schedule_due_for_step(step: int) -> datetime:
    normalized = min(max(step, 1), MAX_REVIEW_STEP)
    return utc_now_naive() + _step_delta(normalized)


def next_step_for_result(current_step: int, result: ReviewResultEnum) -> int:
    """
    On `again`, restart to step 1. Otherwise, advance one step up to step 5.
    """
    if result == ReviewResultEnum.again:
        return 1
    return min(max(current_step, 1) + 1, MAX_REVIEW_STEP)


def interval_days_for_step(step: int) -> int:
    """
    Backward-compatible day indicator for existing UI.
    Step 1 is minute-based so represented as 0 days.
    """
    if step <= 1:
        return 0
    if step == 2:
        return 1
    if step == 3:
        return 3
    if step == 4:
        return 7
    return 21


def calculate_next_review(
    interval: int,
    ease_factor: float,
    repetitions: int,
    result: ReviewResultEnum,
) -> tuple[int, float, int, datetime]:
    """
    Returns (new_interval, new_ease, new_repetitions, due_date)
    """
    grade = GRADE_MAP[result]

    if grade < 2:
        # failed — reset
        new_interval = 1
        new_reps = 0
    else:
        if repetitions == 0:
            new_interval = 1
        elif repetitions == 1:
            new_interval = 6
        else:
            new_interval = round(interval * ease_factor)
        new_reps = repetitions + 1

    # update ease factor (SM-2 formula)
    new_ease = ease_factor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))
    new_ease = max(1.3, new_ease)  # floor at 1.3

    due_date = utc_now_naive() + timedelta(days=new_interval)
    return new_interval, round(new_ease, 4), new_reps, due_date


def level_up_check(questions_done: int, questions_correct: int, target_done: int = 50, target_accuracy: float = 75.0) -> bool:
    """Returns True if learner qualifies to advance level."""
    if questions_done < target_done:
        return False
    accuracy = (questions_correct / questions_done) * 100
    return accuracy >= target_accuracy


LEVEL_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"]

def next_level(current: str) -> str | None:
    idx = LEVEL_ORDER.index(current)
    if idx < len(LEVEL_ORDER) - 1:
        return LEVEL_ORDER[idx + 1]
    return None
