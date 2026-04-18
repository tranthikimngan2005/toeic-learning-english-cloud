#!/usr/bin/env python
"""
Script to seed questions from question.sql into the production database.
Usage: python seed_questions.py
"""

from pathlib import Path
from sqlalchemy import text
from app.core.database import engine

def seed_questions():
    """Load questions from question.sql file into the database."""
    sql_path = Path(__file__).parent / "tests" / "question.sql"
    
    if not sql_path.exists():
        print(f"❌ Error: {sql_path} not found!")
        return False
    
    print(f"📖 Loading questions from {sql_path}...")
    sql_script = sql_path.read_text(encoding="utf-8")
    
    try:
        with engine.begin() as conn:
            conn.connection.driver_connection.executescript(sql_script)
            
        print("✅ Successfully seeded questions into database!")
        
        # Show statistics
        with engine.connect() as conn:
            result = conn.execute(text("SELECT COUNT(*) as total FROM questions"))
            total = result.scalar()
            
            print(f"\n📊 Total questions loaded: {total}")
            
            # By skill
            result = conn.execute(text(
                "SELECT skill, COUNT(*) as count FROM questions GROUP BY skill ORDER BY skill"
            ))
            print("\n📝 Questions by skill:")
            for skill, count in result:
                print(f"  - {skill:12}: {count} questions")
            
            # By level
            result = conn.execute(text(
                "SELECT level, COUNT(*) as count FROM questions GROUP BY level ORDER BY level"
            ))
            print("\n📊 Questions by level:")
            for level, count in result:
                print(f"  - {level:3}: {count} questions")
        
        return True
        
    except Exception as e:
        print(f"❌ Error seeding questions: {e}")
        return False

if __name__ == "__main__":
    import sys
    success = seed_questions()
    sys.exit(0 if success else 1)
