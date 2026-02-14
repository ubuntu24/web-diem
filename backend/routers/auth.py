from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
import models, database, schemas, security

router = APIRouter(prefix="/api")

@router.post("/login", response_model=schemas.Token)
def login(request: schemas.LoginRequest, db: Session = Depends(database.get_db)):
    user = db.query(models.Nick).filter(models.Nick.username == request.username).first()
    if not user or not security.verify_password(request.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = security.create_access_token(data={"sub": user.username})
    return {
        "access_token": access_token, 
        "token_type": "bearer", 
        "role": user.role
    }

@router.post("/register")
def register(request: schemas.RegisterRequest, db: Session = Depends(database.get_db)):
    # Check if user exists
    user = db.query(models.Nick).filter(models.Nick.username == request.username).first()
    if user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    hashed_password = security.get_password_hash(request.password)
    # Default role 0 (Guest) with default permissions
    new_user = models.Nick(
        username=request.username, 
        password=hashed_password, 
        role=0
    )
    db.add(new_user)
    db.commit()
    return {"message": "User created successfully"}

@router.get("/me")
def read_users_me(current_user: models.Nick = Depends(security.get_current_user)):
    # Masked fields for privacy: u=username, r=role, rl=reset_limit_at, ca=created_at
    data = {
        "u": current_user.username,
        "r": current_user.role,
        "rl": current_user.reset_limit_at.isoformat() if current_user.reset_limit_at else None,
        "ca": current_user.created_at.isoformat() if current_user.created_at else None,
    }
    # Return as encrypted string
    return security.obfuscate_payload(data)
