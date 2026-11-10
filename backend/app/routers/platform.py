from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models.models import Corporation, OrgUnit, Department, Category, Setting, User
from backend.app.services.auth_service import require_role

router = APIRouter(prefix="/platform", tags=["platform"])

class CorporationCreateRequest(BaseModel):
    id: str
    name: str
    name_mr: Optional[str] = None
    state: str = "Maharashtra"
    status: str = "ACTIVE"

class CorporationFromTemplateRequest(BaseModel):
    corporation_id: Optional[str] = None
    name: Optional[str] = None

@router.get("/corporations")
def list_corporations(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["platform_admin"]))
):
    """Lists all tenant corporations on the platform."""
    return db.query(Corporation).all()

@router.post("/corporations")
def create_corporation(
    payload: CorporationCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["platform_admin"]))
):
    """Creates a new civic corporation tenant."""
    existing = db.query(Corporation).filter(Corporation.id == payload.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Corporation with this ID already exists")

    corp = Corporation(
        id=payload.id,
        name=payload.name,
        name_mr=payload.name_mr or payload.name,
        state=payload.state,
        status=payload.status
    )
    db.add(corp)
    db.commit()
    db.refresh(corp)
    return corp

@router.get("/corporations/{id}")
def get_corporation(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["platform_admin"]))
):
    corp = db.query(Corporation).filter(Corporation.id == id).first()
    if not corp:
        raise HTTPException(status_code=404, detail="Corporation not found")
    return corp

@router.post("/corporations/{id}/toggle-status")
def toggle_corporation_status(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["platform_admin"]))
):
    """Toggles corporation status between ACTIVE and SUSPENDED."""
    corp = db.query(Corporation).filter(Corporation.id == id).first()
    if not corp:
        raise HTTPException(status_code=404, detail="Corporation not found")

    corp.status = "SUSPENDED" if corp.status == "ACTIVE" else "ACTIVE"
    db.commit()
    return {"id": corp.id, "status": corp.status}

