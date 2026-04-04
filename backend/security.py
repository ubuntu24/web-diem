import os
import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional
from dotenv import load_dotenv
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
import models, database
import cache as _cache

# TTL for user cache (seconds)
_USER_CACHE_TTL = 300  # 5 minutes

# Load env so SECRET_KEY is available
load_dotenv()

# Security configuration
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-for-development-only")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 1 week

if os.getenv("ENV", "development").lower() == "production" and SECRET_KEY == "your-secret-key-for-development-only":
    raise RuntimeError("SECRET_KEY must be set in production")

OBFUSCATION_ID_KEY = os.getenv("OBFUSCATION_ID_KEY", "ID_OBFUSCATION_SALT_2026").encode()
PAYLOAD_OBFUSCATION_KEY = os.getenv("PAYLOAD_OBFUSCATION_KEY", "PAYLOAD_OBFUSCATION_KEY_2026").encode()
_WS_TICKET_TTL = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _normalize_password(password: str) -> str:
    """bcrypt only uses first 72 bytes; normalize very long passwords deterministically."""
    text = password if isinstance(password, str) else str(password)
    raw = text.encode("utf-8")
    if len(raw) <= 72:
        return text
    return "sha256$" + hashlib.sha256(raw).hexdigest()

def get_token(request: Request) -> Optional[str]:
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header.split(" ")[1]
    return request.cookies.get("stoken")

def verify_password(plain_password, hashed_password):
    plain = plain_password if isinstance(plain_password, str) else str(plain_password)
    try:
        if pwd_context.verify(plain, hashed_password):
            return True
    except Exception:
        pass

    normalized = _normalize_password(plain)
    if normalized != plain:
        try:
            return pwd_context.verify(normalized, hashed_password)
        except Exception:
            return False
    return False

def get_password_hash(password):
    return pwd_context.hash(_normalize_password(password))

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def _get_user_from_cache_or_db(username: str, db: Session) -> Optional[models.Nick]:
    """Fetch user — try cache first, fall back to DB."""
    cache_key = f"user:{username}"
    cached = _cache.get(cache_key)
    if cached is not None:
        return cached
    user = db.query(models.Nick).filter(models.Nick.username == username).first()
    if user:
        _cache.set(cache_key, user, ttl=_USER_CACHE_TTL)
    return user


def invalidate_user_cache(username: str):
    """Xóa cache user khi admin thay đổi thông tin (role, limit...)."""
    _cache.delete(f"user:{username}")


def create_websocket_ticket(username: str) -> str:
    ticket = secrets.token_urlsafe(24)
    _cache.set(f"ws_ticket:{ticket}", username, ttl=_WS_TICKET_TTL)
    return ticket


def consume_websocket_ticket(ticket: str) -> Optional[str]:
    if not ticket:
        return None
    cache_key = f"ws_ticket:{ticket}"
    username = _cache.get(cache_key)
    if username:
        _cache.delete(cache_key)
    return username


def get_current_user(request: Request, db: Session = Depends(database.get_db)):
    token = get_token(request)
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = _get_user_from_cache_or_db(username, db)
    if user is None:
        raise credentials_exception
    return user


def get_optional_user(request: Request, db: Session = Depends(database.get_db)):
    token = get_token(request)
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
        return _get_user_from_cache_or_db(username, db)
    except Exception:
        return None

def obfuscate_id(real_id: str) -> str:
    """Creates a non-descriptive token for a student ID with a fixed key and prefix."""
    import base64
    data = real_id.encode()
    # Simple XOR
    xored = bytes([data[i] ^ OBFUSCATION_ID_KEY[i % len(OBFUSCATION_ID_KEY)] for i in range(len(data))])
    # Prefix with T_ to distinguish from real MSVs
    return "T_" + base64.urlsafe_b64encode(xored).decode().replace('=', '')

def obfuscate_payload(data: any) -> str:
    """Encrypts an entire dictionary/list into a single opaque string."""
    import json
    import base64
    
    # Minimize JSON first
    json_str = json.dumps(data, separators=(',', ':'))
    
    data_bytes = json_str.encode()
    
    # XOR encryption
    xored = bytes([data_bytes[i] ^ PAYLOAD_OBFUSCATION_KEY[i % len(PAYLOAD_OBFUSCATION_KEY)] for i in range(len(data_bytes))])
    
    # Prefix to indicate it's an encrypted payload
    return base64.urlsafe_b64encode(xored).decode().replace('=', '')

def deobfuscate_id(opaque_id: str) -> str:
    """Resolves an opaque token back to a real student ID if it has the T_ prefix."""
    if not opaque_id or not opaque_id.startswith("T_"):
        return opaque_id # It's a real MSV or empty
    
    import base64
    try:
        # Remove prefix
        token = opaque_id[2:]
        # Pad base64 if needed
        missing_padding = len(token) % 4
        if missing_padding:
            token += '=' * (4 - missing_padding)
            
        decoded = base64.urlsafe_b64decode(token.encode())
        unxored = bytes([decoded[i] ^ OBFUSCATION_ID_KEY[i % len(OBFUSCATION_ID_KEY)] for i in range(len(decoded))])
        return unxored.decode()
    except Exception:
        return opaque_id
