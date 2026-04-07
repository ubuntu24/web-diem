import json
import security
import models
from database import SessionLocal
from datetime import datetime
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import List
from jose import jwt, JWTError

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[dict] = []

    async def connect(self, websocket: WebSocket, user_identifier: str, ip: str, fp: str = None):
        await websocket.accept()
        self.active_connections.append({
            "ws": websocket,
            "user": user_identifier,
            "ip": ip,
            "fp": fp
        })
        await self.broadcast_online_count()

    def disconnect(self, websocket: WebSocket):
        self.active_connections = [conn for conn in self.active_connections if conn["ws"] != websocket]

    async def kick_by_identifiers(self, username: str = None, ip: str = None, fp: str = None):
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
            except:
                pass
            self.disconnect(conn["ws"])
        
        if to_kick:
            await self.broadcast_online_count()

    async def broadcast(self, message: dict):
        msg_str = json.dumps(message)
        for connection in self.active_connections:
            try:
                await connection["ws"].send_text(msg_str)
            except:
                pass

    async def broadcast_online_count(self):
        unique_users = len(set(conn["user"] for conn in self.active_connections))
        message = json.dumps({"type": "online_count", "count": unique_users})
        for connection in self.active_connections:
            try:
                await connection["ws"].send_text(message)
            except:
                pass

    async def send_personal_message(self, user_identifier: str, message: dict):
        msg_str = json.dumps(message)
        for connection in self.active_connections:
            if connection["user"] == user_identifier:
                try:
                    await connection["ws"].send_text(msg_str)
                except:
                    pass

manager = ConnectionManager()
router = APIRouter()

@router.websocket("/ws/online-count")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint — KHÔNG nhận token qua URL query string để tránh lộ thông tin trong F12.
    Client phải gửi auth message sau khi kết nối:
      { "type": "auth", "token": "<JWT>" }
    """
    client_ip = websocket.client.host if websocket.client else "unknown"
    user_id = client_ip  # Default: track by IP
    device_fp = None
    
    # Extract token from cookies
    token = websocket.cookies.get("stoken")
    if token:
        try:
            payload = jwt.decode(token, security.SECRET_KEY, algorithms=[security.ALGORITHM])
            username = payload.get("sub")
            if username:
                user_id = username
        except JWTError:
            pass

    # Initial Ban Check (by IP)
    db = SessionLocal()
    try:
        is_banned = db.query(models.BanRecord).filter(
            (models.BanRecord.ip_address == client_ip) | 
            (models.BanRecord.username == user_id)
        ).first()
        if is_banned:
            await websocket.accept()
            await websocket.send_text(json.dumps({"type": "error", "message": "Bạn đã bị cấm khỏi hệ thống chat."}))
            await websocket.close()
            return
    finally:
        db.close()

    await manager.connect(websocket, user_id, client_ip)

    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)

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
                            check = db.query(models.BanRecord).filter(
                                (models.BanRecord.username == username) |
                                (models.BanRecord.device_fingerprint == device_fp)
                            ).first()
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
                                break
                        if old_user != username:
                            await manager.broadcast_online_count()

                # Public Chat Message
                if msg.get("type") == "chat" and msg.get("message"):
                    content = msg["message"].strip()
                    if content:
                        # Get current user details from manager
                        sender = "Guest"
                        sender_ip = client_ip
                        sender_fp = device_fp
                        for conn in manager.active_connections:
                            if conn["ws"] == websocket:
                                sender = conn["user"]
                                sender_ip = conn.get("ip", client_ip)
                                sender_fp = conn.get("fp", device_fp)
                                break
                        
                        # Store in DB
                        db = SessionLocal()
                        try:
                            # Verify ban before storing (in case they were banned while online)
                            check = db.query(models.BanRecord).filter(
                                (models.BanRecord.username == sender) |
                                (models.BanRecord.ip_address == sender_ip) |
                                (models.BanRecord.device_fingerprint == sender_fp)
                            ).first()
                            
                            if check:
                                await websocket.send_text(json.dumps({"type": "error", "message": "Tài khoản hoặc thiết bị này đã bị cấm."}))
                                await websocket.close()
                                return

                            # Store in DB using raw SQL to ensure it works even if models lack the columns
                            from sqlalchemy import text
                            try:
                                db.execute(text("""
                                    INSERT INTO chat_messages (username, message, ip_address, device_fingerprint, created_at)
                                    VALUES (:u, :m, :ip, :fp, NOW())
                                """), {"u": sender, "m": content, "ip": sender_ip, "fp": sender_fp})
                                db.commit()
                            except Exception as db_err:
                                # Fallback to standard insert if custom columns fail
                                db.rollback()
                                db_msg = models.ChatMessage(username=sender, message=content)
                                db.add(db_msg)
                                db.commit()
                                print(f"DB Error: {db_err}")
                            
                            # Fetch the ID of the last message for broadcast
                            last_msg = db.query(models.ChatMessage).filter(models.ChatMessage.username == sender).order_by(models.ChatMessage.id.desc()).first()
                            last_id = last_msg.id
                            last_time = last_msg.created_at.isoformat()

                            # Broadcast
                            await manager.broadcast({
                                "type": "chat_message",
                                "id": int(last_id),
                                "user": sender,
                                "text": content,
                                "time": last_time
                            })
                        finally:
                            db.close()

            except (json.JSONDecodeError, Exception) as e:
                pass

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        await manager.broadcast_online_count()

