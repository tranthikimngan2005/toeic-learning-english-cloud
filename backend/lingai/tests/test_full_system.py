"""Full system integration test for TOEIC readiness user flow."""

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


TEST_DB_URL = "sqlite:///./test_full_system.db"
engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _seed_core_data() -> dict[str, int]:
    db = TestSession()
    try:
        creator = User(
            username="creator_seed",
            email="creator_seed@test.com",
            hashed_password=hash_password("creator123"),
            role=RoleEnum.creator,
        )
        db.add(creator)
        db.flush()

        q_correct = Question(
            lesson_id=None,
            skill=SkillEnum.reading,
            part=5,
            level=500,
            q_type=QuestionTypeEnum.mcq,
            content="She _____ the report yesterday.",
            options=["write", "writes", "wrote", "writing"],
            correct_answer="wrote",
            passage=None,
            explanation="Use past simple because of 'yesterday'.",
            tags="Grammar-Tenses",
            status=ContentStatusEnum.approved,
            creator_id=creator.id,
        )
        q_wrong = Question(
            lesson_id=None,
            skill=SkillEnum.reading,
            part=7,
            level=750,
            q_type=QuestionTypeEnum.mcq,
            content="What is the purpose of the notice?",
            options=["To announce relocation", "To close", "To hire", "To sell"],
            correct_answer="To announce relocation",
            passage="Dear customers, we are moving to a new office next month.",
            explanation="The notice clearly announces relocation.",
            tags="Reading-MainIdea",
            status=ContentStatusEnum.approved,
            creator_id=creator.id,
        )
        db.add_all([q_correct, q_wrong])
        db.commit()
        db.refresh(q_correct)
        db.refresh(q_wrong)
        return {"q_correct_id": q_correct.id, "q_wrong_id": q_wrong.id}
    finally:
        db.close()


@pytest.fixture
def test_client():
    return TestClient(app)


@pytest.fixture(autouse=True)
def isolated_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def seeded_ids():
    return _seed_core_data()


def _register_user(client: TestClient, username: str = "full_user", email: str = "full_user@test.com", password: str = "secret123"):
    response = client.post(
        "/api/auth/register",
        json={"username": username, "email": email, "password": password},
    )
    return response


def _login_user(client: TestClient, username_or_email: str = "full_user@test.com", password: str = "secret123"):
    response = client.post(
        "/api/auth/login",
        data={"username": username_or_email, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    return response


def _register_and_login(client: TestClient) -> tuple[str, str]:
    username = "full_user"
    email = "full_user@test.com"
    register_response = _register_user(client, username=username, email=email)
    assert register_response.status_code == 201, register_response.text

    login_response = _login_user(client, username_or_email=email)
    assert login_response.status_code == 200, login_response.text
    token = login_response.json()["access_token"]
    return token, email


def test_user_registration(test_client: TestClient):
    response = _register_user(test_client)
    assert response.status_code == 201, response.text
    data = response.json()
    assert "access_token" in data
    assert data["username"] == "full_user"


def test_user_login(test_client: TestClient):
    register_response = _register_user(test_client)
    assert register_response.status_code == 201, register_response.text

    login_response = _login_user(test_client)
    assert login_response.status_code == 200, login_response.text
    data = login_response.json()
    assert "access_token" in data


def test_fetch_toeic_questions(test_client: TestClient, seeded_ids: dict[str, int]):
    token, _ = _register_and_login(test_client)
    headers = _auth_headers(token)

    start_response = test_client.post(
        "/api/questions/practice/start",
        json={"skill": "reading", "count": 10},
        headers=headers,
    )
    assert start_response.status_code == 200, start_response.text
    question_list = start_response.json()["questions"]
    assert len(question_list) >= 2
    assert any(q["id"] == seeded_ids["q_correct_id"] for q in question_list)
    assert any(q["id"] == seeded_ids["q_wrong_id"] for q in question_list)
    assert all("part" in q for q in question_list)
    assert all("level" in q for q in question_list)


def test_submit_answer(test_client: TestClient, seeded_ids: dict[str, int]):
    token, user_email = _register_and_login(test_client)
    headers = _auth_headers(token)

    correct_submit = test_client.post(
        "/api/questions/practice/submit",
        json={"question_id": seeded_ids["q_correct_id"], "user_answer": "wrote"},
        headers=headers,
    )
    assert correct_submit.status_code == 200, correct_submit.text
    assert correct_submit.json()["is_correct"] is True

    with freeze_time("2026-04-17 09:00:00"):
        wrong_submit = test_client.post(
            "/api/questions/practice/submit",
            json={"question_id": seeded_ids["q_wrong_id"], "user_answer": "To close"},
            headers=headers,
        )
        assert wrong_submit.status_code == 200, wrong_submit.text
        assert wrong_submit.json()["is_correct"] is False

        db = TestSession()
        try:
            user_id = db.query(User).filter(User.email == user_email).first().id
            track = (
                db.query(UserErrorTrack)
                .filter(
                    UserErrorTrack.user_id == user_id,
                    UserErrorTrack.question_id == seeded_ids["q_wrong_id"],
                )
                .first()
            )
            assert track is not None
            assert track.next_review == utc_now_naive() + timedelta(days=3)
        finally:
            db.close()


def test_recommendation_logic(test_client: TestClient, seeded_ids: dict[str, int]):
    token, user_email = _register_and_login(test_client)
    headers = _auth_headers(token)

    with freeze_time("2026-04-17 09:00:00"):
        wrong_submit = test_client.post(
            "/api/questions/practice/submit",
            json={"question_id": seeded_ids["q_wrong_id"], "user_answer": "To close"},
            headers=headers,
        )
        assert wrong_submit.status_code == 200, wrong_submit.text

    with freeze_time("2026-04-21 09:00:00"):
        rec_response = test_client.get("/api/questions/recommendations", headers=headers)
    assert rec_response.status_code == 200, rec_response.text
    rec_data = rec_response.json()
    assert any(item["question"]["id"] == seeded_ids["q_wrong_id"] for item in rec_data)

    with freeze_time("2026-04-21 09:00:00"):
        correct_submit = test_client.post(
            "/api/questions/practice/submit",
            json={"question_id": seeded_ids["q_wrong_id"], "user_answer": "To announce relocation"},
            headers=headers,
        )
    assert correct_submit.status_code == 200, correct_submit.text
    assert correct_submit.json()["is_correct"] is True

    dashboard_response = test_client.get("/api/users/me/dashboard", headers=headers)
    assert dashboard_response.status_code == 200, dashboard_response.text
    dashboard = dashboard_response.json()
    assert dashboard["streak"]["current_streak"] >= 1
    assert dashboard["total_questions_done"] >= 2

