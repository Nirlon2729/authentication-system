from pydantic_settings import BaseSettings
from functools import lru_cache
import os
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    GATEWAY_HOST: str = os.getenv("GATEWAY_HOST", "0.0.0.0")
    GATEWAY_PORT: int = int(os.getenv("GATEWAY_PORT", "8000"))
    BACKEND_URL: str = os.getenv("BACKEND_URL", "http://localhost:5000")
    REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
    
    WINDOW_SIZE_SECONDS: int = int(os.getenv("WINDOW_SIZE_SECONDS", "10"))
    ANOMALY_THRESHOLD: float = float(os.getenv("ANOMALY_THRESHOLD", "-0.55"))
    BAN_DURATION_SECONDS: int = int(os.getenv("BAN_DURATION_SECONDS", "3600"))
    
    ADMIN_API_KEY: str = os.getenv("ADMIN_API_KEY", "change-this-in-production")
    FRONTEND_ORIGIN: str = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

    class Config:
        env_file = ".env"
        extra = "ignore"

@lru_cache()
def get_settings() -> Settings:
    return Settings()
