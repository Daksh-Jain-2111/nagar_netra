import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models.models import HelpdeskLog, User
from backend.app.schemas.schemas import HelpdeskLogCreate
from backend.app.services.auth_service import get_current_user

router = APIRouter(prefix="/helpdesk", tags=["helpdesk"])

@router.post("/log")
def create_helpdesk_log(
    payload: HelpdeskLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    entry = HelpdeskLog(
        corporation_id=current_user.corporation_id or "SMKMC",
        operator_id=current_user.id,
        operator_name=current_user.name,
        log_type=payload.log_type,
        caller_mobile=payload.caller_mobile,
        caller_name=payload.caller_name,
        complaint_id=payload.complaint_id,
        redirect_target=payload.redirect_target,
        notes=payload.notes,
        created_at=datetime.datetime.utcnow()
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry

@router.get("/logs")
def list_helpdesk_logs(
    log_type: Optional[str] = None,
    today_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    q = db.query(HelpdeskLog).filter(
        HelpdeskLog.corporation_id == (current_user.corporation_id or "SMKMC")
    )
    if log_type:
        q = q.filter(HelpdeskLog.log_type == log_type)
    if today_only:
        start_of_day = datetime.datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        q = q.filter(HelpdeskLog.created_at >= start_of_day)

    return q.order_by(HelpdeskLog.created_at.desc()).all()
