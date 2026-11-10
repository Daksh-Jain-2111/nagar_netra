import io
import csv
import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models.models import (
    Complaint, ComplaintEvent, User, Department, Category, Setting, AuditLog, InviteCode
)
from backend.app.schemas.schemas import ComplaintResponse
from backend.app.services.auth_service import get_current_user, require_role
from backend.app.services.audit_service import AuditService
from backend.app.services.time_service import get_now

router = APIRouter(prefix="/admin", tags=["admin"])

class InviteUserRequest(BaseModel):
    name: str
    email: str
    mobile: Optional[str] = None
    role: str = Field(..., description="Must be 'supervisor' or 'helpdesk' ONLY")
    unit_id: Optional[str] = None

class SettingUpdateRequest(BaseModel):
    key: str
    value: Dict[str, Any]

@router.get("/dashboard")
def get_admin_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["corp_admin", "platform_admin"]))
):
    """
    All numbers computed strictly from the database.
    Zero hardcoded counts, percentages, or charts.
    """
    corp_id = current_user.corporation_id
    complaints = db.query(Complaint).filter(Complaint.corporation_id == corp_id).all()

    total = len(complaints)
    open_count = sum(1 for c in complaints if c.status in ["SUBMITTED", "TO_CHECK", "ASSIGNED"])
    in_progress = sum(1 for c in complaints if c.status in ["IN_PROGRESS", "WORK_SCHEDULED"])
    resolved = sum(1 for c in complaints if c.status == "RESOLVED")
    closed = sum(1 for c in complaints if c.status == "CLOSED")
    escalated = sum(1 for c in complaints if c.escalation_level is not None and c.status not in ["CLOSED", "REJECTED"])
    supervisor_overdue = sum(1 for c in complaints if c.supervisor_overdue)
    danger_count = sum(1 for c in complaints if c.danger_flag)

    # Resolution SLA compliance computation
    resolved_complaints = [c for c in complaints if c.resolved_at is not None]
    within_sla = sum(1 for c in resolved_complaints if c.resolution_due and c.resolved_at <= c.resolution_due)
    sla_compliance_rate = round((within_sla / len(resolved_complaints)) * 100, 1) if resolved_complaints else 100.0

    # Department breakdown
    dept_stats: Dict[str, int] = {}
    for c in complaints:
        dept_name = c.category.department.name if c.category and c.category.department else "General"
        dept_stats[dept_name] = dept_stats.get(dept_name, 0) + 1

    # Category breakdown
    cat_stats: Dict[str, int] = {}
    for c in complaints:
        cat_name = c.category.name if c.category else "Other"
        cat_stats[cat_name] = cat_stats.get(cat_name, 0) + 1

    # Staff counts
    staff_count = db.query(User).filter(
        User.corporation_id == corp_id,
        User.role.in_(["field_officer", "supervisor", "helpdesk"])
    ).count()

    return {
        "kpi": {
            "total_complaints": total,
            "open": open_count,
            "in_progress": in_progress,
            "resolved": resolved,
            "closed": closed,
            "escalated": escalated,
            "supervisor_overdue": supervisor_overdue,
            "danger_flagged": danger_count,
            "sla_compliance_percent": sla_compliance_rate,
            "total_staff": staff_count
        },
        "by_department": dept_stats,
        "by_category": cat_stats
    }

@router.get("/supervisor-overdue", response_model=List[ComplaintResponse])
def get_supervisor_overdue_list(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["corp_admin", "platform_admin"]))
):
    """
    Corporation admin's view-only list for complaints where supervisor
    has remained inactive for >72h after escalation.
    """
    return db.query(Complaint).filter(
        Complaint.corporation_id == current_user.corporation_id,
        Complaint.supervisor_overdue == True
    ).order_by(Complaint.escalated_at.asc()).all()

