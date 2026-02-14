from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class LoginRequest(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    role: int

class User(BaseModel):
    id: int
    username: str
    role: int
    created_at: datetime
    reset_limit_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class RegisterRequest(BaseModel):
    username: str
    password: str
