import random
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import bcrypt


DB_PATH = Path(__file__).resolve().parent / "lingai" / "lingai.db"


def _build_username(index: int) -> str:
    ho = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Phan", "Vũ", "Đặng", "Bùi", "Đỗ"]
    ten_dem = ["Văn", "Thị", "Anh", "Minh", "Đức", "Thanh", "Ngọc", "Hoàng", "Kim"]
    ten = ["An", "Ngân", "Sang", "Linh", "Minh", "Tuấn", "Lan", "Hương", "Hùng", "Trang", "Dũng", "Phương", "Nam", "Quỳnh"]
    return f"{random.choice(ho)} {random.choice(ten_dem)} {random.choice(ten)} {index:02d}"


def _now_string() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat(sep=" ")


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _seed_skill_profiles(cursor, user_id: int):
    for skill in ["reading", "listening", "writing", "speaking"]:
        current_level = random.choice(["A1", "A2", "B1", "B2", "C1", "C2"])
        questions_done = random.randint(0, 500)
        questions_correct = random.randint(0, questions_done) if questions_done else 0
        cursor.execute(
            """
            INSERT INTO skill_profiles (user_id, skill, current_level, questions_done, questions_correct, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (user_id, skill, current_level, questions_done, questions_correct, _now_string()),
        )


def seed_50_users():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM users WHERE role = ?", ("student",))
    student_ids = [row[0] for row in cursor.fetchall()]

    if student_ids:
        placeholders = ",".join(["?"] * len(student_ids))
        for table in ["skill_profiles", "streaks", "question_attempts", "review_cards", "user_error_tracks", "chat_messages"]:
            cursor.execute(f"DELETE FROM {table} WHERE user_id IN ({placeholders})", student_ids)
        cursor.execute(f"DELETE FROM users WHERE id IN ({placeholders})", student_ids)

    used_usernames = {row[0] for row in cursor.execute("SELECT username FROM users").fetchall()}
    used_emails = {row[0] for row in cursor.execute("SELECT email FROM users").fetchall()}

    created_count = 0
    for index in range(1, 51):
        username = _build_username(index)
        email = f"user{index:02d}@pengwin.com"

        suffix = 1
        base_username = username
        while username in used_usernames:
            suffix += 1
            username = f"{base_username} {suffix}"

        while email in used_emails:
            index += 1
            email = f"user{index:02d}@pengwin.com"

        used_usernames.add(username)
        used_emails.add(email)

        cursor.execute(
            """
            INSERT INTO users (username, email, hashed_password, role, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (username, email, _hash_password("password"), "student", 1, _now_string()),
        )
        user_id = cursor.lastrowid

        _seed_skill_profiles(cursor, user_id)

        cursor.execute(
            """
            INSERT INTO streaks (user_id, current_streak, longest_streak, last_active_date)
            VALUES (?, ?, ?, ?)
            """,
            (user_id, random.randint(0, 30), random.randint(0, 30), _now_string()),
        )
        created_count += 1

    conn.commit()
    conn.close()
    print(f"✅ Đã nạp xong {created_count} user student vào hệ thống.")
    print("🔐 Password mặc định cho các user mới: password")


if __name__ == "__main__":
    seed_50_users()
