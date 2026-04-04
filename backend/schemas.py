from pydantic import BaseModel, Field, constr
from typing import List, Optional
from datetime import datetime

class LoginRequest(BaseModel):
    username: constr(strip_whitespace=True, min_length=3, max_length=32, pattern=r"^[A-Za-z0-9_.-]+$")
    password: constr(min_length=1, max_length=4096)

class Token(BaseModel):
    access_token: str
    token_type: str
    role: int

class User(BaseModel):
    username: str
    role: int
    reset_limit_at: Optional[datetime] = None
    class_change_limit: Optional[int] = 5

    class Config:
        from_attributes = True

class RegisterRequest(BaseModel):
    username: constr(strip_whitespace=True, min_length=3, max_length=32, pattern=r"^[A-Za-z0-9_.-]+$")
    password: constr(min_length=8, max_length=4096)

class UpdateLimitRequest(BaseModel):
    limit: int = Field(ge=-1, le=100)
