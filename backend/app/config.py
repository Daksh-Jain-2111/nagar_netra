import os
from pathlib import Path
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    JWT_SECRET: str = "super_secret_nagarnetra_dev_key_2026_change_in_prod"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    DB_PATH: str = str(BASE_DIR / "localdb" / "nagarnetra.db")
    UPLOAD_DIR: str = str(BASE_DIR / "localdb" / "uploads")
    DEV_MODE: bool = True
    OTP_MODE: str = "mock"  # mock uses 123456
    CORS_ORIGINS: str = "*"
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # --- AI image classification (civic issue) ---
    # Provider: "clip_zero_shot" (ONNX CLIP image encoder + prebuilt issue text embeddings),
    # "onnx_classifier" (fine-tuned ONNX classifier + labels in manifest.json) or "disabled".
    AI_CLASSIFIER_PROVIDER: str = "clip_zero_shot"
    AI_MODEL_DIR: str = str(BASE_DIR / "ml_models" / "clip-vit-b16-laion400m")
    AI_VERIFY_MODEL_CHECKSUM: bool = True
    AI_PRELOAD_MODEL: bool = True          # warm the model in the background on startup
    AI_ONNX_INTRA_OP_THREADS: int = 0      # 0 = let onnxruntime decide
    AI_MAX_IMAGES: int = 3
    AI_MAX_IMAGE_BYTES: int = 8 * 1024 * 1024
    AI_MAX_IMAGE_PIXELS: int = 40_000_000  # decompression-bomb guard (~40 MP)
    AI_ALLOWED_IMAGE_FORMATS: str = "JPEG,PNG,WEBP"
    AI_INFERENCE_TIMEOUT_SECONDS: float = 20.0
    AI_MAX_CONCURRENT_INFERENCES: int = 2
    AI_TOP_K: int = 3
    # Confidence bands (model softmax probability, NOT accuracy). Must satisfy strong >= suggestion >= min.
    AI_CONFIDENCE_STRONG: float = 0.80
    AI_CONFIDENCE_SUGGESTION: float = 0.60
    AI_CONFIDENCE_MIN: float = 0.40

    # --- Voice complaints: storage + speech-to-text ---
    # STT provider: "whisper_onnx" (offline Whisper; model via backend/scripts/download_speech_model.py)
    # or "disabled" (recordings are still stored; citizens type the description).
    STT_PROVIDER: str = "whisper_onnx"
    STT_MODEL_DIR: str = str(BASE_DIR / "ml_models" / "whisper-turbo")
    STT_PRELOAD_MODEL: bool = True
    STT_INTRA_OP_THREADS: int = 0
    STT_TIMEOUT_SECONDS: float = 90.0
    VOICE_MAX_BYTES: int = 10 * 1024 * 1024
    VOICE_MAX_SECONDS: float = 120.0
    VOICE_ALLOWED_CONTAINERS: str = "webm,ogg,mp4,wav,mp3,aac"

    class Config:
        env_file = str(BASE_DIR / ".env")
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()

# Ensure local directories exist
os.makedirs(os.path.dirname(settings.DB_PATH), exist_ok=True)
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
