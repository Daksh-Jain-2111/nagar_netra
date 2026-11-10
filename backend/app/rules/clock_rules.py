import datetime
from typing import Dict, Any, Optional

def response_clock_hours(is_urgent: bool = False) -> int:
    """Statutory response clock: 48 hours, or 24 hours if urgent."""
    return 24 if is_urgent else 48

def compute_due_dates(
    created_at: datetime.datetime,
    resolution_hours: int,
    is_urgent: bool = False
) -> Dict[str, datetime.datetime]:
    """
    Response clock: 48 hours, or 24 hours if urgent.
    Resolution clock: specified category resolution hours (e.g. 72h, 48h, 240h).
    """
    response_hours = response_clock_hours(is_urgent)
    response_due = created_at + datetime.timedelta(hours=response_hours)
    resolution_due = created_at + datetime.timedelta(hours=resolution_hours)
    return {
        "response_due": response_due,
        "resolution_due": resolution_due
    }

def evaluate_escalation(
    status: str,
    created_at: datetime.datetime,
    response_due: datetime.datetime,
    resolution_due: datetime.datetime,
    first_officer_action_at: Optional[datetime.datetime],
    current_escalation_level: Optional[str],
    current_escalation_reason: Optional[str],
    escalated_at: Optional[datetime.datetime],
    supervisor_action_at: Optional[datetime.datetime],
    now: datetime.datetime,
    enable_l2: bool = False
) -> Dict[str, Any]:
    """
    Evaluates clock rules for a complaint:
    1. Response Missed: If complaint is ASSIGNED or SUBMITTED and no officer action before response_due.
       -> Escalate L1 with reason 'response_missed'.
    2. Resolution Deadline Missed: If complaint is not RESOLVED or CLOSED by resolution_due.
       -> Escalate L1 with reason 'deadline_missed'.
    3. Supervisor Overdue: If escalated to L1 and supervisor took no action within 72 hours of escalation.
       -> supervisor_overdue = True (appears on admin view-only overdue list).
    4. Optional L2: If enable_l2 is true and deadline missed persists.
    """
    terminal_statuses = ["RESOLVED", "CLOSED", "REJECTED"]
    if status in terminal_statuses:
        return {
            "escalate": False,
            "escalation_level": None,
            "escalation_reason": None,
            "supervisor_overdue": False
        }

    new_level = current_escalation_level
    new_reason = current_escalation_reason
    new_escalated_at = escalated_at
    is_supervisor_overdue = False

    # Check response deadline
    if not first_officer_action_at and now > response_due:
        if not new_level:
            new_level = "L1"
            new_reason = "response_missed"
            new_escalated_at = now

    # Check resolution deadline (overrides or sets reason)
    if now > resolution_due:
        if not new_level:
            new_level = "L1"
            new_reason = "deadline_missed"
            new_escalated_at = now
        elif enable_l2 and new_level == "L1" and (now - (escalated_at or now)).total_seconds() >= 48 * 3600:
            new_level = "L2"
            new_reason = "deadline_missed"

    # Check 72 hours supervisor inaction since escalation
    if new_level and new_escalated_at:
        hours_since_escalation = (now - new_escalated_at).total_seconds() / 3600.0
        # If supervisor hasn't taken action since escalated_at
        if not supervisor_action_at or supervisor_action_at < new_escalated_at:
            if hours_since_escalation >= 72.0:
                is_supervisor_overdue = True

    return {
        "escalate": new_level is not None and new_level != current_escalation_level,
        "escalation_level": new_level,
        "escalation_reason": new_reason,
        "escalated_at": new_escalated_at,
        "supervisor_overdue": is_supervisor_overdue
    }

def check_auto_close(
    status: str,
    resolved_at: Optional[datetime.datetime],
    now: datetime.datetime
) -> bool:
    """
    Auto-close complaints 7 days after RESOLVED if not reopened.
    """
    if status != "RESOLVED" or not resolved_at:
        return False
    days_since_resolved = (now - resolved_at).total_seconds() / 86400.0
    return days_since_resolved >= 7.0
