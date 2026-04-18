"""Comprehensive TOEIC readiness test suite.

Coverage:
- User authentication (register/login)
- TOEIC Part 5/6/7 data integrity
- Recommendation engine scheduling and filtering
- Performance for fetching 50 questions at once
"""

from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from freezegun import freeze_time
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.core.security import hash_password
from app.core.time import utc_now_naive
from app.main import app
from app.models.user import (
    ContentStatusEnum,
    Question,
    QuestionTypeEnum,
    RoleEnum,
    SkillEnum,
    User,
    UserErrorTrack,
)


TEST_DB_URL = "sqlite:///./test_pengwin.db"
engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
SEEDED_PASSWORD = "password"


def seed_users():
    db = TestSession()
    try:
        now = utc_now_naive()

        admin = db.query(User).filter(User.email == "admin@test.com").first()
        if not admin:
            db.add(
                User(
                    username="admin",
                    email="admin@test.com",
                    hashed_password=hash_password(SEEDED_PASSWORD),
                    role=RoleEnum.admin,
                    created_at=now,
                )
            )

        creator = db.query(User).filter(User.email == "creator1@test.com").first()
        if not creator:
            db.add(
                User(
                    username="creator1",
                    email="creator1@test.com",
                    hashed_password=hash_password(SEEDED_PASSWORD),
                    role=RoleEnum.creator,
                    created_at=now,
                )
            )

        db.commit()
    finally:
        db.close()


