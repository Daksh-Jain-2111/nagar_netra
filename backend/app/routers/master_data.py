from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models.models import (
    Corporation, OrgUnit, Ward, Department, Category, Setting, User
)
from backend.app.services.auth_service import get_current_user_optional, get_current_user, require_roles

router = APIRouter(prefix="/master", tags=["master_data"])

@router.get("/corporations")
def get_corporations(db: Session = Depends(get_db)):
    return db.query(Corporation).all()

@router.get("/org-units")
def get_org_units(corp_id: str = "SMKMC", db: Session = Depends(get_db)):
    return db.query(OrgUnit).filter(OrgUnit.corporation_id == corp_id).all()

@router.get("/wards")
def get_wards(corp_id: str = "SMKMC", db: Session = Depends(get_db)):
    return db.query(Ward).filter(Ward.corporation_id == corp_id).all()

@router.get("/departments")
def get_departments(corp_id: str = "SMKMC", db: Session = Depends(get_db)):
    return db.query(Department).filter(Department.corporation_id == corp_id).all()

@router.get("/categories")
def get_categories(corp_id: str = "SMKMC", db: Session = Depends(get_db)):
    return db.query(Category).filter(Category.corporation_id == corp_id, Category.is_active == True).all()

@router.get("/settings")
def get_settings(corp_id: str = "SMKMC", db: Session = Depends(get_db)):
    settings_db = db.query(Setting).filter(Setting.corporation_id == corp_id).all()
    return {s.key: s.value for s in settings_db}

@router.post("/settings/{key}")
def update_setting(
    key: str,
    value: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["corp_admin", "platform_admin"]))
):
    corp_id = current_user.corporation_id or "SMKMC"
    s = db.query(Setting).filter(Setting.corporation_id == corp_id, Setting.key == key).first()
    if not s:
        s = Setting(corporation_id=corp_id, key=key, value=value)
        db.add(s)
    else:
        s.value = value
    db.commit()
    return {"key": key, "value": value}
