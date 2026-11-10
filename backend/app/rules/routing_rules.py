from typing import List, Optional, Dict, Any

VALID_STATUSES = [
    "SUBMITTED",
    "TO_CHECK",
    "ASSIGNED",
    "IN_PROGRESS",
    "WORK_SCHEDULED",
    "RESOLVED",
    "REOPENED",
    "CLOSED",
    "REJECTION_REQUESTED",
    "REJECTED"
]

def determine_initial_route(
    category_id: str,
    ward_id: Optional[str],
    ai_confidence: float,
    citizen_confirmed: bool,
    routing_rules: List[Dict[str, Any]],
    unit_officers: Dict[str, List[Dict[str, Any]]],  # unit_id -> list of officers with status
    is_redirect_category: bool = False
) -> Dict[str, Any]:
    """
    Pure function to determine initial status, unit, assignee:
    - If category is marked as redirect target ("Not ours"), it should be rejected/redirected with no complaint created.
    - If category is 'cat_other' or ai_confidence < 0.70 and NOT citizen_confirmed -> status = 'TO_CHECK'
    - Matches routing rule: category (+ward if available, else category default) -> unit
    - If unit has an active officer -> 'ASSIGNED' to officer
    - If active officer is on leave -> assign to backup officer
    - If no officer available -> 'TO_CHECK' under supervisor of the unit
    """
    if is_redirect_category:
        return {
            "can_create": False,
            "reason": "Category is external redirect only"
        }

    # Low confidence or Other with no citizen confirmation -> TO_CHECK
    needs_to_check = (
        category_id == "cat_other" or
        (ai_confidence < 0.70 and not citizen_confirmed)
    )

    # Find matching routing rule
    # 1. Look for category + specific ward
    matching_rule = None
    if ward_id:
        for r in routing_rules:
            if r.get("category_id") == category_id and r.get("ward_id") == ward_id and r.get("is_active", True):
                matching_rule = r
                break

    # 2. Look for category general rule (ward_id is None or empty)
    if not matching_rule:
        for r in routing_rules:
            if r.get("category_id") == category_id and not r.get("ward_id") and r.get("is_active", True):
                matching_rule = r
                break

    target_unit_id = matching_rule.get("unit_id") if matching_rule else None

    if needs_to_check or not target_unit_id:
        return {
            "can_create": True,
            "status": "TO_CHECK",
            "unit_id": target_unit_id,
            "assignee_id": None,
            "reason": "AI confidence < 0.70 unconfirmed or other category" if needs_to_check else "No routing rule found"
        }

    # Find active officer in unit
    officers = unit_officers.get(target_unit_id, [])
    assigned_officer_id = None

    for off in officers:
        is_on_leave = off.get("is_on_leave", False)
        if not is_on_leave:
            assigned_officer_id = off.get("user_id")
            break
        elif off.get("backup_user_id"):
            assigned_officer_id = off.get("backup_user_id")
            break

    if assigned_officer_id:
        return {
            "can_create": True,
            "status": "ASSIGNED",
            "unit_id": target_unit_id,
            "assignee_id": assigned_officer_id,
            "reason": "Auto-routed to active field officer or backup"
        }
    else:
        # No officer available in unit -> supervisor review queue
        return {
            "can_create": True,
            "status": "TO_CHECK",
            "unit_id": target_unit_id,
            "assignee_id": None,
            "reason": "No active officer in unit; routed to supervisor review"
        }
