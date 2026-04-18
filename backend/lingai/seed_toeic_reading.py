#!/usr/bin/env python
"""One-click TOEIC Reading importer.

Features:
- Auto-create all tables in lingai.db.
- Auto-create a default creator user if the database has no users.
- Import TOEIC Reading data from data/raw/toeic_reading.json.
- Skip duplicates or bad rows without crashing.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import Base, SessionLocal, engine
from app.core.security import hash_password
from app.models.user import (
    ContentStatusEnum,
    Question,
    QuestionTypeEnum,
    RoleEnum,
    SkillEnum,
    User,
)


def _repo_root() -> Path:
    # script: backend/lingai/seed_toeic_reading.py -> repo root is parents[2]
    return Path(__file__).resolve().parents[2]


def _data_file() -> Path:
    return _repo_root() / "data" / "raw" / "toeic_reading.json"


def _ensure_default_creator(db: Session) -> User:
    """Create a default creator if the users table is empty."""
    total_users = db.query(User).count()
    if total_users > 0:
        existing_creator = db.query(User).filter(User.role == RoleEnum.creator).order_by(User.id.asc()).first()
        if existing_creator:
            return existing_creator

        fallback_user = db.query(User).order_by(User.id.asc()).first()
        return fallback_user

    default_user = User(
        username="admin",
        email="admin@local.test",
        hashed_password=hash_password("admin123"),
        role=RoleEnum.creator,
        is_active=True,
    )
    db.add(default_user)
    db.commit()
    db.refresh(default_user)
    return default_user


def _pick_creator_id(db: Session) -> int:
    creator = db.query(User).filter(User.role == RoleEnum.creator).order_by(User.id.asc()).first()
    if creator:
        return creator.id

    admin = db.query(User).filter(User.role == RoleEnum.admin).order_by(User.id.asc()).first()
    if admin:
        return admin.id

    any_user = db.query(User).order_by(User.id.asc()).first()
    if any_user:
        return any_user.id

    # DB is empty -> auto-create default creator and continue.
    return _ensure_default_creator(db).id


def _infer_q_type(options: list[str] | None) -> QuestionTypeEnum:
    return QuestionTypeEnum.mcq if options else QuestionTypeEnum.fill_blank


def _normalize_tags(raw_tags) -> str | None:
    if raw_tags is None:
        return None
    if isinstance(raw_tags, list):
        return ", ".join(str(t).strip() for t in raw_tags if str(t).strip()) or None
    text = str(raw_tags).strip()
    return text or None


def _normalize_correct_answer(correct_answer: str, options: list[str] | None) -> str:
    answer = str(correct_answer or "").strip()
    if not answer:
        return answer
    if not options:
        return answer

    idx_map = {"A": 0, "B": 1, "C": 2, "D": 3}
    idx = idx_map.get(answer.upper())
    if idx is not None and idx < len(options):
        return str(options[idx]).strip()
    return answer


def _exists_question(db: Session, *, content: str, part: int, level: int, correct_answer: str) -> bool:
    existing = (
        db.query(Question)
        .filter(
            Question.content == content,
            Question.part == part,
            Question.level == level,
            Question.correct_answer == correct_answer,
        )
        .first()
    )
    return existing is not None


def _safe_add_question(db: Session, question: Question) -> bool:
    """Insert one question. If duplicate/error occurs, skip gracefully."""
    try:
        db.add(question)
        db.flush()
        return True
    except IntegrityError:
        db.rollback()
        return False
    except Exception:
        db.rollback()
        return False


def _reset_toeic_reading_questions(db: Session) -> int:
    """Delete existing TOEIC Reading questions (part 5/6/7) before importing."""
    deleted = (
        db.query(Question)
        .filter(
            Question.skill == SkillEnum.reading,
            Question.part.in_([5, 6, 7]),
        )
        .delete(synchronize_session=False)
    )
    db.commit()
    return deleted


def _insert_flat_item(db: Session, item: dict, creator_id: int) -> tuple[int, int]:
    """Insert one flat question row (supports part 5/6/7 schema used in data/raw/toeic_reading.json)."""
    content = str(item.get("question_text", "")).strip()
    raw_correct_answer = str(item.get("correct_answer", "")).strip()
    if not content or not raw_correct_answer:
        return 0, 1

    try:
        part = int(item.get("part"))
        level = int(item.get("level"))
    except Exception:
        return 0, 1

    options = item.get("options")
    if options is not None and not isinstance(options, list):
        return 0, 1

    correct_answer = _normalize_correct_answer(raw_correct_answer, options)

    if _exists_question(
        db,
        content=content,
        part=part,
        level=level,
        correct_answer=correct_answer,
    ):
        return 0, 1

    question = Question(
        lesson_id=None,
        skill=SkillEnum.reading,
        part=part,
        level=level,
        q_type=_infer_q_type(options),
        content=content,
        options=options,
        correct_answer=correct_answer,
        passage=item.get("passage"),
        explanation=str(item.get("explanation", "")).strip() or "No explanation provided.",
        tags=_normalize_tags(item.get("tags")),
        ai_prompt=None,
        audio_url=None,
        status=ContentStatusEnum.approved,
        creator_id=creator_id,
    )
    return (1, 0) if _safe_add_question(db, question) else (0, 1)


def _insert_part5(db: Session, item: dict, creator_id: int) -> tuple[int, int]:
    # Backward-compatible wrapper.
    return _insert_flat_item(db, item, creator_id)


def _insert_passage_group(db: Session, item: dict, creator_id: int) -> tuple[int, int]:
    try:
        part = int(item.get("part"))
        level = int(item.get("level"))
    except Exception:
        return 0, 1

    passage = item.get("passage")
    shared_explanation = str(item.get("explanation", "")).strip()
    shared_tags = item.get("tags")

    inserted = 0
    skipped = 0

    for sub in item.get("questions", []):
        content = str(sub.get("question_text") or sub.get("text") or "").strip()
        raw_correct_answer = str(sub.get("correct_answer", "")).strip()
        options = sub.get("options")
        correct_answer = _normalize_correct_answer(raw_correct_answer, options)
        if not content or not correct_answer:
            skipped += 1
            continue

        if _exists_question(
            db,
            content=content,
            part=part,
            level=level,
            correct_answer=correct_answer,
        ):
            skipped += 1
            continue

        explanation = str(sub.get("explanation", "")).strip() or shared_explanation or "No explanation provided."
        tags = sub.get("tags") or shared_tags

        question = Question(
            lesson_id=None,
            skill=SkillEnum.reading,
            part=part,
            level=level,
            q_type=_infer_q_type(options),
            content=content,
            options=options,
            correct_answer=correct_answer,
            passage=passage,
            explanation=explanation,
            tags=_normalize_tags(tags),
            ai_prompt=None,
            audio_url=None,
            status=ContentStatusEnum.approved,
            creator_id=creator_id,
        )

        if _safe_add_question(db, question):
            inserted += 1
        else:
            skipped += 1

    return inserted, skipped


def import_toeic_reading(*, reset: bool = False) -> tuple[int, int, int]:
    data_path = _data_file()
    if not data_path.exists():
        raise FileNotFoundError(f"JSON file not found: {data_path}")

    with data_path.open("r", encoding="utf-8") as f:
        payload = json.load(f)

    if not isinstance(payload, list):
        raise ValueError("toeic_reading.json must contain a top-level JSON array")

    db = SessionLocal()
    inserted = 0
    skipped = 0
    deleted = 0

    try:
        if reset:
            deleted = _reset_toeic_reading_questions(db)

        creator_id = _pick_creator_id(db)

        for item in payload:
            if not isinstance(item, dict):
                skipped += 1
                continue

            part = item.get("part")
            if part in (5, 6, 7):
                if isinstance(item.get("questions"), list):
                        # New grouped schema for part 6/7: one passage with nested questions.
                        add_count, skip_count = _insert_passage_group(db, item, creator_id)
                else:
                    # Current flat schema where each object is one question.
                    add_count, skip_count = _insert_flat_item(db, item, creator_id)
                inserted += add_count
                skipped += skip_count
            else:
                skipped += 1

        db.commit()
        return inserted, skipped, deleted
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Import TOEIC Reading questions into lingai.db")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Delete existing reading part 5/6/7 questions before importing.",
    )
    args = parser.parse_args()

    # One-click setup: ensure all tables are created first.
    Base.metadata.create_all(bind=engine)

    inserted, skipped, deleted = import_toeic_reading(reset=args.reset)
    if args.reset:
        print(f"Deleted {deleted} existing TOEIC Reading question(s).")
    print(f"Inserted {inserted} TOEIC Reading question(s).")
    print(f"Skipped {skipped} question(s) (duplicate/invalid/error).")


if __name__ == "__main__":
    main()
