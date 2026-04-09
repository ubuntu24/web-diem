from datetime import datetime
from typing import Annotated, Optional

from pydantic import BaseModel, Field, StringConstraints


class LoginRequest(BaseModel):
    username: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=32, pattern=r"^[A-Za-z0-9_.-]+$")]
    password: Annotated[str, StringConstraints(min_length=1, max_length=4096)]

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
    username: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=32, pattern=r"^[A-Za-z0-9_.-]+$")]
    password: Annotated[str, StringConstraints(min_length=1, max_length=4096)]

class UpdateLimitRequest(BaseModel):
    limit: int = Field(ge=-1, le=100)

class UpdateProfileRequest(BaseModel):
    full_name: Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)]
