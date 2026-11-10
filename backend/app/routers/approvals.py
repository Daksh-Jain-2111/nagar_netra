import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models.models import ApprovalRequest, Complaint, ComplaintEvent, User
from backend.app.schemas.schemas import ApprovalRequestResponse, ApprovalDecisionRequest
from backend.app.services.auth_service import get_current_user, require_roles
from backend.app.services.audit_service import AuditService, NotificationService
from backend.app.rules import compute_due_dates

router = APIRouter(prefix="/approvals", tags=["approvals"])

@router.get("", response_model=List[ApprovalRequestResponse])
def list_approvals(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    q = db.query(ApprovalRequest).filter(ApprovalRequest.corporation_id == (current_user.corporation_id or "SMKMC"))
    if status:
        q = q.filter(ApprovalRequest.status == status)
    return q.order_by(ApprovalRequest.created_at.desc()).all()

@router.post("/{approval_id}/decide")
def decide_approval(
    approval_id: str,
    payload: ApprovalDecisionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["supervisor", "corp_admin"]))
):
    appr = db.query(ApprovalRequest).filter(ApprovalRequest.id == approval_id).first()
    if not appr:
        raise HTTPException(status_code=404, detail="Approval request not found")
    if appr.status != "PENDING":
        raise HTTPException(status_code=400, detail=f"Request already decided ({appr.status})")

    now = datetime.datetime.utcnow()
    decision = payload.decision.upper()
    if decision not in ["APPROVED", "REJECTED"]:
        raise HTTPException(status_code=400, detail="Decision must be APPROVED or REJECTED")

    appr.status = decision
    appr.decided_by = current_user.id
    appr.decision_notes = payload.notes
    appr.decided_at = now

    complaint = None
    if appr.complaint_id:
        complaint = db.query(Complaint).filter(Complaint.id == appr.complaint_id).first()

    # Process side-effects on complaint based on request_type
    if complaint:
        if appr.request_type == "rejection":
            if decision == "APPROVED":
                complaint.status = "REJECTED"
                action_text = "REJECTION_APPROVED"
            else:
                complaint.status = "IN_PROGRESS"
                action_text = "REJECTION_DENIED"

            db.add(ComplaintEvent(
                complaint_id=complaint.id,
                actor_id=current_user.id,
                actor_name=current_user.name,
                actor_role=current_user.role,
                action=action_text,
                to_status=complaint.status,
                comment=f"Supervisor {decision.lower()} rejection: {payload.notes or ''}",
                created_at=now
            ))

        elif appr.request_type == "extension":
            if decision == "APPROVED":
                new_date_str = appr.details.get("new_due_date")
                if new_date_str:
                    complaint.resolution_due = datetime.datetime.fromisoformat(new_date_str.replace("Z", ""))
                action_text = "EXTENSION_APPROVED"
            else:
                action_text = "EXTENSION_DENIED"

            db.add(ComplaintEvent(
                complaint_id=complaint.id,
                actor_id=current_user.id,
                actor_name=current_user.name,
                actor_role=current_user.role,
                action=action_text,
                comment=f"Supervisor {decision.lower()} SLA extension: {payload.notes or ''}",
                created_at=now
            ))

        elif appr.request_type == "second_transfer":
            if decision == "APPROVED":
                target_unit = appr.details.get("target_unit_id")
                complaint.unit_id = target_unit
                complaint.assignee_id = None
                complaint.status = "TO_CHECK"
                complaint.transfer_count += 1
                action_text = "SECOND_TRANSFER_APPROVED"
            else:
                action_text = "SECOND_TRANSFER_DENIED"

            db.add(ComplaintEvent(
                complaint_id=complaint.id,
                actor_id=current_user.id,
                actor_name=current_user.name,
                actor_role=current_user.role,
                action=action_text,
                comment=f"Supervisor {decision.lower()} transfer request: {payload.notes or ''}",
                created_at=now
            ))

        elif appr.request_type == "third_reopen":
            if decision == "APPROVED":
                complaint.status = "REOPENED"
                complaint.reopen_count += 1
                complaint.resolved_at = None
                action_text = "THIRD_REOPEN_APPROVED"
            else:
                action_text = "THIRD_REOPEN_DENIED"

            db.add(ComplaintEvent(
                complaint_id=complaint.id,
                actor_id=current_user.id,
                actor_name=current_user.name,
                actor_role=current_user.role,
                action=action_text,
                to_status=complaint.status,
                comment=f"Supervisor {decision.lower()} 3rd reopen request: {payload.notes or ''}",
                created_at=now
            ))

    db.commit()

    # Notify requester
    NotificationService.notify_user(
        db=db,
        corporation_id=appr.corporation_id,
        user_id=appr.requester_id,
        title=f"Request {decision.capitalize()}",
        body=f"Your {appr.request_type} request was {decision.lower()} by supervisor.",
        complaint_id=appr.complaint_id
    )

    AuditService.log(
        db=db,
        corporation_id=appr.corporation_id,
        actor_id=current_user.id,
        actor_name=current_user.name,
        actor_role=current_user.role,
        action=f"DECIDE_APPROVAL_{decision}",
        entity_type="approval_request",
        entity_id=approval_id,
        details={"type": appr.request_type, "complaint_id": appr.complaint_id}
    )

    return {"status": decision, "approval_id": approval_id}
