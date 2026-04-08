import os
import logging
import sys

# Initialize logging immediately for startup visibility
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stdout
)
logger = logging.getLogger("api")
from datetime import datetime, date
from urllib.parse import urlparse
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from dotenv import load_dotenv

import models, database, security
from routers import auth, students, admin, websocket, chat
from contextlib import asynccontextmanager

# Load environment variables
load_dotenv()

# Database Initialization & Admin User (Modern Lifespan)
@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        # STARTUP
        # Ensure database tables exist and are synchronized (Production & Local)
        database.sync_schema()
        
        # Ensure admin user exists
        db = database.SessionLocal()
        
        # Migration: Add class_change_limit column if doesn't exist
        try:
            from sqlalchemy import text
            db.execute(text("ALTER TABLE nick ADD COLUMN class_change_limit INTEGER DEFAULT 5"))
            db.commit()
        except Exception as e:
            db.rollback()
            logger.info(f"Migration skip or already exists: {e}")
            
        admin_pass = os.getenv("ADMIN_PASSWORD")
        admin_users = db.query(models.Nick).filter(models.Nick.username == "admin").all()
        if not admin_users:
            if admin_pass:
                if len(admin_pass) >= 8:
                    new_admin = models.Nick(
                        username="admin",
                        password=security.get_password_hash(admin_pass),
                        role=1,
                        created_at=datetime.now()
                    )
                    db.add(new_admin)
                    db.commit()
                    logger.info("Admin user created.")
            else:
                logger.warning("ADMIN_PASSWORD not set. Admin user not created.")
        else:
            updated = False
            for admin_user in admin_users:
                if admin_user.role != 1:
                    admin_user.role = 1
                    updated = True
            if updated:
                db.commit()
                logger.info("Admin roles synchronized.")
        db.close()
    except Exception as startup_err:
        logger.error(f"FATAL STARTUP ERROR (silenced to keep server alive): {startup_err}")
    
    yield
    # SHUTDOWN
    # Add cleanup logic here if needed

app = FastAPI(title="Uneti Grade API", lifespan=lifespan)

def _build_allowed_hosts() -> list[str]:
    """
    Build TrustedHost allowlist with safe defaults for local and Docker deployments.
    ALLOWED_HOSTS env still has highest priority when explicitly set.
    """
    explicit = os.getenv("ALLOWED_HOSTS", "").strip()
    explicit_hosts = [h.strip() for h in explicit.split(",") if h.strip()] if explicit else []
    if "*" in explicit_hosts:
        return ["*"]

    hosts: list[str] = [
        "localhost",
        "127.0.0.1",
        "backend",
        "web-diem-backend",
        "frontend",
        "web-diem-frontend",
    ]
    hosts.extend(explicit_hosts)

    origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
    for raw in origins.split(","):
        raw = raw.strip()
        if not raw:
            continue
        parsed = urlparse(raw if "://" in raw else f"http://{raw}")
        if parsed.hostname:
            hosts.append(parsed.hostname)

    api_url = os.getenv("API_URL", "").strip()
    if api_url:
        parsed = urlparse(api_url if "://" in api_url else f"http://{api_url}")
        if parsed.hostname:
            hosts.append(parsed.hostname)
    # 🕵️ AUTO-RESCUE: Detection logic for Trusted Hosts
    # We no longer hardcode specific domains to keep the source code clean for GitHub.
    # Use ALLOWED_HOSTS or ALLOWED_ORIGINS environment variables instead.
    env_extra_hosts = os.getenv("EXTRA_TRUSTED_HOSTS", "").split(",")
    hosts.extend([h.strip() for h in env_extra_hosts if h.strip()])

    deduped: list[str] = []
    # ... logic for deduping stays same
    seen: set[str] = set()
    for host in hosts:
        if host not in seen:
            seen.add(host)
            deduped.append(host)
    return deduped or ["*"]


# 🛡️ SECURITY: Production allowed hosts. 
# For Docker Healthcheck reliability, we use "*" as the default inside containers
# unless an explicit allowlist is provided via ALLOWED_HOSTS.
allowed_hosts = os.getenv("ALLOWED_HOSTS", "*").split(",")
allowed_hosts = [h.strip() for h in allowed_hosts if h.strip()]

app.add_middleware(TrustedHostMiddleware, allowed_hosts=allowed_hosts)
app.add_middleware(GZipMiddleware, minimum_size=1024)

# Configure CORS
# 🛡️ SECURITY: Production origins MUST be set via ALLOWED_ORIGINS env var.
# Source code remains clean for GitHub.
env_origins = os.getenv("ALLOWED_ORIGINS", "").split(",")
origins = [o.strip() for o in env_origins if o.strip()]

if not origins:
    # Safe defaults for local development only
    origins = ["http://localhost:3000", "http://127.0.0.1:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-CSRF-Token"],
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
            and request.url.path.startswith("/api/")
            and not any(p in request.url.path for p in ["/ws-ticket", "/online-users", "/me", "/profile"])):
            
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


# Include Routers
app.include_router(auth.router, tags=["Authentication"])
app.include_router(students.router, tags=["Students"])
app.include_router(admin.router, tags=["Admin"])
app.include_router(chat.router, tags=["Chat"])
app.include_router(websocket.router, tags=["WebSocket"])

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

if __name__ == "__main__":
    import uvicorn
    host = os.getenv("BACKEND_HOST", "127.0.0.1")
    port = int(os.getenv("BACKEND_PORT", 8000))
    uvicorn.run(app, host=host, port=port)
