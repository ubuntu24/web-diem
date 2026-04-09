import models
import security
from database import get_db
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api")

@router.get("/chat/history")
def get_chat_history(
    current_user: models.Nick = Depends(security.get_current_user),
    db: Session = Depends(get_db)
):
    # Fetch last 50 messages with sender's full name
    # We join with Nick table to get the latest full_name
    messages = (
        db.query(models.ChatMessage, models.Nick.full_name)
        .outerjoin(models.Nick, models.ChatMessage.username == models.Nick.username)
        .order_by(models.ChatMessage.id.desc())
        .limit(50)
        .all()
    )
    
    # Return in chronological order
    result = []
    for m, fn in reversed(messages):
        result.append({
            "id": int(m.id),
            "username": m.username,
            "full_name": fn,
            "message": m.message,
            "timestamp": m.created_at.isoformat()
        })
    return security.obfuscate_payload({"messages": result})
