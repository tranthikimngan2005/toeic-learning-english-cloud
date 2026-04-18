from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.user import User, Lesson, ContentStatusEnum, SkillEnum, LevelEnum
from app.schemas.schemas import LessonCreate, LessonOut, LessonModerate

router = APIRouter(prefix="/api/lessons", tags=["Lessons"])


@router.get("", response_model=list[LessonOut])
def list_lessons(
    skill: Optional[SkillEnum] = Query(None),
    level: Optional[LevelEnum] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Student: only approved content. Creator: own lessons (all statuses). Admin: all lessons.
    q = db.query(Lesson)
    if current_user.role == "student":
        q = q.filter(Lesson.status == ContentStatusEnum.approved)
    elif current_user.role == "creator":
        q = q.filter(Lesson.creator_id == current_user.id)

    if skill:
        q = q.filter(Lesson.skill == skill)
    if level:
        q = q.filter(Lesson.level == level)
    return q.order_by(Lesson.created_at.desc()).all()


@router.get("/{lesson_id}", response_model=LessonOut)
def get_lesson(lesson_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(404, "Lesson not found")
    return lesson


@router.post("", response_model=LessonOut, status_code=201)
def create_lesson(
    payload: LessonCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("creator", "admin")),
):
    lesson = Lesson(**payload.model_dump(), creator_id=current_user.id)
    db.add(lesson)
    db.commit()
    db.refresh(lesson)
    return lesson


@router.put("/{lesson_id}", response_model=LessonOut)
def update_lesson(
    lesson_id: int,
    payload: LessonCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("creator", "admin")),
):
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(404, "Lesson not found")
    if lesson.creator_id != current_user.id and current_user.role != "admin":
        raise HTTPException(403, "Not your lesson")
    for k, v in payload.model_dump().items():
        setattr(lesson, k, v)
    db.commit()
    db.refresh(lesson)
    return lesson


@router.delete("/{lesson_id}", status_code=204)
def delete_lesson(
    lesson_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("creator", "admin")),
):
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(404, "Lesson not found")
    if lesson.creator_id != current_user.id and current_user.role != "admin":
        raise HTTPException(403, "Not your lesson")
    db.delete(lesson)
    db.commit()


@router.patch("/{lesson_id}/moderate", response_model=LessonOut)
def moderate_lesson(
    lesson_id: int,
    payload: LessonModerate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(404, "Lesson not found")
    lesson.status = payload.status
    db.commit()
    db.refresh(lesson)
    return lesson
