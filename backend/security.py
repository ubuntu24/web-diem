import os
from datetime import datetime, timedelta
from typing import Optional
from dotenv import load_dotenv
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
import models, database

# Load env so SECRET_KEY is available
load_dotenv()

# Security configuration
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-for-development-only")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 1 week

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/login")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(database.get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = db.query(models.Nick).filter(models.Nick.username == username).first()
    if user is None:
        raise credentials_exception
    return user

def get_optional_user(token: Optional[str] = Depends(OAuth2PasswordBearer(tokenUrl="api/login", auto_error=False)), db: Session = Depends(database.get_db)):
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
        return db.query(models.Nick).filter(models.Nick.username == username).first()
    except Exception:
        return None

def obfuscate_id(real_id: str) -> str:
    """Creates a non-descriptive token for a student ID with a fixed key and prefix."""
    import base64
    # FIXED key for stability across environments
    key = b"ID_OBFUSCATION_SALT_2026"
    data = real_id.encode()
    # Simple XOR
    xored = bytes([data[i] ^ key[i % len(key)] for i in range(len(data))])
    # Prefix with T_ to distinguish from real MSVs
    return "T_" + base64.urlsafe_b64encode(xored).decode().replace('=', '')

def obfuscate_payload(data: any) -> str:
    """Encrypts an entire dictionary/list into a single opaque string."""
    import json
    import base64
    
    # Minimize JSON first
    json_str = json.dumps(data, separators=(',', ':'))
    
    # Use a FIXED key for payload obfuscation to ensure frontend can always decrypt
    # regardless of server environment variables.
    key = "PAYLOAD_OBFUSCATION_KEY_2026".encode()
    data_bytes = json_str.encode()
    
    # XOR encryption
    xored = bytes([data_bytes[i] ^ key[i % len(key)] for i in range(len(data_bytes))])
    
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
        key = b"ID_OBFUSCATION_SALT_2026" # Match fixed key
        unxored = bytes([decoded[i] ^ key[i % len(key)] for i in range(len(decoded))])
        return unxored.decode()
    except Exception:
        return opaque_id
