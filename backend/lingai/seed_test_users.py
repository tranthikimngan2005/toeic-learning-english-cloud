"""
Seed users from tests/users.sql into the app database.

Usage:
  python seed_test_users.py

Notes:
- Default mode is safe: it does NOT delete existing users.
- Users from tests/users.sql get password: "password".
"""

from pathlib import Path

from app.core.database import Base, SessionLocal, engine
from app.core.security import hash_password
from app.core.time import utc_now_naive
from app.models.user import LevelEnum, RoleEnum, SkillEnum, SkillProfile, Streak, User

SEEDED_PASSWORD = "password"


def _expected_test_accounts() -> list[tuple[str, str, RoleEnum]]:
    accounts = [("admin", "admin@test.com", RoleEnum.admin)]
    accounts.extend(
        (f"creator{i}", f"creator{i}@test.com", RoleEnum.creator)
        for i in range(1, 6)
    )
    accounts.extend(
        (f"user{i}", f"user{i}@test.com", RoleEnum.student)
        for i in range(1, 45)
    )
    return accounts


def _next_available_username(db, base_username: str) -> str:
    if not db.query(User).filter(User.username == base_username).first():
        return base_username

    suffix = 1
    while True:
        candidate = f"{base_username}_test{suffix}"
        if not db.query(User).filter(User.username == candidate).first():
            return candidate
        suffix += 1


def _ensure_expected_test_users() -> int:
    db = SessionLocal()
    created = 0
    try:
        existing_emails = {
            email
            for (email,) in db.query(User.email).filter(User.email.like("%@test.com")).all()
        }

        for username, email, role in _expected_test_accounts():
            if email in existing_emails:
                continue

            db.add(
                User(
                    username=_next_available_username(db, username),
                    email=email,
                    hashed_password=hash_password(SEEDED_PASSWORD),
                    role=role,
                    is_active=True,
                    created_at=utc_now_naive(),
                )
            )
            created += 1

        db.commit()
        return created
    finally:
        db.close()


def _load_sql_script(reset: bool = False) -> str:
    sql_path = Path(__file__).parent / "tests" / "users.sql"
    script = sql_path.read_text(encoding="utf-8")

    if reset:
        return script

    # Safe mode: keep existing data and avoid duplicate insert failures.
    lines = [line for line in script.splitlines() if line.strip().upper() != "DELETE FROM USERS;"]
    script = "\n".join(lines)
    return script.replace("INSERT INTO users", "INSERT OR IGNORE INTO users")


def _ensure_user_profiles_and_streak() -> int:
    db = SessionLocal()
    created_profiles = 0
    try:
        users = db.query(User).filter(User.email.like("%@test.com")).all()
        for user in users:
            existing_skills = {
                row.skill for row in db.query(SkillProfile).filter(SkillProfile.user_id == user.id).all()
            }
            for skill in SkillEnum:
                if skill not in existing_skills:
                    db.add(SkillProfile(user_id=user.id, skill=skill, current_level=LevelEnum.A1))
                    created_profiles += 1

            has_streak = db.query(Streak).filter(Streak.user_id == user.id).first()
            if not has_streak:
                db.add(Streak(user_id=user.id, current_streak=0, longest_streak=0, last_active_date=utc_now_naive()))

        db.commit()
        return created_profiles
    finally:
        db.close()


def seed_users_from_test_sql(reset: bool = False):
    Base.metadata.create_all(bind=engine)
    script = _load_sql_script(reset=reset)
    now = utc_now_naive()

    with engine.begin() as conn:
        conn.connection.driver_connection.executescript(script)
        conn.exec_driver_sql(
            "UPDATE users SET hashed_password = :hashed_pw WHERE email LIKE :pattern",
            {"hashed_pw": hash_password(SEEDED_PASSWORD), "pattern": "%@test.com"},
        )
        conn.exec_driver_sql(
            "UPDATE users SET created_at = :now WHERE created_at IS NULL",
            {"now": now},
        )

    created_users = _ensure_expected_test_users()
    created_profiles = _ensure_user_profiles_and_streak()

    with engine.begin() as conn:
        total_test_users = conn.exec_driver_sql(
            "SELECT COUNT(*) FROM users WHERE email LIKE :pattern",
            {"pattern": "%@test.com"},
        ).scalar_one()

    print("Seed users from tests/users.sql complete")
    print(f"test users in DB: {total_test_users}")
    print(f"missing users created after conflict-check: {created_users}")
    print(f"skill profiles created: {created_profiles}")
    print(f"password for *@test.com users: {SEEDED_PASSWORD}")


if __name__ == "__main__":
    seed_users_from_test_sql(reset=False)
