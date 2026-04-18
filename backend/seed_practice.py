import json
import sqlite3
from pathlib import Path


def _normalize_level(level):
    # Convert symbolic CEFR levels if present; keep integer TOEIC levels as-is.
    mapping = {
        "A1": 300,
        "A2": 400,
        "B1": 550,
        "B2": 700,
        "C1": 850,
        "C2": 950,
    }
    if isinstance(level, int):
        return level
    if isinstance(level, str):
        level = level.strip()
        if level.isdigit():
            return int(level)
        return mapping.get(level.upper(), 500)
    return 500


def seed_practice_data():
    db_path = Path(__file__).resolve().parent / 'lingai' / 'lingai.db'
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM users WHERE role IN ('creator', 'admin') ORDER BY id LIMIT 1")
    creator_row = cursor.fetchone()
    if not creator_row:
        raise RuntimeError(
            "Không tìm thấy user creator/admin. Hãy chạy seed gốc trước: cd lingai && python seed.py"
        )
    creator_id = creator_row[0]

    # Đọc file data.json mà Ngân vừa bỏ vào
    with open('data.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    for item in data:
        part = item.get('part')
        level = _normalize_level(item.get('level'))

        if part == 5:
            cursor.execute('''
                INSERT INTO questions (
                    skill, part, level, q_type, content, options, correct_answer,
                    passage, explanation, tags, creator_id, status
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                'reading',
                part,
                level,
                'mcq',
                item['question_text'],
                json.dumps(item['options']),
                item['correct_answer'],
                None,
                item['explanation'],
                item.get('tag'),
                creator_id,
                'approved',
            ))

        elif part in [6, 7]:
            # Schema hiện tại lưu passage trực tiếp trong từng question hàng.
            for q in item['questions']:
                cursor.execute('''
                    INSERT INTO questions (
                        skill, part, level, q_type, content, options, correct_answer,
                        passage, explanation, tags, creator_id, status
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    'reading',
                    part,
                    level,
                    'mcq',
                    q['question_text'],
                    json.dumps(q['options']),
                    q['correct_answer'],
                    item['passage'],
                    q['explanation'],
                    q.get('tag', 'Reading-Detail'),
                    creator_id,
                    'approved',
                ))

    conn.commit()
    conn.close()
    print("✅ Ngân ơi, 70 câu hỏi TOEIC đã được nạp thành công vào hệ thống!")


if __name__ == "__main__":
    seed_practice_data()