def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    seed_users()
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    return TestClient(app)


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def login_seeded(client, email: str, password: str = SEEDED_PASSWORD):
    response = client.post(
        "/api/auth/login",
        data={"username": email, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def register_and_login(client, username: str, email: str, password: str = "secret123"):
    register_response = client.post(
        "/api/auth/register",
        json={"username": username, "email": email, "password": password},
    )
    assert register_response.status_code == 201, register_response.text

    login_response = client.post(
        "/api/auth/login",
        data={"username": email, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert login_response.status_code == 200, login_response.text
    return login_response.json()["access_token"]


def register_creator(client):
    return login_seeded(client, "creator1@test.com")


def create_toeic_question(client, creator_token: str, payload: dict):
    response = client.post("/api/questions", json=payload, headers=auth_headers(creator_token))
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["part"] == payload["part"]
    assert data["level"] == payload["level"]
    assert data["tags"] == payload["tags"]
    return data


def get_user_id(email: str) -> int:
    db = TestSession()
    try:
        user = db.query(User).filter(User.email == email).first()
        assert user is not None
        return user.id
    finally:
        db.close()


class TestAuth:
    def test_register_and_login_success(self, client):
        token = register_and_login(client, "alice", "alice@test.com", "pass1234")
        assert token

    def test_register_duplicate_email_fails(self, client):
        client.post(
            "/api/auth/register",
            json={"username": "u1", "email": "dup@test.com", "password": "secret123"},
        )
        response = client.post(
            "/api/auth/register",
            json={"username": "u2", "email": "dup@test.com", "password": "secret123"},
        )
        assert response.status_code == 400

    def test_login_with_wrong_password_fails(self, client):
        client.post(
            "/api/auth/register",
            json={"username": "bob", "email": "bob@test.com", "password": "secret123"},
        )
        response = client.post(
            "/api/auth/login",
            data={"username": "bob@test.com", "password": "wrong"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        assert response.status_code == 401


class TestToeicDataIntegrity:
    def test_part7_long_passage_with_multiple_sub_questions_saved_and_retrieved(self, client):
        creator_token = register_creator(client)

        long_passage = (
            "Dear Customers, thank you for your continued support. "
            "Pengwin Language Center will relocate to a larger building near City Hall next month. "
            "All classes and services will continue during the transition. "
            "Please check your email for updated schedules and room assignments. "
            "We appreciate your patience and look forward to welcoming you to our new space."
        ) * 3

        sub_questions = [
            {
                "content": "What is the main purpose of this notice?",
                "options": ["To announce a relocation", "To close operations", "To hire new staff", "To reduce services"],
                "correct_answer": "To announce a relocation",
                "explanation": "The notice repeatedly mentions moving to a new location.",
                "tags": "Reading-MainIdea",
            },
            {
                "content": "What should students do for updates?",
                "options": ["Visit City Hall", "Wait for phone calls", "Check email", "Cancel classes"],
                "correct_answer": "Check email",
                "explanation": "The passage says to check email for schedules and room assignments.",
                "tags": "Reading-Details",
            },
            {
                "content": "How does the center describe its services during transition?",
                "options": ["Partially paused", "Fully stopped", "Continued", "Unknown"],
                "correct_answer": "Continued",
                "explanation": "It states that classes and services will continue.",
                "tags": "Reading-Inference",
            },
        ]

        created_ids = []
        for sq in sub_questions:
            created = create_toeic_question(
                client,
                creator_token,
                {
                    "skill": "reading",
                    "part": 7,
                    "level": 900,
                    "tags": sq["tags"],
                    "q_type": "mcq",
                    "content": sq["content"],
                    "options": sq["options"],
                    "correct_answer": sq["correct_answer"],
                    "passage": long_passage,
                    "explanation": sq["explanation"],
                },
            )
            created_ids.append(created["id"])

        list_response = client.get("/api/questions?skill=reading", headers=auth_headers(creator_token))
        assert list_response.status_code == 200, list_response.text
        rows = [r for r in list_response.json() if r["id"] in created_ids]
        assert len(rows) == 3

        by_id = {r["id"]: r for r in rows}
        for sq, qid in zip(sub_questions, created_ids):
            row = by_id[qid]
            assert row["part"] == 7
            assert row["level"] == 900
            assert row["passage"] == long_passage
            assert row["explanation"] == sq["explanation"]
            assert row["tags"] == sq["tags"]


class TestRecommendationEngine:
    def test_three_day_rule_second_failure_then_review_success(self, client):
        creator_token = register_creator(client)
        student_token = register_and_login(client, "rec_student", "rec_student@test.com")
        student_id = get_user_id("rec_student@test.com")

        grammar_q = create_toeic_question(
            client,
            creator_token,
            {
                "skill": "reading",
                "part": 5,
                "level": 500,
                "tags": "Grammar-Tenses",
                "q_type": "mcq",
                "content": "She _____ the report yesterday.",
                "options": ["write", "writes", "wrote", "writing"],
                "correct_answer": "wrote",
                "explanation": "Past simple is required due to 'yesterday'.",
            },
        )

        with freeze_time("2026-04-17 09:00:00"):
            first_submit = client.post(
                "/api/questions/practice/submit",
                json={"question_id": grammar_q["id"], "user_answer": "writes"},
                headers=auth_headers(student_token),
            )
            assert first_submit.status_code == 200, first_submit.text

            db = TestSession()
            try:
                track = (
                    db.query(UserErrorTrack)
                    .filter(
                        UserErrorTrack.user_id == student_id,
                        UserErrorTrack.question_id == grammar_q["id"],
                    )
                    .first()
                )
                assert track is not None
                assert track.next_review == utc_now_naive() + timedelta(days=3)
                assert track.error_count == 1
            finally:
                db.close()

        with freeze_time("2026-04-18 10:00:00"):
            second_submit = client.post(
                "/api/questions/practice/submit",
                json={"question_id": grammar_q["id"], "user_answer": "writes"},
                headers=auth_headers(student_token),
            )
            assert second_submit.status_code == 200, second_submit.text

            db = TestSession()
            try:
                track = (
                    db.query(UserErrorTrack)
                    .filter(
                        UserErrorTrack.user_id == student_id,
                        UserErrorTrack.question_id == grammar_q["id"],
                    )
                    .first()
                )
                assert track is not None
                assert track.error_count == 2
                assert track.next_review == utc_now_naive() + timedelta(days=1)
            finally:
                db.close()

        with freeze_time("2026-04-19 10:00:00"):
            success_submit = client.post(
                "/api/questions/practice/submit",
                json={"question_id": grammar_q["id"], "user_answer": "wrote"},
                headers=auth_headers(student_token),
            )
            assert success_submit.status_code == 200, success_submit.text

            db = TestSession()
            try:
                track = (
                    db.query(UserErrorTrack)
                    .filter(
                        UserErrorTrack.user_id == student_id,
                        UserErrorTrack.question_id == grammar_q["id"],
                    )
                    .first()
                )
                assert track is not None
                if track.status == "mastered":
                    assert track.next_review is None
                else:
                    assert track.status == "pending"
                    assert track.next_review == utc_now_naive() + timedelta(days=7)
            finally:
                db.close()

    def test_recommendation_endpoint_filters_only_due_questions(self, client):
        creator_token = register_creator(client)
        student_token = register_and_login(client, "filter_student", "filter_student@test.com")
        student_id = get_user_id("filter_student@test.com")

        due_q = create_toeic_question(
            client,
            creator_token,
            {
                "skill": "reading",
                "part": 5,
                "level": 500,
                "tags": "Grammar-Tenses",
                "q_type": "mcq",
                "content": "The manager _____ the memo yesterday.",
                "options": ["send", "sent", "sending", "sends"],
                "correct_answer": "sent",
                "explanation": "Past simple is required due to 'yesterday'.",
            },
        )
        future_q = create_toeic_question(
            client,
            creator_token,
            {
                "skill": "reading",
                "part": 7,
                "level": 750,
                "tags": "Reading-MainIdea",
                "q_type": "mcq",
                "content": "What is this email mainly about?",
                "options": ["Relocation", "Hiring", "Closure", "Discount"],
                "correct_answer": "Relocation",
                "passage": "This email announces that the office is moving next month.",
                "explanation": "The email states a relocation plan.",
            },
        )

        with freeze_time("2026-04-20 08:00:00"):
            now = utc_now_naive()
            db = TestSession()
            try:
                db.add_all(
                    [
                        UserErrorTrack(
                            user_id=student_id,
                            question_id=due_q["id"],
                            error_count=1,
                            last_attempt=now,
                            next_review=now - timedelta(minutes=1),
                            status="pending",
                        ),
                        UserErrorTrack(
                            user_id=student_id,
                            question_id=future_q["id"],
                            error_count=1,
                            last_attempt=now,
                            next_review=now + timedelta(days=2),
                            status="pending",
                        ),
                    ]
                )
                db.commit()
            finally:
                db.close()

            response = client.get("/api/questions/recommendations", headers=auth_headers(student_token))
            assert response.status_code == 200, response.text
            data = response.json()
            assert len(data) == 1
            assert data[0]["question"]["id"] == due_q["id"]
            assert data[0]["question"]["part"] == 5
            assert data[0]["question"]["level"] == 500
            assert data[0]["question"]["tags"] == "Grammar-Tenses"


class TestPerformance:
    def test_can_fetch_50_questions_at_once(self, client):
        creator_token = register_creator(client)
        student_token = register_and_login(client, "perf_student", "perf_student@test.com")

        db = TestSession()
        try:
            creator = db.query(User).filter(User.email == "creator1@test.com").first()
            assert creator is not None

            questions = []
            for idx in range(60):
                questions.append(
                    Question(
                        lesson_id=None,
                        skill=SkillEnum.reading,
                        part=5,
                        level=500,
                        q_type=QuestionTypeEnum.mcq,
                        content=f"Performance question {idx}?",
                        options=["A", "B", "C", "D"],
                        correct_answer="A",
                        passage=None,
                        explanation="Performance test item.",
                        tags="Perf-Batch",
                        status=ContentStatusEnum.approved,
                        creator_id=creator.id,
                    )
                )
            db.add_all(questions)
            db.commit()
        finally:
            db.close()

        response = client.post(
            "/api/questions/practice/start",
            json={"skill": "reading", "count": 50},
            headers=auth_headers(student_token),
        )
        assert response.status_code == 200, response.text
        data = response.json()
        assert "questions" in data
        assert len(data["questions"]) == 50
