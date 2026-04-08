from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import models
from database import get_db
import security

router = APIRouter(prefix="/api")

@router.get("/chat/history")
def get_chat_history(
    current_user: models.Nick = Depends(security.get_current_user),
    db: Session = Depends(get_db)
):
    # Fetch last 50 messages
    messages = db.query(models.ChatMessage).order_by(models.ChatMessage.id.desc()).limit(50).all()
    # Return in chronological order
    result = []
    for m in reversed(messages):
        result.append({
            "id": int(m.id),
            "username": m.username,
            "message": m.message,
            "timestamp": m.created_at.isoformat()
        })
    return security.obfuscate_payload({"messages": result})