@router.post("/corporations/from-template")
def create_corporation_from_template(
    payload: CorporationFromTemplateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["platform_admin"]))
):
    """
    Creates a new corporation bootstrapped from the Maharashtra Municipal Corporation template.
    Seeds default org units, standard civic departments, categories, and SLA thresholds.
    """
    count = db.query(Corporation).count() + 1
    corp_id = payload.corporation_id or f"DEMO_CORP_{count}"
    corp_name = payload.name or f"Demo Corporation {count}"

    existing = db.query(Corporation).filter(Corporation.id == corp_id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Corporation {corp_id} already exists")

    corp = Corporation(
        id=corp_id,
        name=corp_name,
        name_mr=f"डेमो महानगरपालिका {count}",
        status="ACTIVE"
    )
    db.add(corp)

    # Standard Maharashtra Municipal Divisions
    divisions = [
        OrgUnit(id=f"{corp_id}_unit_roads", corporation_id=corp_id, name="Roads & Works Division", name_mr="रस्ते विभाग", level_type="Division"),
        OrgUnit(id=f"{corp_id}_unit_waste", corporation_id=corp_id, name="Solid Waste Management Division", name_mr="घनकचरा व्यवस्थापन विभाग", level_type="Division"),
        OrgUnit(id=f"{corp_id}_unit_water", corporation_id=corp_id, name="Water Supply & Drainage Division", name_mr="पाणीपुरवठा विभाग", level_type="Division"),
        OrgUnit(id=f"{corp_id}_unit_elec", corporation_id=corp_id, name="Electrical Division", name_mr="विद्युत विभाग", level_type="Division"),
        OrgUnit(id=f"{corp_id}_unit_health", corporation_id=corp_id, name="Public Health Division", name_mr="आरोग्य विभाग", level_type="Division"),
    ]
    db.add_all(divisions)

    # Standard Departments
    depts = [
        Department(id=f"{corp_id}_dept_roads", corporation_id=corp_id, name="Roads & Infrastructure", code="RD", color="#0B3D66"),
        Department(id=f"{corp_id}_dept_waste", corporation_id=corp_id, name="Solid Waste Management", code="SWM", color="#2E7D32"),
        Department(id=f"{corp_id}_dept_water", corporation_id=corp_id, name="Water Supply & Drainage", code="WSD", color="#0288D1"),
        Department(id=f"{corp_id}_dept_elec", corporation_id=corp_id, name="Street Lighting", code="ELEC", color="#F57C00"),
        Department(id=f"{corp_id}_dept_health", corporation_id=corp_id, name="Public Health", code="HLTH", color="#7B1FA2"),
    ]
    db.add_all(depts)

    # Standard Categories
    cats = [
        Category(id=f"{corp_id}_cat_pothole", corporation_id=corp_id, department_id=f"{corp_id}_dept_roads", name="Pothole Damage", priority="HIGH", resolution_hours=72, is_urgent=False),
        Category(id=f"{corp_id}_cat_garbage", corporation_id=corp_id, department_id=f"{corp_id}_dept_waste", name="Garbage Overflow", priority="URGENT", resolution_hours=24, is_urgent=True),
        Category(id=f"{corp_id}_cat_street_light", corporation_id=corp_id, department_id=f"{corp_id}_dept_elec", name="Street Light Fault", priority="MEDIUM", resolution_hours=48, is_urgent=False),
        Category(id=f"{corp_id}_cat_water", corporation_id=corp_id, department_id=f"{corp_id}_dept_water", name="Pipeline Leakage", priority="URGENT", resolution_hours=24, is_urgent=True),
        Category(id=f"{corp_id}_cat_drainage", corporation_id=corp_id, department_id=f"{corp_id}_dept_water", name="Open Drain / Manhole", priority="HIGH", resolution_hours=48, is_urgent=False),
        Category(id=f"{corp_id}_cat_msedcl", corporation_id=corp_id, department_id=f"{corp_id}_dept_elec", name="Power Outage", priority="LOW", resolution_hours=0, redirect_target="MSEDCL: 1912"),
    ]
    db.add_all(cats)

    # Default settings
    settings = [
        Setting(corporation_id=corp_id, key="enable_l2", value={"enabled": False}),
        Setting(corporation_id=corp_id, key="ai_confidence_threshold", value={"threshold": 0.70}),
    ]
    db.add_all(settings)

    db.commit()
    return {"status": "CREATED", "corporation_id": corp_id, "name": corp_name, "template": "Maharashtra Municipal Standard"}

@router.get("/ai-models")
def get_ai_models(
    current_user: User = Depends(require_role(["platform_admin"]))
):
    """
    Returns exactly 3 models deployed on the platform.
    Strictly contains NO accuracy, precision, or F1 metrics (per prompt specifications).
    """
    return [
        {
            "id": "model_multimodal_vision",
            "name": "Civic Multimodal Vision-Text Fusion Engine",
            "purpose": "Citizen photo and complaint text classification into municipal categories",
            "weights": {"vision": 0.60, "text": 0.40},
            "confidence_threshold": 0.70,
            "status": "DEPLOYED",
            "runtime": "Local Inference Pipeline"
        },
        {
            "id": "model_audio_transcript",
            "name": "Audio Transcription & Dialect Normalizer",
            "purpose": "Converts spoken voice complaints in Marathi / English into indexed text",
            "status": "DEPLOYED",
            "runtime": "Audio Pipeline Interface"
        },
        {
            "id": "model_geo_dedup",
            "name": "Duplicate & Geospatial Proximity Detector",
            "purpose": "Haversine distance and temporal cluster analysis for duplicate ticket prevention",
            "distance_threshold_meters": 100,
            "window_days": 7,
            "status": "DEPLOYED",
            "runtime": "Pure Geospatial Engine"
        }
    ]
