from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Depends
from sqlalchemy.orm import Session
from app.core.database import Base, engine
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.routers import auth, users, lessons, questions, review, chat, admin, flashcards, analytics
from app.services.recommendation import get_recommendations

# Create all tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Pengwin Backend",
    description="English learning platform API — skills, practice, spaced repetition, AI chat",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(lessons.router)
app.include_router(questions.router)
app.include_router(review.router)
app.include_router(flashcards.router)
app.include_router(chat.router)
app.include_router(admin.router)
app.include_router(analytics.router)


@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "app": "Pengwin API v1.0"}


@app.get("/health", tags=["Health"])
def health():
    return {"status": "healthy"}


@app.get("/api/recommendations", tags=["Recommendations"])
def recommendations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Compatibility endpoint for dashboard recommendation refresh."""
    return get_recommendations(current_user.id, db)
