from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.user import Question, ReviewCard, SkillEnum, User, ContentStatusEnum, QuestionTypeEnum
from app.schemas.schemas import FlashcardOut, FlashcardManageIn, FlashcardManageOut

router = APIRouter(prefix="/api/flashcards", tags=["Flashcards"])


def _parse_tag_value(tags: str | None, prefix: str) -> str | None:
    if not tags:
        return None
    for raw_tag in tags.split(","):
        tag = raw_tag.strip()
        if tag.startswith(prefix):
            value = tag[len(prefix) :].strip()
            return value or None
    return None


def _slugify(value: str) -> str:
    return "-".join(part for part in value.lower().replace("/", " ").replace("&", " ").replace("-", " ").split() if part)


def _parse_examples(explanation: str | None) -> tuple[str | None, str | None]:
    if not explanation:
        return None, None
    parts = [part.strip() for part in explanation.split("||")]
    if len(parts) >= 3:
        return parts[1] or None, parts[2] or None
    if len(parts) == 2:
        return parts[0] or None, parts[1] or None
    return explanation.strip() or None, None


def _parse_meta(explanation: str | None) -> str | None:
    if not explanation:
        return None
    first_line = explanation.split("||", 1)[0].strip()
    if first_line:
        return first_line
    return None


def _build_flashcard_explanation(payload: FlashcardManageIn) -> str:
    ipa = payload.ipa.strip() if payload.ipa else ""
    example_en = payload.example_en.strip() if payload.example_en else ""
    example_vi = payload.example_vi.strip() if payload.example_vi else ""
    return f"IPA: {ipa} || {example_en} || {example_vi}"


def _flashcard_category_slug(category: str) -> str:
    slug = _slugify(category)
    return slug or "general"


def _to_manage_out(question: Question) -> FlashcardManageOut:
    meta = _parse_meta(question.explanation)
    example_en, example_vi = _parse_examples(question.explanation)
    ipa = None
    if meta and "IPA:" in meta:
        ipa = meta.split("IPA:", 1)[1].strip() or None

    return FlashcardManageOut(
        id=question.id,
        word=question.content,
        ipa=ipa,
        meaning_vi=question.correct_answer,
        example_en=example_en,
        example_vi=example_vi,
        category=_parse_tag_value(question.tags, "category:") or "general",
        creator_id=question.creator_id,
        created_at=question.created_at,
    )


def _base_query(db: Session, user: User):
    return (
        db.query(ReviewCard, Question)
        .join(Question, ReviewCard.question_id == Question.id)
        .filter(
            ReviewCard.user_id == user.id,
            Question.skill == SkillEnum.reading,
            Question.tags.contains("flashcard_vocab"),
        )
    )


def _to_flashcard(review_card: ReviewCard, question: Question) -> FlashcardOut:
    meta = _parse_meta(question.explanation)
    example_en, example_vi = _parse_examples(question.explanation)
    category = _parse_tag_value(question.tags, "category:")
    difficulty = _parse_tag_value(question.tags, "difficulty:")
    ipa = None
    if meta and "IPA:" in meta:
        after_ipa = meta.split("IPA:", 1)[1].strip()
        if "|" in after_ipa:
            ipa = after_ipa.split("|", 1)[0].strip() or None
        else:
            ipa = after_ipa or None

    return FlashcardOut(
        card_id=review_card.id,
        question_id=question.id,
        word=question.content,
        meaning_vi=question.correct_answer,
        ipa=ipa,
        category=category,
        difficulty=difficulty,
        example_en=example_en,
        example_vi=example_vi,
        due_date=review_card.due_date,
        interval_days=review_card.interval_days,
        ease_factor=review_card.ease_factor,
        repetitions=review_card.repetitions,
    )


