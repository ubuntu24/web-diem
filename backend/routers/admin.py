from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional
import logging
import models, database, security, schemas
import cache as _cache
from .websocket import manager

router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)

@router.get("/stats/online-users")
def get_online_users(
    current_user: Optional[models.Nick] = Depends(security.get_optional_user),
    db: Session = Depends(database.get_db)
):
    # Đếm theo user (username từ JWT) để 2 tài khoản khác nhau = 2 người
    unique_users = len(set(conn["user"] for conn in manager.active_connections))
    data = {"count": unique_users}
    return security.obfuscate_payload(data)

@router.get("/admin/users")
def get_all_users(
    current_user: models.Nick = Depends(security.get_current_user),
    db: Session = Depends(database.get_db)
):
    if current_user.role != 1:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    users = db.query(models.Nick).all()
    user_ids = [u.id for u in users]

    # Fix N+1: 1 query lấy toàn bộ access history của tất cả users (30 ngày gần nhất)
    thirty_days_ago = datetime.now().date() - timedelta(days=30)
    all_history = db.query(models.UserAccess).filter(
        models.UserAccess.user_id.in_(user_ids),
        models.UserAccess.access_date >= thirty_days_ago
    ).order_by(models.UserAccess.access_date.desc()).all()

    # Group by user_id in Python (tránh thêm N queries)
    history_map: dict = {uid: [] for uid in user_ids}
    for h in all_history:
        history_map[h.user_id].append({"date": str(h.access_date), "count": h.count})

    result = []
    for u in users:
        result.append({
            "id": u.id,
            "username": u.username,
            "role": u.role,
            "access_history": history_map.get(u.id, []),
            "reset_limit_at": u.reset_limit_at.isoformat() if u.reset_limit_at else None,
            "class_change_limit": u.class_change_limit
        })
    return result

@router.post("/admin/user/{user_id}/reset-limit")
async def reset_user_limit(
    user_id: int,
    request: Request,
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

    # Invalidate user cache so next request picks up new data
    security.invalidate_user_cache(user.username)

    # Notify user via WebSocket
    await manager.send_personal_message(user.username, {
        "type": "reset_limit",
        "timestamp": now.isoformat()
    })

    logger.info(
        "admin_action=reset_limit actor=%s target_user_id=%s target_username=%s ip=%s",
        current_user.username,
        user.id,
        user.username,
        request.client.host if request.client else "unknown"
    )
    
    return {"message": f"Limit reset for user {user.username}"}

@router.post("/admin/user/{user_id}/class-change-limit")
async def update_user_class_change_limit(
    user_id: int,
    request: schemas.UpdateLimitRequest,
    http_request: Request,
    current_user: models.Nick = Depends(security.get_current_user),
    db: Session = Depends(database.get_db)
):
    if current_user.role != 1:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    user = db.query(models.Nick).filter(models.Nick.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.class_change_limit = request.limit
    db.commit()

    # Invalidate user cache so next request picks up new limit
    security.invalidate_user_cache(user.username)

    # Notify user via WebSocket
    await manager.send_personal_message(user.username, {
        "type": "update_limit",
        "limit": request.limit
    })

    logger.info(
        "admin_action=update_limit actor=%s target_user_id=%s target_username=%s new_limit=%s ip=%s",
        current_user.username,
        user.id,
        user.username,
        request.limit,
        http_request.client.host if http_request.client else "unknown"
    )
    
    return {"message": f"Class change limit updated for user {user.username}"}
