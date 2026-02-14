from fastapi import FastAPI, Depends, HTTPException, Query, status, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from typing import List, Optional
import models, database, os
from fastapi.middleware.cors import CORSMiddleware
from passlib.context import CryptContext
from pydantic import BaseModel
from datetime import datetime, timedelta
from jose import JWTError, jwt
from fastapi.security import OAuth2PasswordBearer
from fastapi import Request
import logging

# Secret key for JWT
SECRET_KEY = os.getenv("SECRET_KEY", "nhincaichogi")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Fix for Windows Unicode Console Output
import sys
sys.stdout.reconfigure(encoding='utf-8')

# Initialize the app
app = FastAPI()

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Enable CORS for frontend
# In production, specify your domains in ALLOWED_ORIGINS env variable
allowed_origins_raw = os.getenv("ALLOWED_ORIGINS", "*")
if allowed_origins_raw == "*":
    origins = ["*"]
else:
    origins = [o.strip() for o in allowed_origins_raw.split(",")]

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

# Configure custom logger for access logs
access_logger = logging.getLogger("access")
access_logger.setLevel(logging.INFO)
file_handler = logging.FileHandler(os.path.join(LOG_DIR, "access.log"), encoding='utf-8')
file_formatter = logging.Formatter("%(asctime)s | %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
file_handler.setFormatter(file_formatter)
access_logger.addHandler(file_handler)

# In-memory Active Users Store (Middleware-based fallback)
# content: { "ip_or_username": datetime_timestamp }
active_users = {}

# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        # Store tuple of (WebSocket, ip_address)
        self.active_connections: List[dict] = []

    async def connect(self, websocket: WebSocket, user_identifier: str, ip: str):
        await websocket.accept()
        # Store user_identifier (username for logged in, IP for guests)
        self.active_connections.append({"ws": websocket, "id": user_identifier, "ip": ip})
        print(f"[WS] Connected: {user_identifier} ({ip}). Total connections: {len(self.active_connections)}")
        await self.broadcast_online_count()

    def disconnect(self, websocket: WebSocket):
        before_count = len(self.active_connections)
        self.active_connections = [c for c in self.active_connections if c["ws"] != websocket]
        print(f"[WS] Disconnected. Connections: {before_count} -> {len(self.active_connections)}")
        
    async def broadcast_online_count(self):
        # Count unique identifiers (Usernames or IPs)
        unique_users = {c["id"] for c in self.active_connections}
        count = len(unique_users)
        
        print(f"[WS] Broadcasting count: {count} (Unique Users: {unique_users})")
        
        # We only broadcast if there are connections
        if self.active_connections:
            # Prepare message
            message = {"count": count}
            # Broadcast to all
            for connection in self.active_connections:
                try:
                    await connection["ws"].send_json(message)
                except Exception as e:
                    # Handle broken connections lazily
                    print(f"[WS] Error broadcasting to {connection['id']}: {e}")

manager = ConnectionManager()

@app.middleware("http")
async def log_requests(request: Request, call_next):
    # Extract Real IP from headers if behind proxy (Cloudflare, Nginx, etc.)
    real_ip = request.headers.get("CF-Connecting-IP") or \
              request.headers.get("X-Forwarded-For") or \
              (request.client.host if request.client else "unknown")

    # If X-Forwarded-For has multiple IPs, take the first one
    if "," in real_ip:
        real_ip = real_ip.split(",")[0].strip()

    # Update active users
    active_users[real_ip] = datetime.now()

    method = request.method
    path = request.url.path
    user_agent = request.headers.get("user-agent", "Unknown")
    
    # Try to extract username from token if present
    username = "Anonymous"
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        try:
            token = auth_header.split(" ")[1]
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            username = payload.get("sub", "Anonymous")
        except:
            username = "InvalidToken"
            
    # Log the entry with Real IP
    access_logger.info(f"{real_ip} | {username} | {method} {path} | {user_agent}")
    
    # Track access count if user is authenticated
    if username != "Anonymous" and username != "InvalidToken":
        # We need a db session here
        db = database.SessionLocal()
        try:
            user = db.query(models.Nick).filter(models.Nick.username == username).first()
            if user:
                # Update last_active in Nick table
                user.last_active = datetime.now()
                
                today = datetime.now().date()
                access = db.query(models.UserAccess).filter(
                    models.UserAccess.user_id == user.id,
                    models.UserAccess.access_date == today
                ).first()
                if access:
                    # Update last_update to track recent activity
                    access.last_update = datetime.now()
                else:
                    # Create entry if it doesn't exist, but with count=0 (login will increment)
                    new_access = models.UserAccess(
                        user_id=user.id, 
                        access_date=today, 
                        count=0,
                        last_update=datetime.now()
                    )
                    db.add(new_access)
                db.commit()
        except Exception as e:
            print(f"[ERROR] Failed to track user access: {e}")
        finally:
            db.close()

    response = await call_next(request)
    return response

# Helper functions
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

# Pydantic models for Auth
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
    
    class Config:
        orm_mode = True

class UpdatePermissionRequest(BaseModel):
    allowed_classes: List[str]

DEFAULT_CLASSES = "DHMT16A1HN,DHMT16A2HN"

# Database Initialization & Admin User
@app.on_event("startup")
def startup_event():
    # Create tables if they don't exist
    database.create_tables()
    
    # Create initial admin user if not exists
    db = database.SessionLocal()
    try:
        # Check if any user exists in Nick table
        user = db.query(models.Nick).filter(models.Nick.username == "admin").first()
        if not user:
            admin_password = os.getenv("ADMIN_PASSWORD", "admin123")
            hashed_password = get_password_hash(admin_password)
            # Create new Nick with default role 1
            new_user = models.Nick(username="admin", password=hashed_password, role=1)
            db.add(new_user)
            db.commit()
            print("Created default admin user (admin/admin123) in 'nick' table")
    finally:
        db.close()

def format_student(sv, hide_details=False):
    return {
        "msv": sv.msv,
        "ho_ten": sv.ho_ten,
        "ngay_sinh": None if hide_details else sv.ngay_sinh,
        "ma_lop": sv.ma_lop,
        "noi_sinh": None if hide_details else sv.noi_sinh,
        "diem": [
            {
                "ma_mon": d.ma_mon,
                "ten_mon": d.ten_mon,
                "hoc_ky": d.hoc_ky,
                "so_tin_chi": d.so_tin_chi,
                "diem_thi": d.diem_thi,
                "tong_ket_10": d.tong_ket_10,
                "tong_ket_4": d.tong_ket_4,
                "diem_chu": d.diem_chu,
                "ket_qua": d.ket_qua,
                "chuyen_can": d.chuyen_can,
                "he_so_1_l1": d.he_so_1_l1,
                "he_so_1_l2": d.he_so_1_l2,
                "he_so_1_l3": d.he_so_1_l3,
                "he_so_1_l4": d.he_so_1_l4,
                "he_so_2_l1": d.he_so_2_l1,
                "he_so_2_l2": d.he_so_2_l2,
                "he_so_2_l3": d.he_so_2_l3,
                "he_so_2_l4": d.he_so_2_l4,
                "thuc_hanh_1": d.thuc_hanh_1,
                "thuc_hanh_2": d.thuc_hanh_2,
                "tb_thuong_ky": d.tb_thuong_ky,
                "dieu_kien_thi": d.dieu_kien_thi,
                "tb_hoc_ky_10": d.tb_hoc_ky_10,
                "tb_hoc_ky_4": d.tb_hoc_ky_4,
                "tb_tich_luy_10": d.tb_tich_luy_10,
                "tb_tich_luy_4": d.tb_tich_luy_4,
            } for d in sv.diem
        ]
    }

@app.post("/api/login", response_model=Token)
def login(request: LoginRequest, db: Session = Depends(database.get_db)):
    # Query Nick table
    user = db.query(models.Nick).filter(models.Nick.username == request.username).first()
    # Check password (assuming 'pass' column stores hash)
    if not user or not verify_password(request.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": user.username})
    
    # Track login specifically
    today = datetime.now().date()
    access = db.query(models.UserAccess).filter(
        models.UserAccess.user_id == user.id,
        models.UserAccess.access_date == today
    ).first()
    if access:
        access.count += 1
        access.last_update = datetime.now()
    else:
        new_access = models.UserAccess(
            user_id=user.id, 
            access_date=today, 
            count=1,
            last_update=datetime.now()
        )
        db.add(new_access)
    db.commit()
    
    return {"access_token": access_token, "token_type": "bearer", "role": user.role}

class RegisterRequest(BaseModel):
    username: str
    password: str

@app.post("/api/register")
def register(request: RegisterRequest, db: Session = Depends(database.get_db)):
    # Check if user exists
    user = db.query(models.Nick).filter(models.Nick.username == request.username).first()
    if user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    hashed_password = get_password_hash(request.password)
    # Default role 0 (Guest) with default permissions
    new_user = models.Nick(
        username=request.username, 
        password=hashed_password, 
        role=0,
        user_permission=DEFAULT_CLASSES
    )
    db.add(new_user)
    db.commit()
    return {"message": "User created successfully"}

# Better approach: Use OAuth2PasswordBearer for token extraction
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/login")

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(database.get_db)):
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

@app.get("/api/me", response_model=User)
def read_users_me(current_user: models.Nick = Depends(get_current_user)):
    return current_user

@app.get("/api/stats/student-count")
def get_student_count(
    current_user: models.Nick = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    from sqlalchemy import func
    
    if current_user.role == 0:
        # User role: Count only students in allowed classes
        # Parse from comma-separated string, fallback to defaults if None
        perms_str = current_user.user_permission if current_user.user_permission is not None else DEFAULT_CLASSES
        allowed = [x.strip() for x in perms_str.split(",") if x.strip()]
        if not allowed:
            return {"count": 0}
            
        count = db.query(func.count(models.SinhVien.msv)).filter(
            func.trim(models.SinhVien.ma_lop).in_(allowed)
        ).scalar()
    else:
        # Admin/Other roles: Count all students
        count = db.query(func.count(models.SinhVien.msv)).scalar()
        
    return {"count": count}

@app.get("/api/stats/online-users")
def get_online_users(
    current_user: models.Nick = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    # Prefer WebSocket count if available, otherwise fallback to active_users
    # Calculate unique IPs from WS manager
    if manager.active_connections:
        # Filter out connections that might've lost their 'ip' (shouldn't happen with new connect)
        unique_ips = {c.get("ip", "unknown") for c in manager.active_connections}
        return {"count": max(1, len(unique_ips))}

    # Threshold: 5 minutes
    threshold = datetime.now() - timedelta(minutes=5)
    
    # Filter and Count
    valid_count = 0
    to_remove = []
    
    for ip, last_seen in active_users.items():
        if last_seen > threshold:
            valid_count += 1
        else:
            to_remove.append(ip)
            
    # Cleanup
    for ip in to_remove:
        del active_users[ip]
        
    return {"count": max(1, valid_count)} # Minimum 1 for current user

@app.websocket("/ws/online-count")
async def websocket_endpoint(websocket: WebSocket):
    # Extract Real IP for logging/fallback
    real_ip = websocket.headers.get("CF-Connecting-IP") or \
              websocket.headers.get("X-Forwarded-For") or \
              (websocket.client.host if websocket.client else "unknown")
              
    if "," in real_ip:
        real_ip = real_ip.split(",")[0].strip()

    # Attempt to authenticate via Token in Query Param
    token = websocket.query_params.get("token")
    user_identifier = f"Guest-{real_ip}"
    
    if token:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            username = payload.get("sub")
            if username:
                user_identifier = username
                print(f"[WS AUTH] Authenticated user: {username}")
        except Exception as e:
            print(f"[WS AUTH] Token invalid/expired: {e}. Falling back to IP.")
            pass

    print(f"[WS DEBUG] New connection request. ID: {user_identifier} | IP: {real_ip}")
    await manager.connect(websocket, user_identifier, real_ip)
    try:
        while True:
            # Keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        print(f"[WS] WebSocketDisconnect from {user_identifier}")
        manager.disconnect(websocket)
        await manager.broadcast_online_count()
    except Exception as e:
        print(f"[WS] Error in connection from {user_identifier}: {e}")
        manager.disconnect(websocket)
        await manager.broadcast_online_count()

@app.get("/api/classes")
def get_classes(
    current_user: models.Nick = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    print(f"DEBUG: User '{current_user.username}' (Role: {current_user.role}) fetching classes")
    from sqlalchemy import func
    
    if current_user.role == 0:
        # User role: Restrict to specific classes
        perms_str = current_user.user_permission if current_user.user_permission is not None else DEFAULT_CLASSES
        allowed = [x.strip() for x in perms_str.split(",") if x.strip()]
        return {"classes": allowed}
    
    # Admin role (or others): Show all classes, using trim to be safe
    classes = db.query(func.trim(models.SinhVien.ma_lop)).distinct().order_by(func.trim(models.SinhVien.ma_lop)).all()
    result = [c[0] for c in classes if c[0]]
    print(f"DEBUG: Found {len(result)} classes")
    return {"classes": result}

def calculate_gpa(student):
    if not student.diem:
        return {"gpa4": 0.0, "gpa10": 0.0}
    
    subject_map = {}
    for d in student.diem:
        try:
            score4 = float(d.tong_ket_4)
            score10 = float(d.tong_ket_10)
            credit = int(d.so_tin_chi)
        except (ValueError, TypeError):
            continue
            
        if credit == 0:
            continue
            
        name = d.ten_mon.strip().lower() if d.ten_mon else ""
        # Exclude non-GPA subjects
        if any(x in name for x in ['giáo dục thể chất', 'gdtc', 'giáo dục quốc phòng', 'gdqp', 'thể dục']):
            continue
            
        # Deduplicate: Keep highest score (using scale 4 as reference for "highest", usually they correlate)
        if d.ma_mon in subject_map:
            if score4 > subject_map[d.ma_mon]['score4']:
                subject_map[d.ma_mon] = {'score4': score4, 'score10': score10, 'credit': credit}
        else:
            subject_map[d.ma_mon] = {'score4': score4, 'score10': score10, 'credit': credit}
            
    total_points4 = sum(item['score4'] * item['credit'] for item in subject_map.values())
    total_points10 = sum(item['score10'] * item['credit'] for item in subject_map.values())
    total_credits = sum(item['credit'] for item in subject_map.values())
    
    if total_credits == 0:
        return {"gpa4": 0.0, "gpa10": 0.0}
        
    return {
        "gpa4": round(total_points4 / total_credits, 2),
        "gpa10": round(total_points10 / total_credits, 2)
    }

@app.get("/api/class/{ma_lop}/students")
def get_students_by_class(
    ma_lop: str, 
    current_user: models.Nick = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    print(f"DEBUG: Fetching students for class '{ma_lop}'")
    from sqlalchemy import func
    from sqlalchemy.orm import joinedload
    
    # Support multiple classes (comma separated)
    class_list = [c.strip() for c in ma_lop.split(',')]
    
    # Use TRIM and case-insensitive matching for ma_lop
    # Eager load 'diem' to avoid N+1 problem and actually get the data
    # Eager load 'diem' to avoid N+1 problem and actually get the data
    query = db.query(models.SinhVien).options(joinedload(models.SinhVien.diem)).filter(
        func.trim(models.SinhVien.ma_lop).in_(class_list)
    )
    
    if current_user.role == 0:
        # Security Check: Ensure user is allowed to view THESE classes
        perms_str = current_user.user_permission if current_user.user_permission is not None else DEFAULT_CLASSES
        allowed_list = [x.strip() for x in perms_str.split(",") if x.strip()]
        allowed_set = set(allowed_list)
        # If any requested class is NOT in allowed list, forbid or filter?
        # Let's filter: only return students from allowed classes intersection
        valid_classes = [c for c in class_list if c in allowed_set]
        if not valid_classes:
            return {"students": []}
            
        # Re-apply filter with ONLY valid classes
        query = db.query(models.SinhVien).options(joinedload(models.SinhVien.diem)).filter(
            func.trim(models.SinhVien.ma_lop).in_(valid_classes)
        )
        
    students = query.order_by(models.SinhVien.msv).all()
    print(f"DEBUG: Found {len(students)} students for classes: {class_list}")
    
    hide = (current_user.role == 0)
    
    # Return full student details including grades AND calculated GPA
    # Re-use format_student to ensure consistent structure, but append GPA
    result_list = []
    for sv in students:
        formatted = format_student(sv, hide_details=hide)
        gpas = calculate_gpa(sv)
        formatted["gpa"] = gpas["gpa4"]
        formatted["gpa10"] = gpas["gpa10"]
        result_list.append(formatted)
        
    return {"students": result_list}

@app.get("/api/student/{msv}")
def get_student_detail(
    msv: str, 
    current_user: models.Nick = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    student = db.query(models.SinhVien).filter(models.SinhVien.msv == msv).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    formatted = format_student(student, hide_details=(current_user.role == 0))
    gpas = calculate_gpa(student)
    formatted["gpa"] = gpas["gpa4"]
    formatted["gpa10"] = gpas["gpa10"]
    return formatted

@app.get("/api/search")
def search_students(
    query: str = Query(..., min_length=1), 
    current_user: models.Nick = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    # Search for students by name or msv
    students = db.query(models.SinhVien).filter(
        (models.SinhVien.ho_ten.ilike(f"%{query}%")) | 
        (models.SinhVien.msv.ilike(f"%{query}%"))
    ).all()
    
    if not students:
        return {"results": []}
    
    hide = (current_user.role == 0)
    results = []
    for sv in students:
        formatted = format_student(sv, hide_details=hide)
        gpas = calculate_gpa(sv)
        formatted["gpa"] = gpas["gpa4"]
        formatted["gpa10"] = gpas["gpa10"]
        results.append(formatted)
        
    return {"results": results}


@app.get("/api/admin/users")
def get_all_users(
    current_user: models.Nick = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    if current_user.role != 1:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    users = db.query(models.Nick).all()
    result = []
    
    # Get last 30 days range
    thirty_days_ago = datetime.now().date() - timedelta(days=30)
    
    for u in users:
        perms_str = u.user_permission if u.user_permission is not None else DEFAULT_CLASSES
        
        # Fetch access history for this user (last 30 days)
        history = db.query(models.UserAccess).filter(
            models.UserAccess.user_id == u.id,
            models.UserAccess.access_date >= thirty_days_ago
        ).order_by(models.UserAccess.access_date.desc()).all()
        
        access_history = [{"date": str(h.access_date), "count": h.count} for h in history]
        
        result.append({
            "id": u.id,
            "username": u.username,
            "role": u.role,
            "allowed_classes": [x.strip() for x in perms_str.split(",") if x.strip()],
            "access_history": access_history
        })
    return result

@app.post("/api/admin/user/{user_id}/permissions")
def update_user_permissions(
    user_id: int,
    request: UpdatePermissionRequest,
    current_user: models.Nick = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    if current_user.role != 1:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    user = db.query(models.Nick).filter(models.Nick.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Join into comma-separated string
    user.user_permission = ",".join(request.allowed_classes)
        
    db.commit()
    return {"message": "Permissions updated"}

if __name__ == "__main__":
    import uvicorn
    host = os.getenv("BACKEND_HOST", "127.0.0.1")
    port = int(os.getenv("BACKEND_PORT", "8000"))
    uvicorn.run("main:app", host=host, port=port, reload=True)
