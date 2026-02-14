from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional
import models, database, security
from .websocket import manager

router = APIRouter(prefix="/api")

@router.get("/stats/online-users")
def get_online_users(
    current_user: Optional[models.Nick] = Depends(security.get_optional_user),
    db: Session = Depends(database.get_db)
):
    # Count unique IPs from ConnectionManager
    unique_ips = len(set(conn["ip"] for conn in manager.active_connections))
    data = {"count": unique_ips}
    return security.obfuscate_payload(data)

@router.get("/admin/users")
def get_all_users(
    current_user: models.Nick = Depends(security.get_current_user),
    db: Session = Depends(database.get_db)
):
    if current_user.role != 1:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    users = db.query(models.Nick).all()
    result = []
    
    thirty_days_ago = datetime.now().date() - timedelta(days=30)
    
    for u in users:
        history = db.query(models.UserAccess).filter(
            models.UserAccess.user_id == u.id,
            models.UserAccess.access_date >= thirty_days_ago
        ).order_by(models.UserAccess.access_date.desc()).all()
        
        access_history = [{"date": str(h.access_date), "count": h.count} for h in history]
        
        result.append({
            "id": u.id,
            "username": u.username,
            "role": u.role,
            "access_history": access_history,
            "reset_limit_at": u.reset_limit_at.isoformat() if u.reset_limit_at else None
        })
    return result

@router.post("/admin/user/{user_id}/reset-limit")
async def reset_user_limit(
    user_id: int,
    current_user: models.Nick = Depends(security.get_current_user),
    db: Session = Depends(database.get_db)
):
    if current_user.role != 1:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    user = db.query(models.Nick).filter(models.Nick.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    now = datetime.now()
    user.reset_limit_at = now
    db.commit()
    
    # Notify user via WebSocket
    await manager.send_personal_message(user.username, {
        "type": "reset_limit",
        "timestamp": now.isoformat()
    })
    
    return {"message": f"Limit reset for user {user.username}"}
