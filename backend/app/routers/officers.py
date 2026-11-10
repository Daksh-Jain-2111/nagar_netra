import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models.models import User, OfficerStatus, JoinRequest, InviteCode
from backend.app.schemas.schemas import OfficerStatusUpdateRequest, JoinRequestCreate
from backend.app.services.auth_service import get_current_user, require_roles
from backend.app.services.audit_service import AuditService, NotificationService

router = APIRouter(prefix="/officers", tags=["officers"])

@router.get("")
def list_officers(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    officers = db.query(User).filter(
        User.corporation_id == (current_user.corporation_id or "SMKMC"),
        User.role == "field_officer"
    ).all()

    result = []
    for off in officers:
        status_entry = off.officer_status
        result.append({
            "id": off.id,
            "name": off.name,
            "email": off.email,
            "mobile": off.mobile,
            "unit_id": off.unit_id,
            "is_on_leave": status_entry.is_on_leave if status_entry else False,
            "backup_user_id": status_entry.backup_user_id if status_entry else None,
            "leave_start": status_entry.leave_start if status_entry else None,
            "leave_end": status_entry.leave_end if status_entry else None,
        })
    return result

@router.post("/status")
def update_officer_status(
    payload: OfficerStatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_user_id = current_user.id
    status_entry = db.query(OfficerStatus).filter(OfficerStatus.user_id == target_user_id).first()

    if not status_entry:
        status_entry = OfficerStatus(
            user_id=target_user_id,
            is_on_leave=payload.is_on_leave,
            backup_user_id=payload.backup_user_id,
            leave_start=payload.leave_start,
            leave_end=payload.leave_end
        )
        db.add(status_entry)
    else:
        status_entry.is_on_leave = payload.is_on_leave
        status_entry.backup_user_id = payload.backup_user_id
        status_entry.leave_start = payload.leave_start
        status_entry.leave_end = payload.leave_end

    db.commit()

    AuditService.log(
        db=db,
        corporation_id=current_user.corporation_id or "SMKMC",
        actor_id=current_user.id,
        actor_name=current_user.name,
        actor_role=current_user.role,
        action="UPDATE_OFFICER_LEAVE_STATUS",
        entity_type="officer_status",
        entity_id=target_user_id,
        details={"is_on_leave": payload.is_on_leave, "backup": payload.backup_user_id}
    )

    return {"success": True, "is_on_leave": payload.is_on_leave, "backup_user_id": payload.backup_user_id}

@router.post("/join-request")
def submit_join_request(payload: JoinRequestCreate, db: Session = Depends(get_db)):
    corp_id = "SMKMC"
    unit_id = payload.unit_id

    # If invite code provided, validate
    if payload.invite_code:
        invite = db.query(InviteCode).filter(
            InviteCode.code == payload.invite_code.strip(),
            InviteCode.is_used == False
        ).first()
        if invite:
            corp_id = invite.corporation_id
            unit_id = invite.unit_id or unit_id

    req_id = f"join_{int(datetime.datetime.utcnow().timestamp())}"
    join_req = JoinRequest(
        id=req_id,
        corporation_id=corp_id,
        name=payload.name,
        mobile=payload.mobile,
        email=payload.email,
        requested_role=payload.requested_role,
        unit_id=unit_id,
        status="PENDING"
    )
    db.add(join_req)
    db.commit()

    # Notify admin
    NotificationService.notify_role(
        db=db,
        corporation_id=corp_id,
        role="corp_admin",
        title="New Officer Join Request",
        body=f"{payload.name} ({payload.email}) requested to join as {payload.requested_role}."
    )

    return {"success": True, "request_id": req_id, "message": "Join request submitted for admin review."}

@router.get("/join-requests")
def list_join_requests(db: Session = Depends(get_db), current_user: User = Depends(require_roles(["corp_admin", "supervisor"]))):
    return db.query(JoinRequest).filter(
        JoinRequest.corporation_id == (current_user.corporation_id or "SMKMC"),
        JoinRequest.status == "PENDING"
    ).all()

@router.post("/join-requests/{request_id}/decide")
def decide_join_request(
    request_id: str,
    decision: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["corp_admin"]))
):
    jr = db.query(JoinRequest).filter(JoinRequest.id == request_id).first()
    if not jr:
        raise HTTPException(status_code=404, detail="Join request not found")

    decision_norm = decision.upper()
    jr.status = decision_norm

    if decision_norm == "APPROVED":
        user_id = f"usr_{jr.mobile[-10:]}"
        new_user = User(
            id=user_id,
            corporation_id=jr.corporation_id,
            unit_id=jr.unit_id,
            name=jr.name,
            mobile=jr.mobile,
            email=jr.email,
            role=jr.requested_role,
            is_active=True
        )
        db.add(new_user)

    db.commit()
    return {"success": True, "status": decision_norm}
