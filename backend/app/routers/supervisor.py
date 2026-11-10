import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models.models import Complaint, ComplaintEvent, User, OrgUnit
from backend.app.schemas.schemas import ComplaintResponse
from backend.app.services.auth_service import get_current_user, require_role
from backend.app.services.audit_service import AuditService, NotificationService
from backend.app.services.time_service import get_now

router = APIRouter(prefix="/supervisor", tags=["supervisor"])

class InstructRequest(BaseModel):
    instruction: str = Field(..., description="Binding instruction from supervisor to field officer")

class ReassignRequest(BaseModel):
    new_assignee_id: str
    reason: str

@router.get("/to-check", response_model=List[ComplaintResponse])
def get_to_check_queue(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["supervisor", "corp_admin"]))
):
    """Returns complaints awaiting human verification / routing check."""
    return db.query(Complaint).filter(
        Complaint.corporation_id == current_user.corporation_id,
        Complaint.status == "TO_CHECK"
    ).order_by(Complaint.created_at.asc()).all()

@router.get("/escalations", response_model=List[ComplaintResponse])
def get_escalations_queue(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["supervisor", "corp_admin"]))
):
    """Returns all escalated complaints (L1/L2) within the corporation."""
    return db.query(Complaint).filter(
        Complaint.corporation_id == current_user.corporation_id,
        Complaint.escalation_level.isnot(None),
        Complaint.status.notin_(["CLOSED", "REJECTED", "RESOLVED"])
    ).order_by(Complaint.escalated_at.desc()).all()

@router.post("/escalations/{ref}/instruct")
def instruct_escalation(
    ref: str,
    payload: InstructRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["supervisor", "corp_admin"]))
):
    """Supervisor issues binding instructions on an escalated complaint."""
    c = db.query(Complaint).filter(
        Complaint.id == ref,
        Complaint.corporation_id == current_user.corporation_id
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")

    now = get_now()
    event = ComplaintEvent(
        complaint_id=c.id,
        actor_id=current_user.id,
        actor_name=current_user.name,
        actor_role="supervisor",
        action="SUPERVISOR_INSTRUCTION",
        comment=payload.instruction,
        created_at=now
    )
    db.add(event)

    if c.assignee_id:
        NotificationService.notify_user(
            db=db,
            corporation_id=c.corporation_id,
            user_id=c.assignee_id,
            title="Supervisor Instruction",
            body=f"{c.id}: {payload.instruction}",
            complaint_id=c.id
        )

    AuditService.log(
        db=db,
        corporation_id=c.corporation_id,
        actor_id=current_user.id,
        actor_name=current_user.name,
        actor_role="supervisor",
        action="SUPERVISOR_INSTRUCT",
        entity_type="complaint",
        entity_id=c.id,
        details={"instruction": payload.instruction}
    )

    db.commit()
    return {"status": "SUCCESS", "message": "Instruction issued to field officer."}

@router.post("/escalations/{ref}/reassign")
def reassign_escalation(
    ref: str,
    payload: ReassignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["supervisor", "corp_admin"]))
):
    """Supervisor reassigns an escalated complaint to a different officer."""
    c = db.query(Complaint).filter(
        Complaint.id == ref,
        Complaint.corporation_id == current_user.corporation_id
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")

    target_officer = db.query(User).filter(
        User.id == payload.new_assignee_id,
        User.corporation_id == current_user.corporation_id
    ).first()
    if not target_officer:
        raise HTTPException(status_code=404, detail="Target officer not found")

    old_assignee = c.assignee_id
    c.assignee_id = target_officer.id
    now = get_now()

    event = ComplaintEvent(
        complaint_id=c.id,
        actor_id=current_user.id,
        actor_name=current_user.name,
        actor_role="supervisor",
        action="SUPERVISOR_REASSIGN",
        comment=f"Reassigned from {old_assignee} to {target_officer.name}. Reason: {payload.reason}",
        created_at=now
    )
    db.add(event)

    NotificationService.notify_user(
        db=db,
        corporation_id=c.corporation_id,
        user_id=target_officer.id,
        title="Escalated Complaint Reassigned to You",
        body=f"{c.id} has been reassigned to you by supervisor: {payload.reason}",
        complaint_id=c.id
    )

    AuditService.log(
        db=db,
        corporation_id=c.corporation_id,
        actor_id=current_user.id,
        actor_name=current_user.name,
        actor_role="supervisor",
        action="SUPERVISOR_REASSIGN",
        entity_type="complaint",
        entity_id=c.id,
        details={"old_assignee": old_assignee, "new_assignee": target_officer.id, "reason": payload.reason}
    )

    db.commit()
    return {"status": "SUCCESS", "message": f"Complaint reassigned to {target_officer.name}."}

@router.get("/performance")
def get_supervisor_performance(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["supervisor", "corp_admin"]))
):
    """
    Computes real performance metrics directly from the DB.
    Never hardcoded numbers.
    """
    corp_id = current_user.corporation_id
    all_complaints = db.query(Complaint).filter(Complaint.corporation_id == corp_id).all()
    
    total = len(all_complaints)
    resolved = sum(1 for c in all_complaints if c.status in ["RESOLVED", "CLOSED"])
    in_progress = sum(1 for c in all_complaints if c.status in ["IN_PROGRESS", "WORK_SCHEDULED"])
    escalated = sum(1 for c in all_complaints if c.escalation_level is not None)
    to_check = sum(1 for c in all_complaints if c.status == "TO_CHECK")

    # Compute resolution compliance rate
    resolved_complaints = [c for c in all_complaints if c.resolved_at is not None]
    on_time_count = sum(1 for c in resolved_complaints if c.resolution_due and c.resolved_at <= c.resolution_due)
    compliance_rate = round((on_time_count / len(resolved_complaints)) * 100, 1) if resolved_complaints else 100.0

    # Officers under this corporation
    officers = db.query(User).filter(
        User.corporation_id == corp_id,
        User.role == "field_officer"
    ).all()

    officer_stats = []
    for off in officers:
        off_complaints = [c for c in all_complaints if c.assignee_id == off.id]
        off_total = len(off_complaints)
        off_resolved = sum(1 for c in off_complaints if c.status in ["RESOLVED", "CLOSED"])
        off_escalated = sum(1 for c in off_complaints if c.escalation_level is not None)
        officer_stats.append({
            "officer_id": off.id,
            "officer_name": off.name,
            "unit_id": off.unit_id,
            "total_assigned": off_total,
            "resolved": off_resolved,
            "escalated": off_escalated,
            "active": off_total - off_resolved
        })

    return {
        "summary": {
            "total_complaints": total,
            "resolved": resolved,
            "in_progress": in_progress,
            "escalated": escalated,
            "to_check": to_check,
            "compliance_rate_percent": compliance_rate
        },
        "officers": officer_stats
    }
