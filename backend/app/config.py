import os

class Settings:
    PROJECT_NAME: str = "UberBasi Matatu Booking & Ticketing"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "supermetro-secret-key-uberbasi-2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 7 days
    
    # DB URL - Fall back to SQLite async if Postgres is not set
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "sqlite+aiosqlite:///./uberbasi.db"
    )
    
    PLATFORM_FEE_AMOUNT: float = 3.00 # KES 3 per confirmed ticket

settings = Settings()
