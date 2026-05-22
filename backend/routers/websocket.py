import ipaddress
import json
import logging
import asyncio
from datetime import datetime
from typing import List, Optional

import models
import security
from database import SessionLocal
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt
from sqlalchemy import or_

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[dict] = []

    async def connect(self, websocket: WebSocket, user_identifier: str, ip: Optional[str], is_admin: bool = False, fp: Optional[str] = None):
        await websocket.accept()
        self.active_connections.append({
            "ws": websocket,
            "user": user_identifier,
            "ip": ip,
            "fp": fp,
            "is_admin": is_admin
        })
        await self.broadcast_online_count()

    def disconnect(self, websocket: WebSocket):
        self.active_connections = [conn for conn in self.active_connections if conn["ws"] != websocket]

    async def kick_by_identifiers(self, username: Optional[str] = None, ip: Optional[str] = None, fp: Optional[str] = None):
        """Kicks all active connections matching ANY of the identifiers."""
        to_kick = []
        for conn in self.active_connections:
            # Check if any identifier matches
            match = False
            if username and conn.get("user") == username: match = True
            if ip and conn.get("ip") == ip: match = True
            if fp and conn.get("fp") == fp: match = True
            
            if match:
                to_kick.append(conn)
        
        for conn in to_kick:
            try:
                await conn["ws"].send_text(json.dumps({"type": "error", "message": "Bạn đã bị cấm khỏi hệ thống."}))
                await conn["ws"].close()
            except Exception as e:
                logger.debug(f"Kick error (already closed?): {e}")
            self.disconnect(conn["ws"])
        
        if to_kick:
            await self.broadcast_online_count()

    async def disconnect_user(self, username: str):
        """Gracefully disconnects all connections for a specific user (e.g. on logout)"""
        to_kick = [conn for conn in self.active_connections if conn.get("user") == username]
        
        for conn in to_kick:
            try:
                await conn["ws"].close()
            except Exception as e:
                logger.debug(f"Disconnect user error: {e}")
            self.disconnect(conn["ws"])
            
        if to_kick:
            await self.broadcast_online_count()

    async def broadcast_to_admins(self, message: dict):
        """Sends a message ONLY to authenticated administrators."""
        msg_str = json.dumps(message)
        for connection in self.active_connections:
            if connection.get("is_admin"):
                try:
                    await connection["ws"].send_text(msg_str)
                except Exception as e:
                    logger.debug(f"Broadcast to admins failed: {e}")

    async def broadcast(self, message: dict):
        msg_str = json.dumps(message)
        for connection in self.active_connections:
            try:
                await connection["ws"].send_text(msg_str)
            except Exception as e:
                # Connection likely closed
                logger.debug(f"Broadcast failed (connection likely closed): {e}")

    async def broadcast_online_count(self):
        unique_users = len(set(
            conn["user"]
            for conn in self.active_connections
            if conn.get("user")
        ))
        message = json.dumps({"type": "online_count", "count": unique_users})
        for connection in self.active_connections:
            try:
                await connection["ws"].send_text(message)
            except Exception as e:
                logger.debug(f"Broadcast online count failed: {e}")

    async def send_personal_message(self, user_identifier: str, message: dict):
        msg_str = json.dumps(message)
        for connection in self.active_connections:
            if connection["user"] == user_identifier:
                try:
                    await connection["ws"].send_text(msg_str)
                except Exception as e:
                    logger.debug(f"Personal message failed: {e}")

manager = ConnectionManager()
router = APIRouter()


