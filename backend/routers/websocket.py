from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from typing import List, Optional
from jose import JWTError, jwt
import json
import security

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[dict] = []

    async def connect(self, websocket: WebSocket, user_identifier: str, ip: str):
        await websocket.accept()
        self.active_connections.append({
            "ws": websocket,
            "user": user_identifier,
            "ip": ip
        })
        await self.broadcast_online_count()

    def disconnect(self, websocket: WebSocket):
        self.active_connections = [conn for conn in self.active_connections if conn["ws"] != websocket]

    async def broadcast_online_count(self):
        unique_ips = len(set(conn["ip"] for conn in self.active_connections))
        
        message = json.dumps({
            "type": "online_count",
            "count": unique_ips
        })
        
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
async def websocket_endpoint(websocket: WebSocket, token: Optional[str] = Query(None)):
    client_ip = websocket.client.host if websocket.client else "unknown"
    user_id = client_ip  # Default to IP
    
    # Try to decode token to get username
    if token:
        try:
            payload = jwt.decode(token, security.SECRET_KEY, algorithms=[security.ALGORITHM])
            username = payload.get("sub")
            if username:
                user_id = username
        except JWTError:
            pass
    
    await manager.connect(websocket, user_id, client_ip)
    
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "auth" and msg.get("username"):
                    for conn in manager.active_connections:
                        if conn["ws"] == websocket:
                            conn["user"] = msg["username"]
                            break
            except:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        await manager.broadcast_online_count()
