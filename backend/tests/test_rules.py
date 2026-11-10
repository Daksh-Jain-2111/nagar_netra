import datetime
import pytest
from backend.app.rules import (
    determine_initial_route,
    compute_due_dates,
    evaluate_escalation,
    check_auto_close,
    can_request_transfer,
    can_reopen_complaint,
    can_request_rejection,
    can_request_extension,
    find_duplicate_candidates,
    verify_citizen_before_photo,
    verify_after_resolution_photo,
)

def test_routing_rules_active_officer():
    rules = [{"category_id": "cat_pothole", "ward_id": "ward_12", "unit_id": "unit_roads_east", "is_active": True}]
    officers = {"unit_roads_east": [{"user_id": "off_1", "is_on_leave": False}]}

    # Confirmed category routes to active officer
    res = determine_initial_route(
        category_id="cat_pothole",
        ward_id="ward_12",
        ai_confidence=0.85,
        citizen_confirmed=True,
        routing_rules=rules,
        unit_officers=officers
    )
    assert res["can_create"] is True
    assert res["status"] == "ASSIGNED"
    assert res["assignee_id"] == "off_1"

def test_routing_rules_officer_on_leave():
    rules = [{"category_id": "cat_pothole", "ward_id": "ward_12", "unit_id": "unit_roads_east", "is_active": True}]
    officers = {"unit_roads_east": [{"user_id": "off_1", "is_on_leave": True, "backup_user_id": "off_backup"}]}

    res = determine_initial_route(
        category_id="cat_pothole",
        ward_id="ward_12",
        ai_confidence=0.85,
        citizen_confirmed=True,
        routing_rules=rules,
        unit_officers=officers
    )
    assert res["can_create"] is True
    assert res["status"] == "ASSIGNED"
    assert res["assignee_id"] == "off_backup"

def test_routing_rules_low_confidence_unconfirmed_to_check():
    rules = [{"category_id": "cat_pothole", "ward_id": "ward_12", "unit_id": "unit_roads_east", "is_active": True}]
    officers = {"unit_roads_east": [{"user_id": "off_1", "is_on_leave": False}]}

    # Confidence below 0.70 with no citizen confirmation -> TO_CHECK
    res = determine_initial_route(
        category_id="cat_pothole",
        ward_id="ward_12",
        ai_confidence=0.62,
        citizen_confirmed=False,
        routing_rules=rules,
        unit_officers=officers
    )
    assert res["can_create"] is True
    assert res["status"] == "TO_CHECK"
    assert res["assignee_id"] is None

def test_clock_computation():
    now = datetime.datetime(2026, 10, 8, 10, 0, 0)
    # Normal category (72h SLA): response due in 48h, resolution in 72h
    res_normal = compute_due_dates(now, resolution_hours=72, is_urgent=False)
    assert res_normal["response_due"] == now + datetime.timedelta(hours=48)
    assert res_normal["resolution_due"] == now + datetime.timedelta(hours=72)

    # Urgent category: response due in 24h
    res_urgent = compute_due_dates(now, resolution_hours=24, is_urgent=True)
    assert res_urgent["response_due"] == now + datetime.timedelta(hours=24)
    assert res_urgent["resolution_due"] == now + datetime.timedelta(hours=24)

def test_escalation_evaluation():
    now = datetime.datetime(2026, 10, 8, 10, 0, 0)
    created_at = now - datetime.timedelta(hours=50)
    response_due = now - datetime.timedelta(hours=2)
    resolution_due = now + datetime.timedelta(hours=22)

    # Response missed with no officer action
    eval_res = evaluate_escalation(
        status="ASSIGNED",
        created_at=created_at,
        response_due=response_due,
        resolution_due=resolution_due,
        first_officer_action_at=None,
        current_escalation_level=None,
        current_escalation_reason=None,
        escalated_at=None,
        supervisor_action_at=None,
        now=now
    )
    assert eval_res["escalate"] is True
    assert eval_res["escalation_level"] == "L1"
    assert eval_res["escalation_reason"] == "response_missed"

def test_supervisor_72h_overdue():
    now = datetime.datetime(2026, 10, 8, 10, 0, 0)
    escalated_at = now - datetime.timedelta(hours=75)
    created_at = now - datetime.timedelta(hours=100)
    response_due = now - datetime.timedelta(hours=52)
    resolution_due = now - datetime.timedelta(hours=10)

    eval_res = evaluate_escalation(
        status="ASSIGNED",
        created_at=created_at,
        response_due=response_due,
        resolution_due=resolution_due,
        first_officer_action_at=None,
        current_escalation_level="L1",
        current_escalation_reason="response_missed",
        escalated_at=escalated_at,
        supervisor_action_at=None,
        now=now
    )
    assert eval_res["supervisor_overdue"] is True

def test_transfer_rules():
    # 1st transfer is direct
    first = can_request_transfer(0, "unit_water", "Wrong department")
    assert first["allowed"] is True
    assert first["requires_approval"] is False

    # 2nd transfer requires supervisor approval
    second = can_request_transfer(1, "unit_health", "Second transfer needed")
    assert second["allowed"] is True
    assert second["requires_approval"] is True

def test_reopen_rules():
    now = datetime.datetime(2026, 10, 8, 10, 0, 0)
    resolved_at = now - datetime.timedelta(days=2)

    # 1st reopen within 7 days -> direct
    reopen_1 = can_reopen_complaint("RESOLVED", resolved_at, 0, now)
    assert reopen_1["allowed"] is True
    assert reopen_1["requires_approval"] is False

    # 2nd reopen within 7 days -> direct
    reopen_2 = can_reopen_complaint("RESOLVED", resolved_at, 1, now)
    assert reopen_2["allowed"] is True
    assert reopen_2["requires_approval"] is False

    # 3rd reopen within 7 days -> requires supervisor approval
    reopen_3 = can_reopen_complaint("RESOLVED", resolved_at, 2, now)
    assert reopen_3["allowed"] is True
    assert reopen_3["requires_approval"] is True

    # Reopen after 7 days expired
    resolved_old = now - datetime.timedelta(days=8)
    reopen_old = can_reopen_complaint("RESOLVED", resolved_old, 0, now)
    assert reopen_old["allowed"] is False

def test_duplicate_candidate_detection():
    now = datetime.datetime(2026, 10, 8, 10, 0, 0)
    c1 = {
        "id": "NN-2026-000101",
        "category_id": "cat_pothole",
        "latitude": 16.8524,
        "longitude": 74.5815,
        "created_at": now
    }
    # 40 meters away, same category, 1 day earlier
    c2 = {
        "id": "NN-2026-000100",
        "category_id": "cat_pothole",
        "latitude": 16.8526,
        "longitude": 74.5817,
        "created_at": now - datetime.timedelta(days=1),
        "status": "ASSIGNED",
        "address": "Vishrambag"
    }
    # 2 km away -> should NOT be duplicate
    c3 = {
        "id": "NN-2026-000099",
        "category_id": "cat_pothole",
        "latitude": 16.8700,
        "longitude": 74.6000,
        "created_at": now - datetime.timedelta(days=1),
        "status": "ASSIGNED",
        "address": "Miraj"
    }

    candidates = find_duplicate_candidates(c1, [c2, c3], max_distance_meters=100.0, max_days_diff=7.0)
    assert len(candidates) == 1
    assert candidates[0]["candidate_id"] == "NN-2026-000100"
    assert candidates[0]["is_older"] is True
