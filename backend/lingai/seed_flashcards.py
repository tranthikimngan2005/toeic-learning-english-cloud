#!/usr/bin/env python
"""Seed TOEIC vocabulary flashcards into Question + ReviewCard.

Run:
  python seed_flashcards.py
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.database import Base, SessionLocal, engine
from app.core.security import hash_password
from app.core.time import utc_now_naive
from app.models.user import (
    ContentStatusEnum,
    Question,
    QuestionTypeEnum,
    ReviewCard,
    RoleEnum,
    SkillEnum,
    User,
)


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _flashcards_file() -> Path:
    return _repo_root() / "data" / "raw" / "flashcards.json"


def _ensure_user(db: Session, *, username: str, email: str, password: str, role: RoleEnum) -> User:
    existing = (
        db.query(User)
        .filter((User.email == email) | (User.username == username))
        .first()
    )
    if existing:
        return existing

    user = User(
        username=username,
        email=email,
        hashed_password=hash_password(password),
        role=role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _ensure_creator_and_student(db: Session) -> tuple[User, User]:
    creator = _ensure_user(
        db,
        username="creator1",
        email="creator@pengwin.com",
        password="creator123",
        role=RoleEnum.creator,
    )
    student = _ensure_user(
        db,
        username="an",
        email="an@pengwin.com",
        password="student123",
        role=RoleEnum.student,
    )
    return creator, student


def _question_exists(db: Session, *, content: str, answer: str) -> Question | None:
    return (
        db.query(Question)
        .filter(
            Question.skill == SkillEnum.reading,
            Question.tags.like("%flashcard_vocab%"),
            Question.content == content,
            Question.correct_answer == answer,
        )
        .first()
    )


def _slugify(value: str) -> str:
    return "-".join(part for part in value.lower().replace("/", " ").replace("&", " ").replace("-", " ").split() if part)


def _reset_flashcard_data(db: Session) -> tuple[int, int]:
    flash_questions = db.query(Question).filter(Question.tags.like("%flashcard_vocab%")).all()
    question_ids = [q.id for q in flash_questions]
    if not question_ids:
        return 0, 0

    deleted_cards = (
        db.query(ReviewCard)
        .filter(ReviewCard.question_id.in_(question_ids))
        .delete(synchronize_session=False)
    )
    deleted_questions = (
        db.query(Question)
        .filter(Question.id.in_(question_ids))
        .delete(synchronize_session=False)
    )
    db.commit()
    return deleted_questions, deleted_cards


def seed_flashcards(*, reset: bool = False) -> tuple[int, int, int, int, int]:
    flash_path = _flashcards_file()
    if not flash_path.exists():
        raise FileNotFoundError(f"Flashcards file not found: {flash_path}")

    with flash_path.open("r", encoding="utf-8-sig") as f:
        payload = json.load(f)

    if not isinstance(payload, list):
        raise ValueError("flashcards.json must be a JSON array")

    db = SessionLocal()
    inserted_questions = 0
    inserted_cards = 0
    skipped = 0
    deleted_questions = 0
    deleted_cards = 0

    try:
        if reset:
            deleted_questions, deleted_cards = _reset_flashcard_data(db)

        creator, student = _ensure_creator_and_student(db)

        for item in payload:
            word = str(item.get("word", "")).strip()
            meaning_vi = str(item.get("meaning_vi", "")).strip()
            example_en = str(item.get("example_en", "")).strip()
            example_vi = str(item.get("example_vi", "")).strip()
            ipa = str(item.get("ipa", "")).strip()
            category = str(item.get("category", "general")).strip() or "general"
            difficulty = str(item.get("difficulty", "core")).strip() or "core"

            if not word or not meaning_vi:
                skipped += 1
                continue

            content = word
            answer = meaning_vi
            explanation = f"IPA: {ipa} | Category: {category} | Difficulty: {difficulty} || {example_en} || {example_vi}"
            tags = f"flashcard_vocab,toeic,category:{_slugify(category)},difficulty:{_slugify(difficulty)}"

            q = _question_exists(db, content=content, answer=answer)
            if not q:
                q = Question(
                    lesson_id=None,
                    skill=SkillEnum.reading,
                    part=5,
                    level=550,
                    q_type=QuestionTypeEnum.fill_blank,
                    content=content,
                    options=None,
                    correct_answer=answer,
                    passage=None,
                    explanation=explanation,
                    tags=tags,
                    ai_prompt=None,
                    audio_url=None,
                    status=ContentStatusEnum.approved,
                    creator_id=creator.id,
                )
                db.add(q)
                db.flush()
                inserted_questions += 1

            existing_card = (
                db.query(ReviewCard)
                .filter(ReviewCard.user_id == student.id, ReviewCard.question_id == q.id)
                .first()
            )
            if existing_card:
                skipped += 1
                continue

            card = ReviewCard(
                user_id=student.id,
                question_id=q.id,
                interval_days=1,
                ease_factor=2.5,
                repetitions=1,
                due_date=utc_now_naive(),
                last_reviewed=None,
            )
            db.add(card)
            inserted_cards += 1

        db.commit()
        return inserted_questions, inserted_cards, skipped, deleted_questions, deleted_cards
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed TOEIC flashcards into Question + ReviewCard")
    parser.add_argument("--reset", action="store_true", help="Delete existing flashcard questions/cards before seeding")
    args = parser.parse_args()

    Base.metadata.create_all(bind=engine)
    q_count, card_count, skipped, deleted_questions, deleted_cards = seed_flashcards(reset=args.reset)
    if args.reset:
        print(f"Deleted {deleted_questions} old flashcard questions.")
        print(f"Deleted {deleted_cards} old review cards.")
    print(f"Inserted {q_count} flashcard questions.")
    print(f"Inserted {card_count} review cards.")
    print(f"Skipped {skipped} records.")


if __name__ == "__main__":
    main()
