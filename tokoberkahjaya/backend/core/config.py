import logging
import os

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("tokoberkahjaya")

DEFAULT_SECRET_KEY = "your-secret-key-change-this-in-production"


class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL") or "sqlite:///./tokoberkahjaya.db"
    SECRET_KEY: str = os.getenv("SECRET_KEY") or DEFAULT_SECRET_KEY
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "720"))
    CORS_ORIGINS: list[str] = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
        if origin.strip()
    ]
    MAX_UPLOAD_MB: int = int(os.getenv("MAX_UPLOAD_MB", "10"))
    TEMP_IMPORT_DIR: str = os.getenv("TEMP_IMPORT_DIR", "temp_imports")


settings = Settings()

if settings.SECRET_KEY == DEFAULT_SECRET_KEY:
    logger.warning("SECRET_KEY masih memakai nilai default. Ganti sebelum dipakai di production.")
