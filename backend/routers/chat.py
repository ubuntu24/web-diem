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
        db.query(models.ChatMessage, models.Nick.full_name, models.Nick.username)
        .outerjoin(models.Nick, models.ChatMessage.user_id == models.Nick.id)
        .order_by(models.ChatMessage.id.desc())
        .limit(50)
        .all()
    )
    
    # Return in chronological order
    result = []
    for m, fn, un in reversed(messages):
        result.append({
            "id": int(m.id),
            "username": un,
            "full_name": fn,
            "message": m.message,
            "timestamp": m.created_at.isoformat()
        })
    return security.obfuscate_payload({"messages": result})