@router.get("", response_model=list[FlashcardOut])
def library(
    category: str | None = Query(None),
    difficulty: str | None = Query(None),
    random: bool = Query(False),
    shuffle: bool = Query(False),
    limit: int | None = Query(None, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = _base_query(db, current_user)
    if category:
        query = query.filter(Question.tags.contains(f"category:{_slugify(category)}"))
    if difficulty:
        query = query.filter(Question.tags.contains(f"difficulty:{_slugify(difficulty)}"))

    should_randomize = bool(random or shuffle)

    if should_randomize:
        query = query.order_by(func.random())
    else:
        query = query.order_by(ReviewCard.due_date.asc(), Question.created_at.desc())

    if limit:
        query = query.limit(limit)

    rows = query.all()
    return [_to_flashcard(review_card, question) for review_card, question in rows]


@router.get("/match", response_model=list[FlashcardOut])
def match_game(
    category: str | None = Query(None),
    difficulty: str | None = Query(None),
    random: bool = Query(True),
    shuffle: bool = Query(False),
    limit: int = Query(8, ge=2, le=20),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = _base_query(db, current_user)
    if category:
        query = query.filter(Question.tags.contains(f"category:{_slugify(category)}"))
    if difficulty:
        query = query.filter(Question.tags.contains(f"difficulty:{_slugify(difficulty)}"))

    should_randomize = bool(random or shuffle)

    if should_randomize:
        query = query.order_by(func.random())
    else:
        query = query.order_by(ReviewCard.due_date.asc(), Question.created_at.desc())

    rows = query.limit(limit).all()
    return [_to_flashcard(review_card, question) for review_card, question in rows]


@router.get("/manage", response_model=list[FlashcardManageOut])
def list_manage_flashcards(
    category: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("creator", "admin")),
):
    query = db.query(Question).filter(Question.tags.isnot(None), Question.tags.contains("flashcard_vocab"))
    if current_user.role == "creator":
        query = query.filter(Question.creator_id == current_user.id)
    if category:
        query = query.filter(Question.tags.contains(f"category:{_flashcard_category_slug(category)}"))

    rows = query.order_by(Question.created_at.desc()).all()
    return [_to_manage_out(question) for question in rows]


@router.post("/manage", response_model=FlashcardManageOut, status_code=201)
def create_manage_flashcard(
    payload: FlashcardManageIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("creator", "admin")),
):
    tag_list = ["flashcard_vocab", f"category:{_flashcard_category_slug(payload.category)}"]
    question = Question(
        lesson_id=None,
        skill=SkillEnum.reading,
        part=5,
        level=500,
        q_type=QuestionTypeEnum.fill_blank,
        content=payload.word.strip(),
        options=None,
        correct_answer=payload.meaning_vi.strip(),
        passage=None,
        explanation=_build_flashcard_explanation(payload),
        tags=",".join(tag_list),
        ai_prompt=None,
        audio_url=None,
        status=ContentStatusEnum.approved,
        creator_id=current_user.id,
    )
    db.add(question)
    db.commit()
    db.refresh(question)
    return _to_manage_out(question)


@router.put("/manage/{flashcard_id}", response_model=FlashcardManageOut)
def update_manage_flashcard(
    flashcard_id: int,
    payload: FlashcardManageIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("creator", "admin")),
):
    question = (
        db.query(Question)
        .filter(Question.id == flashcard_id, Question.tags.isnot(None), Question.tags.contains("flashcard_vocab"))
        .first()
    )
    if not question:
        raise HTTPException(status_code=404, detail="Flashcard not found")
    if current_user.role != "admin" and question.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your flashcard")

    question.content = payload.word.strip()
    question.correct_answer = payload.meaning_vi.strip()
    question.explanation = _build_flashcard_explanation(payload)
    question.tags = f"flashcard_vocab,category:{_flashcard_category_slug(payload.category)}"
    db.commit()
    db.refresh(question)
    return _to_manage_out(question)


@router.delete("/manage/{flashcard_id}", status_code=204)
def delete_manage_flashcard(
    flashcard_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("creator", "admin")),
):
    question = (
        db.query(Question)
        .filter(Question.id == flashcard_id, Question.tags.isnot(None), Question.tags.contains("flashcard_vocab"))
        .first()
    )
    if not question:
        raise HTTPException(status_code=404, detail="Flashcard not found")
    if current_user.role != "admin" and question.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your flashcard")

    db.delete(question)
    db.commit()
