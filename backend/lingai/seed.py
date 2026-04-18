"""
Seed script â€” populates Pengwin DB with sample data for dev/demo.
Run: python seed.py
"""
import sys
sys.path.insert(0, ".")

from app.core.database import Base, engine, SessionLocal
from app.core.security import hash_password
from app.models.user import (
    User, SkillProfile, Streak, Lesson, Question, ReviewCard,
    RoleEnum, SkillEnum, LevelEnum, QuestionTypeEnum, ContentStatusEnum,
)
from datetime import timedelta
from app.core.time import utc_now_naive

Base.metadata.create_all(bind=engine)
db = SessionLocal()


def create_user(username, email, password, role=RoleEnum.student):
    existing = (
        db.query(User)
        .filter((User.email == email) | (User.username == username))
        .first()
    )

    if existing:
        # Keep seed accounts consistent even if a placeholder account already exists.
        existing.username = username
        existing.email = email
        existing.role = role
        existing.is_active = True
        existing.hashed_password = hash_password(password)
        db.flush()
        u = existing
    else:
        u = User(username=username, email=email, hashed_password=hash_password(password), role=role)
        db.add(u)
        db.flush()

    # Ensure baseline profiles/streak exist for idempotent re-seeding.
    existing_skills = {p.skill for p in db.query(SkillProfile).filter(SkillProfile.user_id == u.id).all()}
    for skill in SkillEnum:
        if skill not in existing_skills:
            db.add(SkillProfile(user_id=u.id, skill=skill, current_level=LevelEnum.A2))

    existing_streak = db.query(Streak).filter(Streak.user_id == u.id).first()
    if not existing_streak:
        db.add(Streak(user_id=u.id, current_streak=7, longest_streak=14,
                      last_active_date=utc_now_naive()))

    return u


print("Creating users...")
admin   = create_user("admin",    "admin@pengwin.com",   "admin123",   RoleEnum.admin)
creator = create_user("creator1", "creator@pengwin.com", "creator123", RoleEnum.creator)
student = create_user("an",       "an@pengwin.com",      "student123", RoleEnum.student)
db.commit()

print("Creating lessons...")
lessons_data = [
    ("Reading Comprehension B1", SkillEnum.reading,   LevelEnum.B1,
     "In this lesson you will practice reading academic texts and identifying main ideas, supporting details, and the author's purpose."),
    ("Listening for Gist A2",    SkillEnum.listening, LevelEnum.A2,
     "Practice listening to short dialogues and identifying the main topic and key information."),
    ("Writing Paragraphs B1",    SkillEnum.writing,   LevelEnum.B1,
     "Learn how to structure a well-developed paragraph with a topic sentence, supporting sentences, and a concluding sentence."),
    ("Speaking Fluency A2",      SkillEnum.speaking,  LevelEnum.A2,
     "Practice speaking about familiar topics such as family, hobbies, and daily routines."),
]
lesson_objs = []
for title, skill, level, content in lessons_data:
    l = Lesson(title=title, skill=skill, level=level, content=content,
               status=ContentStatusEnum.approved, creator_id=creator.id)
    db.add(l)
    lesson_objs.append(l)
db.commit()

