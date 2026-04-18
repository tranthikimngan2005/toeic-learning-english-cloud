"""
All database models for Pengwin.
"""
import enum
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Float,
    ForeignKey, Enum, Text, JSON
)
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.core.time import utc_now_naive


# ──────────────────────────────────────────────
# Enums
# ──────────────────────────────────────────────

class RoleEnum(str, enum.Enum):
    student = "student"
    creator = "creator"
    admin = "admin"


class SkillEnum(str, enum.Enum):
    reading = "reading"
    listening = "listening"
    writing = "writing"
    speaking = "speaking"


class LevelEnum(str, enum.Enum):
    A1 = "A1"
    A2 = "A2"
    B1 = "B1"
    B2 = "B2"
    C1 = "C1"
    C2 = "C2"


class QuestionTypeEnum(str, enum.Enum):
    mcq = "mcq"
    fill_blank = "fill_blank"
    writing = "writing"
    speaking = "speaking"


class ContentStatusEnum(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class ReviewResultEnum(str, enum.Enum):
    again = "again"
    hard = "hard"
    good = "good"
    easy = "easy"


# ──────────────────────────────────────────────
# User
# ──────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True, index=True)
    username      = Column(String(50), unique=True, nullable=False, index=True)
    email         = Column(String(120), unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    role          = Column(Enum(RoleEnum), default=RoleEnum.student, nullable=False)
    is_active     = Column(Boolean, default=True)
    created_at    = Column(DateTime, default=utc_now_naive)

    # relationships
    skill_profiles  = relationship("SkillProfile", back_populates="user", cascade="all, delete-orphan")
    attempts        = relationship("QuestionAttempt", back_populates="user", cascade="all, delete-orphan")
    review_cards    = relationship("ReviewCard", back_populates="user", cascade="all, delete-orphan")
    error_tracks    = relationship("UserErrorTrack", back_populates="user", cascade="all, delete-orphan")
    streak          = relationship("Streak", back_populates="user", uselist=False, cascade="all, delete-orphan")
    chat_messages   = relationship("ChatMessage", back_populates="user", cascade="all, delete-orphan")


# ──────────────────────────────────────────────
# Skill Profile (per user per skill)
# ──────────────────────────────────────────────

class SkillProfile(Base):
    __tablename__ = "skill_profiles"

    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(Integer, ForeignKey("users.id"), nullable=False)
    skill         = Column(Enum(SkillEnum), nullable=False)
    current_level = Column(Enum(LevelEnum), default=LevelEnum.A1)
    questions_done= Column(Integer, default=0)
    questions_correct = Column(Integer, default=0)
    updated_at    = Column(DateTime, default=utc_now_naive, onupdate=utc_now_naive)

    user = relationship("User", back_populates="skill_profiles")

    @property
    def accuracy(self) -> float:
        if self.questions_done == 0:
            return 0.0
        return round(self.questions_correct / self.questions_done * 100, 1)


# ──────────────────────────────────────────────
# Lesson
# ──────────────────────────────────────────────

class Lesson(Base):
    __tablename__ = "lessons"

    id          = Column(Integer, primary_key=True, index=True)
    title       = Column(String(200), nullable=False)
    skill       = Column(Enum(SkillEnum), nullable=False)
    level       = Column(Enum(LevelEnum), nullable=False)
    content     = Column(Text, nullable=False)
    audio_url   = Column(String, nullable=True)   # for listening
    status      = Column(Enum(ContentStatusEnum), default=ContentStatusEnum.pending)
    creator_id  = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at  = Column(DateTime, default=utc_now_naive)

    creator     = relationship("User")
    questions   = relationship("Question", back_populates="lesson")


# ──────────────────────────────────────────────
# Question
# ──────────────────────────────────────────────

class Question(Base):
    __tablename__ = "questions"

    id            = Column(Integer, primary_key=True, index=True)
    lesson_id     = Column(Integer, ForeignKey("lessons.id"), nullable=True)
    skill         = Column(Enum(SkillEnum), nullable=False)
    part          = Column(Integer, nullable=False)          # TOEIC Reading part: 5, 6, 7
    level         = Column(Integer, nullable=False)          # TOEIC target score: 300, 500, 750, 900
    q_type        = Column(Enum(QuestionTypeEnum), nullable=False)
    content       = Column(Text, nullable=False)       # question text
    options       = Column(JSON, nullable=True)        # ["A","B","C","D"] for MCQ
    correct_answer= Column(Text, nullable=False)
    passage       = Column(Text, nullable=True)              # optional, mainly for Part 6/7
    explanation   = Column(Text, nullable=False)
    tags          = Column(String(255), nullable=True)       # e.g. Grammar-Tenses
    ai_prompt     = Column(Text, nullable=True)        # for writing/speaking AI eval
    audio_url     = Column(String, nullable=True)      # for listening
    status        = Column(Enum(ContentStatusEnum), default=ContentStatusEnum.pending)
    creator_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at    = Column(DateTime, default=utc_now_naive)

    lesson        = relationship("Lesson", back_populates="questions")
    creator       = relationship("User")
    attempts      = relationship("QuestionAttempt", back_populates="question")
    review_cards  = relationship("ReviewCard", back_populates="question")
    error_tracks  = relationship("UserErrorTrack", back_populates="question", cascade="all, delete-orphan")


# ──────────────────────────────────────────────
# Question Attempt (practice history)
# ──────────────────────────────────────────────

class QuestionAttempt(Base):
    __tablename__ = "question_attempts"

    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(Integer, ForeignKey("users.id"), nullable=False)
    question_id   = Column(Integer, ForeignKey("questions.id"), nullable=False)
    user_answer   = Column(Text, nullable=False)
    is_correct    = Column(Boolean, nullable=False)
    ai_feedback   = Column(Text, nullable=True)
    attempted_at  = Column(DateTime, default=utc_now_naive)

    user     = relationship("User", back_populates="attempts")
    question = relationship("Question", back_populates="attempts")


# ──────────────────────────────────────────────
# User Error Track
# ──────────────────────────────────────────────

class UserErrorTrack(Base):
    __tablename__ = "user_error_tracks"

    id           = Column(Integer, primary_key=True, index=True)
    user_id      = Column(Integer, ForeignKey("users.id"), nullable=False)
    question_id  = Column(Integer, ForeignKey("questions.id"), nullable=False)
    error_count  = Column(Integer, default=1, nullable=False)
    last_attempt = Column(DateTime, default=utc_now_naive, nullable=False)
    next_review  = Column(DateTime, nullable=True)
    status       = Column(String(50), default="pending", nullable=False)

    user         = relationship("User", back_populates="error_tracks")
    question     = relationship("Question", back_populates="error_tracks")


# ──────────────────────────────────────────────
# Spaced Repetition Card (SM-2 like)
# ──────────────────────────────────────────────

class ReviewCard(Base):
    __tablename__ = "review_cards"

    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(Integer, ForeignKey("users.id"), nullable=False)
    question_id   = Column(Integer, ForeignKey("questions.id"), nullable=False)
    interval_days = Column(Integer, default=1)      # next review in N days
    ease_factor   = Column(Float, default=2.5)      # SM-2 ease
    repetitions   = Column(Integer, default=0)
    due_date      = Column(DateTime, default=utc_now_naive)
    last_reviewed = Column(DateTime, nullable=True)

    user     = relationship("User", back_populates="review_cards")
    question = relationship("Question", back_populates="review_cards")


# ──────────────────────────────────────────────
# Streak
# ──────────────────────────────────────────────

class Streak(Base):
    __tablename__ = "streaks"

    id              = Column(Integer, primary_key=True, index=True)
    user_id         = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    current_streak  = Column(Integer, default=0)
    longest_streak  = Column(Integer, default=0)
    last_active_date= Column(DateTime, nullable=True)

    user = relationship("User", back_populates="streak")


# ──────────────────────────────────────────────
# AI Chat Message
# ──────────────────────────────────────────────

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False)
    role        = Column(String(10), nullable=False)   # "user" | "assistant"
    content     = Column(Text, nullable=False)
    created_at  = Column(DateTime, default=utc_now_naive)

    user = relationship("User", back_populates="chat_messages")
