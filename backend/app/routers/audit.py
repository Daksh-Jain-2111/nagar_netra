from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models.models import AuditLog, User
from backend.app.schemas.schemas import AuditLogResponse
from backend.app.services.auth_service import get_current_user, require_roles

router = APIRouter(prefix="/audit", tags=["audit"])

@router.get("/logs", response_model=List[AuditLogResponse])
def get_audit_logs(
    actor_id: Optional[str] = None,
    action: Optional[str] = None,
    entity_id: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["corp_admin", "supervisor", "platform_admin"]))
):
    q = db.query(AuditLog).filter(
        AuditLog.corporation_id == (current_user.corporation_id or "SMKMC")
    )
    if actor_id:
        q = q.filter(AuditLog.actor_id == actor_id)
    if action:
        q = q.filter(AuditLog.action.contains(action))
    if entity_id:
        q = q.filter(AuditLog.entity_id == entity_id)

    return q.order_by(AuditLog.created_at.desc()).limit(limit).all()