print("Creating questions...")
questions_data = [
    # Reading MCQ
    dict(skill=SkillEnum.reading, level=LevelEnum.B1, q_type=QuestionTypeEnum.mcq,
         content="The author suggests that language acquisition is most effective when learners are _____ in authentic communicative situations rather than memorizing isolated vocabulary.",
         options=["tested", "corrected", "immersed", "evaluated"],
         correct_answer="immersed",
         explanation="'Immersed' fits â€” the author stresses authentic communication over rote memorization. 'Authentic communicative situations' is the key clue.",
         status=ContentStatusEnum.approved),
    dict(skill=SkillEnum.reading, level=LevelEnum.B1, q_type=QuestionTypeEnum.mcq,
         content="Which word is closest in meaning to 'ubiquitous'?",
         options=["rare", "widespread", "ancient", "expensive"],
         correct_answer="widespread",
         explanation="'Ubiquitous' means present or found everywhere â€” synonymous with widespread.",
         status=ContentStatusEnum.approved),
    dict(skill=SkillEnum.reading, level=LevelEnum.A2, q_type=QuestionTypeEnum.mcq,
         content="She felt _____ after winning the competition.",
         options=["devastated", "elated", "confused", "bored"],
         correct_answer="elated",
         explanation="'Elated' means extremely happy â€” fits the context of winning.",
         status=ContentStatusEnum.approved),
    # Fill blank
    dict(skill=SkillEnum.writing, level=LevelEnum.A2, q_type=QuestionTypeEnum.fill_blank,
         content="She ___ (go) to the market every Saturday.",
         options=None,
         correct_answer="goes",
         explanation="Third person singular, present simple â€” add -es to 'go'.",
         status=ContentStatusEnum.approved),
    dict(skill=SkillEnum.writing, level=LevelEnum.B1, q_type=QuestionTypeEnum.fill_blank,
         content="By the time they arrived, the film _____ (already / start).",
         options=None,
         correct_answer="had already started",
         explanation="Past perfect is used for an action completed before another past action.",
         status=ContentStatusEnum.approved),
    # Listening MCQ
    dict(skill=SkillEnum.listening, level=LevelEnum.A2, q_type=QuestionTypeEnum.mcq,
         content="[Audio] The speakers are discussing plans for the weekend. What will they do on Saturday?",
         options=["Go hiking", "Watch a movie", "Visit family", "Stay home"],
         correct_answer="Watch a movie",
         explanation="The man mentions 'the new thriller at the cinema on Saturday'.",
         audio_url="/audio/sample_a2_01.mp3",
         status=ContentStatusEnum.approved),
    # Writing prompt
    dict(skill=SkillEnum.writing, level=LevelEnum.B1, q_type=QuestionTypeEnum.writing,
         content="Write 3-5 sentences describing your ideal holiday destination and why you would choose it.",
         options=None,
         correct_answer="[AI evaluated]",
         explanation=None,
         ai_prompt="Evaluate this English writing response for grammar, vocabulary range, and coherence. Give a score out of 10 and specific improvement tips.",
         status=ContentStatusEnum.approved),
    # Pending (for admin moderation demo)
    dict(skill=SkillEnum.reading, level=LevelEnum.C1, q_type=QuestionTypeEnum.mcq,
         content="The passage implies that the author's primary concern is _____.",
         options=["economic growth", "environmental sustainability", "political stability", "cultural preservation"],
         correct_answer="environmental sustainability",
         explanation="The passage repeatedly emphasizes ecological impact.",
         status=ContentStatusEnum.pending),
]

question_objs = []
level_to_score = {
    LevelEnum.A1: 300,
    LevelEnum.A2: 400,
    LevelEnum.B1: 550,
    LevelEnum.B2: 700,
    LevelEnum.C1: 850,
    LevelEnum.C2: 950,
}
for i, qd in enumerate(questions_data):
    audio_url = qd.pop("audio_url", None)
    qd["part"] = int(qd.get("part", 5))
    if isinstance(qd.get("level"), LevelEnum):
        qd["level"] = level_to_score.get(qd["level"], 500)
    qd["explanation"] = qd.get("explanation") or "AI-graded free response."
    q = Question(**qd, creator_id=creator.id, audio_url=audio_url,
                 lesson_id=lesson_objs[0].id if i < 3 else None)
    db.add(q)
    question_objs.append(q)
db.commit()

print("Creating review cards for student...")
for q in question_objs[:4]:
    due = utc_now_naive() - timedelta(hours=1)  # make them due now
    card = ReviewCard(
        user_id=student.id,
        question_id=q.id,
        interval_days=1,
        ease_factor=2.5,
        repetitions=1,
        due_date=due,
        last_reviewed=utc_now_naive() - timedelta(days=1),
    )
    db.add(card)

# Update student skill profile to look realistic
for profile in db.query(SkillProfile).filter(SkillProfile.user_id == student.id).all():
    profile.questions_done   = 30
    profile.questions_correct = 22
    profile.current_level = LevelEnum.B1

db.commit()

print("\nâœ… Seed complete!")
print("â”€" * 40)
print("ðŸ‘¤ Users created:")
print("  admin@pengwin.com   / admin123   (admin)")
print("  creator@pengwin.com / creator123 (creator)")
print("  an@pengwin.com      / student123 (student)")
print(f"\nðŸ“š {len(lesson_objs)} lessons, {len(question_objs)} questions seeded")
print("ðŸƒ 4 review cards due NOW for student account")

