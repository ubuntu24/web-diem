import os
import logging
from datetime import datetime, date
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from dotenv import load_dotenv

import models, database, security
from routers import auth, students, admin, websocket

# Load environment variables
load_dotenv()

app = FastAPI(title="Uneti Grade API")

allowed_hosts = [h.strip() for h in os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if h.strip()]
app.add_middleware(TrustedHostMiddleware, allowed_hosts=allowed_hosts)
app.add_middleware(GZipMiddleware, minimum_size=1024)

# Configure CORS
origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Track last access update time per user to avoid DB writes on every request
_last_access_update = {}  # username -> datetime

@app.middleware("http")
async def log_requests(request: Request, call_next):
    max_body_bytes = int(os.getenv("MAX_REQUEST_BYTES", "1048576"))
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > max_body_bytes:
                return JSONResponse(status_code=413, content={"detail": "Payload too large"})
        except ValueError:
            pass

    client_ip = request.client.host if request.client else "unknown"
    
    response = await call_next(request)

    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    response.headers["Cross-Origin-Resource-Policy"] = "same-site"
    
    # Determine user identity — try Authorization header first, then cookie
    username = "guest"
    auth_header = request.headers.get("Authorization")
    token = None
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
    elif not token:
        # Fallback: read from httpOnly cookie (used by RSC server-side fetches)
        token = request.cookies.get("stoken")

    if token:
        try:
            payload = jwt.decode(token, security.SECRET_KEY, algorithms=[security.ALGORITHM])
            username = payload.get("sub", "guest")
        except (JWTError, Exception):
            pass
        
        if (username != "guest" 
            and request.method not in ("OPTIONS", "HEAD")
            and request.url.path.startswith("/api/")):
            
            now = datetime.now()
            last_update = _last_access_update.get(username)
            
            if not last_update or (now - last_update).total_seconds() > 60:
                _last_access_update[username] = now
                db = None
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
                except Exception:
                    pass
                finally:
                    if db:
                        db.close()
    
    return response

# Database Initialization & Admin User
@app.on_event("startup")
def startup_event():
    models.Base.metadata.create_all(bind=database.engine)
    
    # Ensure admin user exists
    db = database.SessionLocal()
    
    # Migration: Add class_change_limit column if doesn't exist
    try:
        from sqlalchemy import text
        db.execute(text("ALTER TABLE nick ADD COLUMN class_change_limit INTEGER DEFAULT 5"))
        db.commit()
    except Exception:
        db.rollback()
        
    admin_pass = os.getenv("ADMIN_PASSWORD")
    admin_users = db.query(models.Nick).filter(models.Nick.username == "admin").all()
    if not admin_users:
        if not admin_pass:
            raise RuntimeError("ADMIN_PASSWORD must be set before first startup")
        if len(admin_pass) < 8:
            raise RuntimeError("ADMIN_PASSWORD must be at least 8 characters")
        new_admin = models.Nick(
            username="admin",
            password=security.get_password_hash(admin_pass),
            role=1,
            created_at=datetime.now()
        )
        db.add(new_admin)
        db.commit()
    else:
        updated = False
        for admin_user in admin_users:
            if admin_user.role != 1:
                admin_user.role = 1
                updated = True
        if updated:
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
