from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


@router.post("/upload")
def upload_analytics(
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Mock sink for downstream analytics pipelines (e.g., Databricks ingestion).
    return {
        "status": "accepted",
        "user_id": current_user.id,
        "records": 1,
        "payload": payload,
    }
