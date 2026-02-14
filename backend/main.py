import os
import logging
from datetime import datetime, date
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from dotenv import load_dotenv

import models, database, security
from routers import auth, students, admin, websocket

# Load environment variables
load_dotenv()

app = FastAPI(title="Uneti Grade API")

# Configure CORS
origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Setup Access Logging
LOG_DIR = "/app/logs"
if not os.path.exists(LOG_DIR):
    os.makedirs(LOG_DIR, exist_ok=True)

access_logger = logging.getLogger("access")
access_logger.setLevel(logging.INFO)
file_handler = logging.FileHandler(os.path.join(LOG_DIR, "access.log"), encoding='utf-8')
file_formatter = logging.Formatter("%(asctime)s | %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
file_handler.setFormatter(file_formatter)
access_logger.addHandler(file_handler)

# Track last access update time per user to avoid DB writes on every request
_last_access_update = {}  # username -> datetime

@app.middleware("http")
async def log_requests(request: Request, call_next):
    client_ip = request.client.host if request.client else "unknown"
    
    response = await call_next(request)
    
    # Determine user identity from token
    username = "guest"
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            payload = jwt.decode(token, security.SECRET_KEY, algorithms=[security.ALGORITHM])
            username = payload.get("sub", "guest")
        except (JWTError, Exception):
            pass
        
        # Only track access for actual API calls (not OPTIONS, not static files)
        # and throttle to once per minute per user to reduce DB load
        if (username != "guest" 
            and request.method not in ("OPTIONS", "HEAD")
            and request.url.path.startswith("/api/")):
            
            now = datetime.now()
            last_update = _last_access_update.get(username)
            
            if not last_update or (now - last_update).total_seconds() > 60:
                _last_access_update[username] = now
                try:
                    db = database.SessionLocal()
                    user = db.query(models.Nick).filter(models.Nick.username == username).first()
                    if user:
                        user.last_active = now
                        today = date.today()
                        access_record = db.query(models.UserAccess).filter(
                            models.UserAccess.user_id == user.id,
                            models.UserAccess.access_date == today
                        ).first()
                        
                        if access_record:
                            access_record.count += 1
                        else:
                            access_record = models.UserAccess(
                                user_id=user.id,
                                access_date=today,
                                count=1
                            )
                            db.add(access_record)
                        db.commit()
                    db.close()
                except Exception:
                    pass
    
    log_msg = f"{client_ip} | {username} | {request.method} {request.url.path} | {response.status_code}"
    access_logger.info(log_msg)
    
    return response

# Database Initialization & Admin User
@app.on_event("startup")
def startup_event():
    models.Base.metadata.create_all(bind=database.engine)
    
    # Ensure admin user exists
    db = database.SessionLocal()
    admin_user = db.query(models.Nick).filter(models.Nick.username == "admin").first()
    if not admin_user:
        admin_pass = os.getenv("ADMIN_PASSWORD", "admin123")
        new_admin = models.Nick(
            username="admin",
            password=security.get_password_hash(admin_pass),
            role=1,
            created_at=datetime.now()
        )
        db.add(new_admin)
        db.commit()
    db.close()

# Include Routers
app.include_router(auth.router, tags=["Authentication"])
app.include_router(students.router, tags=["Students"])
app.include_router(admin.router, tags=["Admin"])
app.include_router(websocket.router, tags=["WebSocket"])

if __name__ == "__main__":
    import uvicorn
    host = os.getenv("BACKEND_HOST", "127.0.0.1")
    port = int(os.getenv("BACKEND_PORT", 8000))
    uvicorn.run(app, host=host, port=port)
