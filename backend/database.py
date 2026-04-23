import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

load_dotenv()

# Fetch variables
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")
IS_PRODUCTION = (
    os.getenv("NODE_ENV", "").lower() == "production"
    or os.getenv("ENV", "").lower() == "production"
)

if not SQLALCHEMY_DATABASE_URL:
    if IS_PRODUCTION:
        raise RuntimeError("DATABASE_URL must be set in production environment")

    # Fallback to individual variables if DATABASE_URL is not set
    USER = os.getenv("user")
    PASSWORD = os.getenv("password")
    HOST = os.getenv("host")
    PORT = os.getenv("port")
    DBNAME = os.getenv("dbname")
    
    if USER and HOST and DBNAME:
        SQLALCHEMY_DATABASE_URL = f"postgresql://{USER}:{PASSWORD}@{HOST}:{PORT}/{DBNAME}"
        print(f"[INFO] DB_CONNECTION: Constructed URL from components")
    else:
        # Fallback to SQLite ONLY for local development if no Postgres config found
        print("[WARNING] DATABASE_URL not found. Falling back to SQLite: students.db (Local Mode Only)")
        SQLALCHEMY_DATABASE_URL = "sqlite:///./students.db"

# 🕵️ DATABASE_URL PRE-PROCESSOR
# Ensure we use raw URL if possible, fallback to Konstruksi manual if needed
raw_url = os.getenv("DATABASE_URL")
if raw_url:
    SQLALCHEMY_DATABASE_URL = raw_url
    if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
        # Fix for old Heroku/Supabase format which SQLAlchemy doesn't like
        SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)
    print(f"[INFO] DB_CONNECTION: Using DATABASE_URL from .env")
elif not SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    print(f"[INFO] DB_CONNECTION: Using manually constructed URL")

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_size=10,
    max_overflow=20,
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
    # 🕵️ RESCUE: Bỏ qua nếu chưa cấu hình URL để tránh treo Server
    if not SQLALCHEMY_DATABASE_URL or "missing_url_placeholder" in SQLALCHEMY_DATABASE_URL:
        print("[SKIP] Sync: Skipping schema sync because DATABASE_URL is not configured.")
        return

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
                if 'parent_id' not in columns:
                    print("[INFO] Sync: Adding 'parent_id' to chat_messages")
                    conn.execute(text("ALTER TABLE chat_messages ADD COLUMN parent_id BIGINT"))

            
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
        error_msg = str(e)
        if "Circuit breaker open" in error_msg:
            print("\n" + "!"*60)
            print("[CRITICAL] DATABASE CONNECTION BLOCKED BY SUPABASE")
            print("The 'Circuit breaker open' error means too many authentication failures.")
            print("1. Check if your password in .env is correct.")
            print("2. STOP all connection attempts for 5-10 minutes.")
            print("3. Restart the backend once the cooldown is over.")
            print("!"*60 + "\n")
        else:
            print(f"[CRITICAL] Sync: Schema synchronization failed: {e}")
        # We don't re-raise to allows the server to start (even in limited mode)
        # so diagnostic endpoints (/health) remain accessible.
