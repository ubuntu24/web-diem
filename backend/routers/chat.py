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
    # Fetch last 50 messages with sender's full name and reply info
    from sqlalchemy.orm import aliased
    ParentMsg = aliased(models.ChatMessage)
    ParentNick = aliased(models.Nick)

    messages = (
        db.query(
            models.ChatMessage, 
            models.Nick.full_name, 
            models.Nick.username,
            ParentMsg.message.label("parent_message"),
            ParentNick.username.label("parent_username"),
            ParentNick.full_name.label("parent_full_name")
        )
        .outerjoin(models.Nick, models.ChatMessage.user_id == models.Nick.id)
        .outerjoin(ParentMsg, models.ChatMessage.parent_id == ParentMsg.id)
        .outerjoin(ParentNick, ParentMsg.user_id == ParentNick.id)
        .order_by(models.ChatMessage.id.desc())
        .limit(50)
        .all()
    )
    
    # Return in chronological order
    result = []
    for m, fn, un, pm, pun, pfn in reversed(messages):
        item = {
            "id": int(m.id),
            "username": un,
            "full_name": fn,
            "message": m.message,
            "timestamp": m.created_at.isoformat(),
            "reply_to": int(m.parent_id) if m.parent_id else None
        }
        if m.parent_id:
            item["reply_metadata"] = {
                "username": pun or "An danh",
                "full_name": pfn,
                "message": pm
            }
        result.append(item)

    return security.obfuscate_payload({"messages": result})
