import os
import threading
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.app.config import settings
from backend.app.database import engine, Base
from backend.app.seed.seed_data import seed_database
from backend.app.scheduler.clock_scheduler import start_scheduler
from backend.app.ml.registry import preload_classifier
from backend.app.speech.registry import preload_speech_model
from backend.app.seed.demo_voice_ticket import ensure_demo_voice_ticket
from backend.app.routers import (
    auth_router,
    complaints_router,
    approvals_router,
    officers_router,
    routing_router,
    helpdesk_router,
    master_router,
    audit_router,
    ai_router,
    supervisor_router,
    admin_router,
    platform_router,
    notifications_router,
    dev_router,
    voice_notes_router,
    admin_ai_router
)

# Initialize database schema
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="NagarNetra Civic Governance API",
    description="Backend API for Sangli Miraj Kupwad Municipal Corporation (SMKMC) Civic Complaint System",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS configuration
origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
]
if settings.CORS_ORIGINS == "*":
    allow_origins = ["*"]
else:
    allow_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Uploads directory
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/api/v1/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Include Routers under /api/v1
app.include_router(auth_router, prefix="/api/v1")
app.include_router(complaints_router, prefix="/api/v1")
app.include_router(approvals_router, prefix="/api/v1")
app.include_router(officers_router, prefix="/api/v1")
app.include_router(routing_router, prefix="/api/v1")
app.include_router(helpdesk_router, prefix="/api/v1")
app.include_router(master_router, prefix="/api/v1")
app.include_router(audit_router, prefix="/api/v1")
app.include_router(ai_router, prefix="/api/v1")
app.include_router(supervisor_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")
app.include_router(platform_router, prefix="/api/v1")
app.include_router(notifications_router, prefix="/api/v1")
app.include_router(dev_router, prefix="/api/v1")
app.include_router(voice_notes_router, prefix="/api/v1")
app.include_router(admin_ai_router, prefix="/api/v1")

@app.on_event("startup")
def on_startup():
    print("NagarNetra API starting up...")
    seed_database()
    try:
        ensure_demo_voice_ticket()
    except Exception as e:
        print(f"Warning: could not seed demo voice ticket: {e}")
    # AI model history: create new tables + one-time backfill, then read model metadata in background
    try:
        from backend.app.database import SessionLocal
        from backend.app.services.ai_history_service import run_migrations
        _db = SessionLocal()
        try:
            run_migrations(engine, _db)
        finally:
            _db.close()
    except Exception as e:
        print(f"Warning: AI history migration failed: {e}")
    try:
        from backend.app.services.ai_model_registry_service import sync_in_background
        sync_in_background()
    except Exception as e:
        print(f"Warning: could not start AI model registry sync: {e}")
    from backend.app.speech.audio import pyav_available
    if not pyav_available():
        print("WARNING: PyAV is not installed - voice notes recorded in the browser (WebM/MP4) cannot be "
              "processed. Run: pip install -r backend/requirements.txt")
    try:
        start_scheduler()
        print("SLA clock scheduler started.")
    except Exception as e:
        print(f"Warning: could not start scheduler: {e}")
    if settings.AI_PRELOAD_MODEL:
        # Warm the civic issue image classifier without blocking startup.
        threading.Thread(target=preload_classifier, name="ai-model-preload", daemon=True).start()
    if settings.STT_PRELOAD_MODEL:
        threading.Thread(target=preload_speech_model, name="stt-model-preload", daemon=True).start()

@app.get("/health")
@app.get("/api/v1/health")
def health_check():
    return {
        "status": "healthy",
        "service": "NagarNetra SMKMC API",
        "version": "1.0.0",
        "mode": "DEV" if settings.DEV_MODE else "PROD"
    }
