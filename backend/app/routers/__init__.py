from backend.app.routers.auth import router as auth_router
from backend.app.routers.complaints import router as complaints_router
from backend.app.routers.approvals import router as approvals_router
from backend.app.routers.officers import router as officers_router
from backend.app.routers.routing import router as routing_router
from backend.app.routers.helpdesk import router as helpdesk_router
from backend.app.routers.master_data import router as master_router
from backend.app.routers.audit import router as audit_router
from backend.app.routers.ai import router as ai_router
from backend.app.routers.supervisor import router as supervisor_router
from backend.app.routers.admin import router as admin_router
from backend.app.routers.platform import router as platform_router
from backend.app.routers.notifications import router as notifications_router
from backend.app.routers.dev import router as dev_router
from backend.app.routers.voice_notes import router as voice_notes_router
from backend.app.routers.admin_ai import router as admin_ai_router

__all__ = [
    "auth_router",
    "complaints_router",
    "approvals_router",
    "officers_router",
    "routing_router",
    "helpdesk_router",
    "master_router",
    "audit_router",
    "ai_router",
    "supervisor_router",
    "admin_router",
    "platform_router",
    "notifications_router",
    "dev_router",
    "voice_notes_router",
    "admin_ai_router",
]