def _parse_ip_candidate(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None

    value = raw.strip().strip('"')
    if not value:
        return None

    # RFC 7239 Forwarded header token style: for=<ip>
    if value.lower().startswith("for="):
        value = value[4:].strip().strip('"')

    # IPv6 with optional port: [2001:db8::1]:443
    if value.startswith("["):
        end = value.find("]")
        if end > 0:
            value = value[1:end]

    # IPv4 with optional port: 1.2.3.4:443
    if value.count(":") == 1:
        host, port = value.rsplit(":", 1)
        if port.isdigit():
            value = host

    try:
        ipaddress.ip_address(value)
        return value
    except ValueError:
        return None


def _is_public_ip(ip: Optional[str]) -> bool:
    if not ip:
        return False
    try:
        addr = ipaddress.ip_address(ip)
        return not (
            addr.is_private
            or addr.is_loopback
            or addr.is_link_local
            or addr.is_multicast
            or addr.is_reserved
            or addr.is_unspecified
        )
    except ValueError:
        return False


def _extract_client_ip(websocket: WebSocket) -> Optional[str]:
    candidates: List[str] = []

    # Prefer real-client headers commonly set by Cloudflare/proxies.
    for header_name in ("cf-connecting-ip", "true-client-ip", "x-real-ip", "x-forwarded-for"):
        raw = websocket.headers.get(header_name)
        if raw:
            candidates.extend(raw.split(","))

    # RFC 7239 fallback.
    forwarded = websocket.headers.get("forwarded")
    if forwarded:
        parts = [p.strip() for p in forwarded.split(";")]
        for part in parts:
            if part.lower().startswith("for="):
                candidates.append(part)

    if websocket.client and websocket.client.host:
        candidates.append(websocket.client.host)

    valid_ips: List[str] = []
    for candidate in candidates:
        parsed = _parse_ip_candidate(candidate)
        if parsed and parsed not in valid_ips:
            valid_ips.append(parsed)

    for ip in valid_ips:
        if _is_public_ip(ip):
            return ip

    return valid_ips[0] if valid_ips else None

@router.websocket("/ws/online-count")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint — KHÔNG nhận token qua URL query string để tránh lộ thông tin trong F12.
    Client phải gửi auth message sau khi kết nối:
      { "type": "auth", "token": "<JWT>" }
    """
    # Recover client IP behind proxy (Cloudflare/Next.js).
    client_ip = _extract_client_ip(websocket) or "unknown"
    # Only use public-routable IP for ban policy to avoid proxy/internal-IP collateral bans.
    policy_ip = client_ip if _is_public_ip(client_ip) else None

    # Start as None; must upgrade to username after JWT success.
    user_id = None
    device_fp = None
    
    # Extract token from cookies & check initial role
    is_admin = False
    token = websocket.cookies.get("stoken")
    if token:
        try:
            payload = jwt.decode(token, security.SECRET_KEY, algorithms=[security.ALGORITHM])
            username = payload.get("sub")
            role = payload.get("role")
            if username:
                user_id = username
                if role == 1:
                    is_admin = True
        except JWTError as e:
            logger.debug(f"Initial JWT decode failed: {e}")

    if not user_id:
        await websocket.accept()
        await websocket.send_text(json.dumps({"type": "error", "message": "Bạn cần đăng nhập để tham gia hệ thống."}))
        await websocket.close()
        return

    # Initial Ban Check (by IP)
    db = SessionLocal()
    try:
        ban_filters = []
        if policy_ip:
            ban_filters.append(models.BanRecord.ip_address == policy_ip)
        if user_id:
            ban_filters.append(models.BanRecord.user_id == (db.query(models.Nick.id).filter(models.Nick.username == user_id).scalar()))

        if ban_filters:
            is_banned = db.query(models.BanRecord).filter(or_(*ban_filters)).first()
            if is_banned:
                await websocket.accept()
                await websocket.send_text(json.dumps({"type": "error", "message": "Bạn đã bị cấm khỏi hệ thống chat."}))
                await websocket.close()
                return
    finally:
        db.close()

    # Rate limiting state
    last_chat_time = datetime.min
    
    await manager.connect(websocket, user_id, policy_ip, is_admin=is_admin)

    try:
        while True:
            try:
                # Require a ping or message at least every 30 seconds
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
            except asyncio.TimeoutError:
                logger.info(f"WebSocket: Connection timed out ({client_ip})")
                manager.disconnect(websocket)
                await manager.broadcast_online_count()
                try:
                    await websocket.close()
                except Exception:
                    pass
                break
            
            try:
                msg = json.loads(data)

                # Handle ping
                if msg.get("type") == "ping":
                    try:
                        await websocket.send_text(json.dumps({"type": "pong"}))
                    except Exception:
                        pass
                    continue

                # Auth via one-time ticket (preferred) or JWT fallback
                if msg.get("type") in ["auth_ticket", "auth"]:
                    username = None
                    if msg.get("type") == "auth_ticket" and msg.get("ticket"):
                        username = security.consume_websocket_ticket(msg.get("ticket"))
                    elif msg.get("type") == "auth" and msg.get("token"):
                        try:
                            payload = jwt.decode(msg["token"], security.SECRET_KEY, algorithms=[security.ALGORITHM])
                            username = payload.get("sub")
                        except JWTError:
                            pass
                    
                    if msg.get("fp"):
                        device_fp = msg["fp"]

                    if username:
                        # Ban Check again with username/FP
                        db = SessionLocal()
                        try:
                            ban_filters = [models.BanRecord.user_id == (db.query(models.Nick.id).filter(models.Nick.username == username).scalar())]
                            if policy_ip:
                                ban_filters.append(models.BanRecord.ip_address == policy_ip)
                            if device_fp:
                                ban_filters.append(models.BanRecord.device_fingerprint == device_fp)

                            check = db.query(models.BanRecord).filter(or_(*ban_filters)).first()
                            if check:
                                await websocket.send_text(json.dumps({"type": "error", "message": "Tài khoản hoặc thiết bị này đã bị cấm."}))
                                await websocket.close()
                                return
                        finally:
                            db.close()

                        old_user = None
                        for conn in manager.active_connections:
                            if conn["ws"] == websocket:
                                old_user = conn["user"]
                                conn["user"] = username
                                conn["fp"] = device_fp
                                # Re-verify admin status on ticket/auth update
                                try:
                                    # We get role from payload if it was JWT auth
                                    role = payload.get("role") if 'payload' in locals() else None
                                    if role == 1:
                                        conn["is_admin"] = True
                                except Exception as e:
                                    logger.debug(f"Role verification failed: {e}")
                                break
                        if old_user != username:
                            await manager.broadcast_online_count()

                # Public Chat Message
                if msg.get("type") == "chat" and msg.get("message"):
                    # 🛡️ SECURITY: Rate Limiting (1 message / 2 seconds)
                    now = datetime.now()
                    diff = (now - last_chat_time).total_seconds()
                    if diff < 2:
                        await websocket.send_text(json.dumps({
                            "type": "error", 
                            "message": f"Bạn đang gửi tin nhắn quá nhanh. Vui lòng chờ {int(2-diff)+1} giây."
                        }))
                        continue
                    
                    last_chat_time = now
                    content = msg["message"].strip()
                    if content:
                        # Get current user details from manager
                        sender = None
                        sender_ip = policy_ip
                        sender_fp = device_fp
                        for conn in manager.active_connections:
                            if conn["ws"] == websocket:
                                conn_user = conn.get("user")
                                if conn_user:
                                    sender = conn_user
                                sender_ip = conn.get("ip", policy_ip)
                                sender_fp = conn.get("fp", device_fp)
                                break
                        
                        if not sender:
                            continue
                        
                        # Store in DB
                        db = SessionLocal()
                        try:
                            # Verify ban before storing (in case they were banned while online)
                            ban_filters = []
                            if sender:
                                ban_filters.append(models.BanRecord.user_id == (db.query(models.Nick.id).filter(models.Nick.username == sender).scalar()))
                            if sender_ip:
                                ban_filters.append(models.BanRecord.ip_address == sender_ip)
                            if sender_fp:
                                ban_filters.append(models.BanRecord.device_fingerprint == sender_fp)

                            check = None
                            if ban_filters:
                                check = db.query(models.BanRecord).filter(or_(*ban_filters)).first()
                            
                            if check:
                                await websocket.send_text(json.dumps({"type": "error", "message": "Tài khoản hoặc thiết bị này đã bị cấm."}))
                                await websocket.close()
                                return

                            # 🔄 Handle Replies
                            reply_to_id = msg.get("reply_to")
                            reply_metadata = None
                            if reply_to_id:
                                try:
                                    parent_msg = db.query(models.ChatMessage).filter(models.ChatMessage.id == reply_to_id).first()
                                    if parent_msg:
                                        parent_user = db.query(models.Nick).filter(models.Nick.id == parent_msg.user_id).first()
                                        reply_metadata = {
                                            "username": parent_user.username if parent_user else "An danh",
                                            "full_name": parent_user.full_name if parent_user else None,
                                            "message": parent_msg.message
                                        }
                                except Exception as e:
                                    logger.error(f"Reply metadata fetch error: {e}")

                            # Store in DB using SQLAlchemy ORM (cleaner & more secure)
                            try:
                                db_msg = models.ChatMessage(
                                    user_id=(db.query(models.Nick.id).filter(models.Nick.username == sender).scalar()), 
                                    message=content,
                                    ip_address=sender_ip,
                                    device_fingerprint=sender_fp,
                                    parent_id=reply_to_id if reply_metadata else None
                                )
                                db.add(db_msg)
                                db.commit()
                                db.refresh(db_msg)
                                
                                last_id = db_msg.id
                                last_time = db_msg.created_at.isoformat()
                            except Exception as db_err:
                                db.rollback()
                                logger.error(f"DB Insert Failure: {db_err}")
                                # Fallback: Still try to broadcast even if DB save fails
                                last_id = 0
                                last_time = datetime.now().isoformat()

                            # BROADCAST (Always happens for successfully received valid messages)
                            # Lookup latest full_name to reflect profile changes immediately
                            sender_full_name = None
                            sender_nick = db.query(models.Nick).filter(
                                models.Nick.username == sender
                            ).first()
                            if sender_nick:
                                sender_full_name = sender_nick.full_name

                            await manager.broadcast({
                                "type": "chat_message",
                                "id": last_id,
                                "username": sender,
                                "full_name": sender_full_name,
                                "message": content,
                                "timestamp": last_time,
                                "reply_to": reply_to_id if reply_metadata else None,
                                "reply_metadata": reply_metadata
                            })
                        finally:
                            db.close()


            except json.JSONDecodeError:
                logger.warning("WebSocket: Received invalid JSON")
                continue
            except Exception as e:
                logger.exception(f"WebSocket Message Processing Error: {e}")
                continue

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info(f"WebSocket: Client disconnected ({client_ip})")
        await manager.broadcast_online_count()
    except Exception as e:
        logger.exception(f"WebSocket Fatal Error: {e}")
        manager.disconnect(websocket)
        await manager.broadcast_online_count()

