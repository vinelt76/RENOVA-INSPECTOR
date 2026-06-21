from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    PROJECT_NAME: str = "RENOVA INSPECTOR"
    API_V1_STR: str = "/api/v1"
    
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/renova"
    
    # Security
    SECRET_KEY: str = "SUPER_SECRET_KEY_FOR_RENOVA_INSPECTOR_development_only_123456"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days for mobile offline ease
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["*"]
    
    # Cloudflare R2 / S3
    R2_BUCKET_NAME: str = "renova-inspector-photos"
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    
    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()
