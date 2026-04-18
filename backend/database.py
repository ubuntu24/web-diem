import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

load_dotenv()

# Fetch variables
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

if not SQLALCHEMY_DATABASE_URL:
    # Fallback to individual variables if DATABASE_URL is not set
    USER = os.getenv("user")
    PASSWORD = os.getenv("password")
    HOST = os.getenv("host")
    PORT = os.getenv("port")
    DBNAME = os.getenv("dbname")
    
    if USER and HOST and DBNAME:
        SQLALCHEMY_DATABASE_URL = f"postgresql://{USER}:{PASSWORD}@{HOST}:{PORT}/{DBNAME}"
    else:
        # Fallback to SQLite for local development if no Postgres config found
        SQLALCHEMY_DATABASE_URL = "sqlite:///./students.db"

# Create the SQLAlchemy engine
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    print("WARNING: DATABASE_URL not found. Falling back to SQLite: students.db")
else:
    try:
        # Mask password: postgres://user:pass@host/db -> postgres://user:***@host/db
        parts = SQLALCHEMY_DATABASE_URL.split('@')
        host_info = parts[-1]
        print(f"[INFO] DB_CONNECTION: Connected to Postgres at {host_info}")
    except Exception as e:
        print(f"[ERROR] DB_CONNECTION: Failed to connect to Postgres: {e}")
        print("[INFO] DB_CONNECTION: Connected to Postgres")

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_size=10,       # tăng từ 5 → 10 concurrent DB connections
    max_overflow=20,    # tăng từ 10 → 20 overflow connections
    pool_pre_ping=True,
    pool_recycle=1800,
)

# Create a SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()

# Dependency to get the database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_tables():
    Base.metadata.create_all(bind=engine)

def sync_schema():
    """Tự động đồng bộ hóa cấu trúc bảng cho môi trường Production (Postgres/SQLite)"""
    try:
        print("[INFO] Sync: Starting schema synchronization...")
        inspector = inspect(engine)
        table_names = inspector.get_table_names()
        
        with engine.connect() as conn:
            # 1. Đồng bộ bảng chat_messages
            if 'chat_messages' in table_names:
                columns = [c['name'] for c in inspector.get_columns('chat_messages')]
                if 'ip_address' not in columns:
                    print("[INFO] Sync: Adding 'ip_address' to chat_messages")
                    conn.execute(text("ALTER TABLE chat_messages ADD COLUMN ip_address TEXT"))
                if 'device_fingerprint' not in columns:
                    print("[INFO] Sync: Adding 'device_fingerprint' to chat_messages")
                    conn.execute(text("ALTER TABLE chat_messages ADD COLUMN device_fingerprint TEXT"))
            
            # 2. Đồng bộ bảng nick
            if 'nick' in table_names:
                columns = [c['name'] for c in inspector.get_columns('nick')]
                if 'class_change_limit' not in columns:
                    print("[INFO] Sync: Adding 'class_change_limit' to nick")
                    conn.execute(text("ALTER TABLE nick ADD COLUMN class_change_limit INTEGER DEFAULT 5"))
                if 'full_name' not in columns:
                    print("[INFO] Sync: Adding 'full_name' to nick")
                    conn.execute(text("ALTER TABLE nick ADD COLUMN full_name TEXT"))
                if 'last_active' not in columns:
                    print("[INFO] Sync: Adding 'last_active' to nick")
                    conn.execute(text("ALTER TABLE nick ADD COLUMN last_active TIMESTAMP"))
                if 'reset_limit_at' not in columns:
                    print("[INFO] Sync: Adding 'reset_limit_at' to nick")
                    conn.execute(text("ALTER TABLE nick ADD COLUMN reset_limit_at TIMESTAMP"))

            conn.commit()
        
        # create_tables() sẽ tự động tạo bảng mới nếu chưa có
        print("[INFO] Sync: Ensuring all tables exist...")
        create_tables()
        print("[INFO] Sync: Schema synchronization complete.")
    except Exception as e:
        print(f"[ERROR] Sync: Schema synchronization failed: {e}")
