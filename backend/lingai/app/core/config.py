from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional
BASE_DIR = Path(__file__).resolve().parents[2]
DEFAULT_DB_URL = f"sqlite:///{(BASE_DIR / 'lingai.db').as_posix()}"

class Settings(BaseSettings):
    APP_NAME: str = "Pengwin"
    SECRET_KEY: str = "change-this-in-production-use-long-random-string"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    DATABASE_URL: str = DEFAULT_DB_URL
    LLM_PROVIDER: str = "groq"  # groq | gemini | openai
    LLM_API_KEY: Optional[str] = None
    LLM_BASE_URL: str = "https://api.groq.com/openai/v1"
    LLM_MODEL: str = "llama-3.1-8b-instant"
    LLM_TIMEOUT_SECONDS: int = 30

    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
    )

settings = Settings()
