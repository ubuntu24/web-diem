import logging
from datetime import datetime, timedelta
from typing import Optional

import database
import models
import schemas
import security
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .websocket import manager

router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)

@router.get("/stats/online-users")
def get_online_users(
    current_user: models.Nick = Depends(security.get_current_user),
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

@router.post("/admin/ban")
async def ban_user(
    payload: dict, # {username, reason}
    current_user: models.Nick = Depends(security.get_current_user),
    db: Session = Depends(database.get_db)
):
    if current_user.role != 1:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    target_username = payload.get("username")
    reason = payload.get("reason", "Vi phạm điều khoản cộng đồng")
    
    # Automate identifier retrieval from active connections
    target_ip = None
    target_fp = None
    
    for conn in manager.active_connections:
        if conn.get("user") == target_username:
            target_ip = conn.get("ip")
            target_fp = conn.get("fp")
            break
            
    # Fallback to chat history if user is offline
    if not target_ip or not target_fp:
        last_msg = db.query(models.ChatMessage).filter(
            models.ChatMessage.user_id == (db.query(models.Nick.id).filter(models.Nick.username == target_username).scalar())
        ).order_by(models.ChatMessage.id.desc()).first()
        
        if last_msg:
            target_ip = target_ip or getattr(last_msg, "ip_address", None)
            target_fp = target_fp or getattr(last_msg, "device_fingerprint", None)

    # 🛡️ SECURITY: Prevent duplicate bans
    existing_ban = db.query(models.BanRecord).filter(
        (models.BanRecord.user_id == (db.query(models.Nick.id).filter(models.Nick.username == target_username).scalar())) |
        ((models.BanRecord.ip_address == target_ip) & (models.BanRecord.ip_address != None)) |
        ((models.BanRecord.device_fingerprint == target_fp) & (models.BanRecord.device_fingerprint != None))
    ).first()

    if existing_ban:
        existing_ban.reason = reason
        existing_ban.user_id = (db.query(models.Nick.id).filter(models.Nick.username == target_username).scalar()) if target_username else existing_ban.user_id
        existing_ban.ip_address = target_ip or existing_ban.ip_address
        existing_ban.device_fingerprint = target_fp or existing_ban.device_fingerprint
    else:
        ban = models.BanRecord(
            user_id=(db.query(models.Nick.id).filter(models.Nick.username == target_username).scalar()),
            ip_address=target_ip,
            device_fingerprint=target_fp,
            reason=reason
        )
        db.add(ban)
    
    db.commit()
    
    # Enforce Live Kick across all devices/accounts matching these identifiers
    await manager.kick_by_identifiers(
        username=target_username,
        ip=target_ip,
        fp=target_fp
    )
    
    # Broadcast to all (for general notification if needed, though kick handles direct disconnection)
    await manager.broadcast({
        "type": "user_banned",
        "username": target_username,
        "ip": target_ip,
        "fp": target_fp
    })
    
    return {"message": "User and associated device/IP banned successfully"}

@router.get("/admin/bans")
def get_bans(
    current_user: models.Nick = Depends(security.get_current_user),
    db: Session = Depends(database.get_db)
):
    if current_user.role != 1:
        raise HTTPException(status_code=403, detail="Not authorized")
    bans = (
        db.query(models.BanRecord, models.Nick.username)
        .outerjoin(models.Nick, models.BanRecord.user_id == models.Nick.id)
        .order_by(models.BanRecord.id.desc())
        .all()
    )
    result = []
    for b, un in bans:
        result.append({
            "id": b.id,
            "username": un,
            "user_id": b.user_id,
            "ip_address": b.ip_address,
            "device_fingerprint": b.device_fingerprint,
            "reason": b.reason,
            "created_at": b.created_at.isoformat() if b.created_at else None
        })
    return result

@router.delete("/admin/ban/{ban_id}")
def unban_user(
    ban_id: int,
    current_user: models.Nick = Depends(security.get_current_user),
    db: Session = Depends(database.get_db)
):
    if current_user.role != 1:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    db.query(models.BanRecord).filter(models.BanRecord.id == ban_id).delete()
    db.commit()
    return {"message": "Ban removed"}


@router.get("/admin/user/{user_id}/details")
def get_user_details(
    user_id: int,
    current_user: models.Nick = Depends(security.get_current_user),
    db: Session = Depends(database.get_db)
):
    """Lấy chi tiết user: IP đã vào web (từ UserIpLog) + số lượt truy cập từng ngày."""
    if current_user.role != 1:
        raise HTTPException(status_code=403, detail="Not authorized")

    user = db.query(models.Nick).filter(models.Nick.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # --- IP History: lấy từ user_ip_log ---
    # Bọc try-except: nếu bảng chưa tồn tại (migration chưa chạy) thì trả list rỗng
    ip_history = []
    try:
        ip_rows = (
            db.query(models.UserIpLog)
            .filter(models.UserIpLog.user_id == user_id)
            .order_by(models.UserIpLog.last_seen.desc())
            .all()
        )
        ip_history = [
            {
                "ip": row.ip_address,
                "hit_count": row.hit_count,
                "first_seen": row.first_seen.isoformat() if row.first_seen else None,
                "last_seen": row.last_seen.isoformat() if row.last_seen else None,
            }
            for row in ip_rows
        ]
    except Exception as e:
        logger.warning(f"user_ip_log query failed for user_id={user_id}: {e}")
        db.rollback()

    # --- Lấy thêm IP từ ban_records nếu có ---
    ban_ips = []
    try:
        ban_rows = (
            db.query(models.BanRecord)
            .filter(
                models.BanRecord.user_id == user.id,
                models.BanRecord.ip_address.isnot(None),
            )
            .all()
        )
        ban_ips = [
            {
                "ip": b.ip_address,
                "reason": b.reason,
                "banned_at": b.created_at.isoformat() if b.created_at else None,
                "device_fingerprint": b.device_fingerprint,
            }
            for b in ban_rows
        ]
    except Exception as e:
        logger.warning(f"ban_records query failed for user={user.username}: {e}")
        db.rollback()

    # --- Access stats: toàn bộ lịch sử vào web ---
    access_history = []
    try:
        access_rows = (
            db.query(models.UserAccess)
            .filter(models.UserAccess.user_id == user_id)
            .order_by(models.UserAccess.access_date.desc())
            .all()
        )
        access_history = [
            {"date": str(row.access_date), "count": row.count}
            for row in access_rows
        ]
    except Exception as e:
        logger.warning(f"user_access query failed for user_id={user_id}: {e}")
        db.rollback()

    total_access = sum(r["count"] for r in access_history)

    return {
        "user_id": user.id,
        "username": user.username,
        "role": user.role,
        "last_active": user.last_active.isoformat() if user.last_active else None,
        "ip_history": ip_history,
        "ban_ips": ban_ips,
        "access_history": access_history,
        "total_access": total_access,
    }