@router.get("/reports")
def get_admin_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["corp_admin", "platform_admin"]))
):
    """Generates analytical report breakdown computed directly from the DB."""
    corp_id = current_user.corporation_id
    complaints = db.query(Complaint).filter(Complaint.corporation_id == corp_id).all()

    ward_breakdown: Dict[str, int] = {}
    channel_breakdown: Dict[str, int] = {}
    for c in complaints:
        w = c.ward.name if c.ward else "Unassigned Ward"
        ward_breakdown[w] = ward_breakdown.get(w, 0) + 1
        ch = c.channel or "app"
        channel_breakdown[ch] = channel_breakdown.get(ch, 0) + 1

    return {
        "corporation_id": corp_id,
        "total_records": len(complaints),
        "wards": ward_breakdown,
        "channels": channel_breakdown,
        "generated_at": get_now().isoformat()
    }

@router.get("/audit-log/export.csv")
def export_audit_log_csv(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["corp_admin", "platform_admin"]))
):
    """Exports civic audit trail to CSV."""
    logs = db.query(AuditLog).filter(
        AuditLog.corporation_id == current_user.corporation_id
    ).order_by(AuditLog.created_at.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Timestamp (UTC)", "Actor Role", "Actor Name", "Action", "Entity Type", "Entity ID", "Details"])

    for l in logs:
        writer.writerow([
            l.id,
            l.created_at.isoformat() if l.created_at else "",
            l.actor_role,
            l.actor_name,
            l.action,
            l.entity_type,
            l.entity_id or "",
            str(l.details or {})
        ])

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=nagarnetra_audit_log.csv"}
    )

@router.post("/users/invite")
def invite_user(
    payload: InviteUserRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["corp_admin"]))
):
    """
    Invite staff users.
    Rule: Roles supervisor and helpdesk ONLY.
    field_officer is strictly forbidden (must use ward join code).
    """
    if payload.role == "field_officer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Field officers cannot be invited directly by corp admin. They must join using a ward invite code."
        )

    if payload.role not in ["supervisor", "helpdesk"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Corporation admin can only invite 'supervisor' or 'helpdesk' roles."
        )

    clean_email = payload.email.lower().strip()
    existing = db.query(User).filter(User.email == clean_email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    new_user = User(
        id=f"usr_inv_{clean_email.split('@')[0]}",
        corporation_id=current_user.corporation_id,
        name=payload.name,
        email=clean_email,
        mobile=payload.mobile,
        role=payload.role,
        unit_id=payload.unit_id,
        is_active=True
    )
    db.add(new_user)
    db.commit()

    AuditService.log(
        db=db,
        corporation_id=current_user.corporation_id,
        actor_id=current_user.id,
        actor_name=current_user.name,
        actor_role="corp_admin",
        action="INVITE_USER",
        entity_type="user",
        entity_id=new_user.id,
        details={"role": payload.role, "email": clean_email}
    )

    return {"status": "SUCCESS", "message": f"Successfully invited {payload.role}: {clean_email}", "user_id": new_user.id}

@router.get("/settings")
def get_corporation_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["corp_admin", "platform_admin"]))
):
    """Returns corporation settings including L2 escalation toggle status."""
    settings = db.query(Setting).filter(Setting.corporation_id == current_user.corporation_id).all()
    res = {s.key: s.value for s in settings}
    if "enable_l2" not in res:
        res["enable_l2"] = {"enabled": False} # Default OFF
    return res

@router.put("/settings")
def update_corporation_setting(
    payload: SettingUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["corp_admin", "platform_admin"]))
):
    """Updates corporation setting (e.g. enable_l2 toggle)."""
    setting = db.query(Setting).filter(
        Setting.corporation_id == current_user.corporation_id,
        Setting.key == payload.key
    ).first()

    if not setting:
        setting = Setting(
            corporation_id=current_user.corporation_id,
            key=payload.key,
            value=payload.value
        )
        db.add(setting)
    else:
        setting.value = payload.value

    db.commit()

    AuditService.log(
        db=db,
        corporation_id=current_user.corporation_id,
        actor_id=current_user.id,
        actor_name=current_user.name,
        actor_role=current_user.role,
        action="UPDATE_SETTING",
        entity_type="setting",
        entity_id=payload.key,
        details={"key": payload.key, "value": payload.value}
    )

    return {"status": "SUCCESS", "key": payload.key, "value": payload.value}
