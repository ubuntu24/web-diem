from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

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
    print("⚠️ WARNING: DATABASE_URL not found. Falling back to SQLite: students.db")
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
    pool_size=5,
    max_overflow=10,
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
