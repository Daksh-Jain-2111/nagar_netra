import datetime
from typing import Dict, Any, Optional

def can_request_transfer(
    current_transfer_count: int,
    target_unit_id: str,
    reason: str
) -> Dict[str, Any]:
    """
    1st transfer is direct.
    2nd transfer onwards requires supervisor approval.
    """
    if not target_unit_id or not reason:
        return {"allowed": False, "requires_approval": False, "message": "Target unit and reason required."}

    if current_transfer_count == 0:
        return {
            "allowed": True,
            "requires_approval": False,
            "next_transfer_count": 1,
            "message": "First transfer applied directly."
        }
    else:
        return {
            "allowed": True,
            "requires_approval": True,
            "next_transfer_count": current_transfer_count,
            "message": "Second or subsequent transfer requires supervisor approval."
        }

def can_reopen_complaint(
    status: str,
    resolved_at: Optional[datetime.datetime],
    current_reopen_count: int,
    now: datetime.datetime
) -> Dict[str, Any]:
    """
    Reopen within 7 days of RESOLVED, max 2; 3rd reopen goes to supervisor approval.
    """
    if status != "RESOLVED":
        return {
            "allowed": False,
            "requires_approval": False,
            "message": f"Cannot reopen complaint with status '{status}'. Must be RESOLVED."
        }

    if not resolved_at:
        return {
            "allowed": False,
            "requires_approval": False,
            "message": "Missing resolution timestamp."
        }

    days_since_resolved = (now - resolved_at).total_seconds() / 86400.0
    if days_since_resolved > 7.0:
        return {
            "allowed": False,
            "requires_approval": False,
            "message": "Reopen window expired (must be within 7 days of resolution)."
        }

    if current_reopen_count < 2:
        return {
            "allowed": True,
            "requires_approval": False,
            "next_reopen_count": current_reopen_count + 1,
            "message": "Complaint reopened directly."
        }
    else:
        # 3rd reopen request goes to supervisor
        return {
            "allowed": True,
            "requires_approval": True,
            "next_reopen_count": current_reopen_count,
            "message": "Third reopen requires supervisor approval."
        }

def can_request_rejection(reason: str) -> Dict[str, Any]:
    """
    Rejection always requires supervisor approval.
    Status transitions to REJECTION_REQUESTED until approved or denied.
    """
    if not reason or len(reason.strip()) < 5:
        return {"allowed": False, "message": "Detailed rejection reason required."}
    return {
        "allowed": True,
        "requires_approval": True,
        "new_status": "REJECTION_REQUESTED",
        "message": "Rejection submitted for supervisor approval."
    }

def can_request_extension(new_due_date: datetime.datetime, reason: str, now: datetime.datetime) -> Dict[str, Any]:
    """
    Deadline extension always requires supervisor approval.
    """
    if new_due_date <= now:
        return {"allowed": False, "message": "Requested deadline must be in the future."}
    if not reason or len(reason.strip()) < 5:
        return {"allowed": False, "message": "Justification reason required for extension."}
    return {
        "allowed": True,
        "requires_approval": True,
        "message": "Deadline extension submitted for supervisor approval."
    }
