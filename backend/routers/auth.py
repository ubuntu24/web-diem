import time
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import os
import models, database, schemas, security
import cache as _cache

router = APIRouter(prefix="/api")


import threading
_rl_lock = threading.Lock()

def _check_rate_limit(scope: str, identity: str, limit: int, window_seconds: int) -> bool:
    with _rl_lock:
        now = time.time()
        key = f"rl:{scope}:{identity}"
        attempts = _cache.get(key) or []
        attempts = [t for t in attempts if now - t < window_seconds]
        if len(attempts) >= limit:
            _cache.set(key, attempts, ttl=window_seconds)
            return False
        attempts.append(now)
        _cache.set(key, attempts, ttl=window_seconds)
        return True

@router.post("/login")
def login(payload: schemas.LoginRequest, request: Request, db: Session = Depends(database.get_db)):
    client_ip = request.client.host if request.client else "unknown"
    if not _check_rate_limit("login", client_ip, limit=12, window_seconds=60):
        raise HTTPException(status_code=429, detail="Too many login attempts")

    user = db.query(models.Nick).filter(models.Nick.username == payload.username).first()
    if not user or not security.verify_password(payload.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = security.create_access_token(data={"sub": user.username})
    
    # Đặt httpOnly cookie — RSC pages sử dụng để fetch data server-side
    # Browser JS không đọc được httpOnly cookie (bảo mật hơn localStorage)
    cookie_max_age = 60 * 60 * 24 * 7  # 7 days in seconds
    is_production = os.getenv("ENV", "development").lower() == "production"
    response = JSONResponse(content={
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "class_change_limit": user.class_change_limit
    })
    response.set_cookie(
        key="stoken",
        value=access_token,
        max_age=cookie_max_age,
        httponly=True,
        samesite="lax",
        secure=is_production,
        path="/",
    )
    return response

@router.post("/logout")
def logout():
    response = JSONResponse(content={"message": "Logged out successfully"})
    response.delete_cookie("stoken", path="/")
    return response

@router.post("/register")
def register(payload: schemas.RegisterRequest, request: Request, db: Session = Depends(database.get_db)):
    client_ip = request.client.host if request.client else "unknown"
    if not _check_rate_limit("register", client_ip, limit=6, window_seconds=60):
        raise HTTPException(status_code=429, detail="Too many register attempts")

    # Check if user exists
    user = db.query(models.Nick).filter(models.Nick.username == payload.username).first()
    if user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    hashed_password = security.get_password_hash(payload.password)
    # Default role 0 (Guest) with default permissions
    new_user = models.Nick(
        username=payload.username,
        password=hashed_password, 
        role=0
    )
    db.add(new_user)
    db.commit()
    return {"message": "User created successfully"}

@router.get("/me")
def read_users_me(current_user: models.Nick = Depends(security.get_current_user)):
    # Masked fields for privacy: u=username, r=role, rl=reset_limit_at, ca=created_at, cl=class_change_limit
    data = {
        "u": current_user.username,
        "r": current_user.role,
        "rl": current_user.reset_limit_at.isoformat() if current_user.reset_limit_at else None,
        "ca": current_user.created_at.isoformat() if current_user.created_at else None,
        "cl": current_user.class_change_limit,
    }
    # Return as encrypted string
    return security.obfuscate_payload(data)


@router.get("/me-profile")
def read_user_profile(current_user: models.Nick = Depends(security.get_current_user)):
    # Minimal profile payload only; excludes role/reset/limit fields.
    data = {
        "u": current_user.username,
        "ca": current_user.created_at.isoformat() if current_user.created_at else None,
    }
    return security.obfuscate_payload(data)


@router.post("/ws-ticket")
def websocket_ticket(current_user: models.Nick = Depends(security.get_current_user)):
    return {"ticket": security.create_websocket_ticket(current_user.username)}
