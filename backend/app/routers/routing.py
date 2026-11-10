from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models.models import RoutingRule, Category, User, OfficerStatus
from backend.app.schemas.schemas import (
    RoutingRuleCreate, RoutingSimulationRequest
)
from backend.app.services.auth_service import get_current_user, require_roles
from backend.app.services.geo_service import detect_ward_from_gps
from backend.app.rules import determine_initial_route

router = APIRouter(prefix="/routing", tags=["routing"])

@router.get("/rules")
def get_routing_rules(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(RoutingRule).filter(
        RoutingRule.corporation_id == (current_user.corporation_id or "SMKMC")
    ).all()

@router.post("/rules")
def create_routing_rule(
    payload: RoutingRuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["corp_admin"]))
):
    rule_id = f"rule_{payload.category_id}_{payload.ward_id or 'all'}"
    rule = RoutingRule(
        id=rule_id,
        corporation_id=current_user.corporation_id or "SMKMC",
        category_id=payload.category_id,
        ward_id=payload.ward_id,
        unit_id=payload.unit_id,
        is_active=payload.is_active
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule

@router.delete("/rules/{rule_id}")
def delete_routing_rule(
    rule_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["corp_admin"]))
):
    rule = db.query(RoutingRule).filter(RoutingRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    db.delete(rule)
    db.commit()
    return {"success": True}

@router.post("/simulate")
def simulate_routing(
    payload: RoutingSimulationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    corp_id = current_user.corporation_id or "SMKMC"
    detected = detect_ward_from_gps(payload.latitude, payload.longitude)
    ward_id = payload.ward_id or (detected["ward_id"] if detected else None)

    category = db.query(Category).filter(Category.id == payload.category_id).first()
    is_redirect = bool(category.redirect_target) if category else False

    rules_db = db.query(RoutingRule).filter(
        RoutingRule.corporation_id == corp_id,
        RoutingRule.is_active == True
    ).all()
    rules = [
        {"category_id": r.category_id, "ward_id": r.ward_id, "unit_id": r.unit_id, "is_active": r.is_active}
        for r in rules_db
    ]

    officers_db = db.query(User).filter(
        User.corporation_id == corp_id,
        User.role == "field_officer",
        User.is_active == True
    ).all()

    unit_officers: Dict[str, List[Dict[str, Any]]] = {}
    for off in officers_db:
        if off.unit_id:
            st = off.officer_status
            unit_officers.setdefault(off.unit_id, []).append({
                "user_id": off.id,
                "is_on_leave": st.is_on_leave if st else False,
                "backup_user_id": st.backup_user_id if st else None
            })

    decision = determine_initial_route(
        category_id=payload.category_id,
        ward_id=ward_id,
        ai_confidence=payload.ai_confidence,
        citizen_confirmed=payload.citizen_confirmed,
        routing_rules=rules,
        unit_officers=unit_officers,
        is_redirect_category=is_redirect
    )

    return {
        "detected_ward": detected,
        "category": category.name if category else payload.category_id,
        "decision": decision
    }
