import datetime
import random
import time
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models.models import (
    Complaint, ComplaintEvent, Attachment, Category, RoutingRule,
    User, OfficerStatus, ApprovalRequest, HelpdeskLog
)
from backend.app.schemas.schemas import (
    ComplaintCreate, ComplaintResponse, ComplaintAssignRequest,
    ComplaintStatusUpdateRequest, ComplaintTransferRequest,
    ComplaintRejectionRequest, ComplaintExtensionRequest,
    ComplaintResolveRequest, ComplaintReopenRequest, LinkDuplicateRequest
)
from backend.app.services.auth_service import get_current_user_optional, get_current_user
from backend.app.services.geo_service import detect_ward_from_gps
from backend.app.services.classifier_service import ClassifierService
from backend.app.services.audit_service import AuditService, NotificationService
from backend.app.services.time_service import get_now
from backend.app.rules import (
    determine_initial_route,
    compute_due_dates,
    can_request_transfer,
    can_reopen_complaint,
    can_request_rejection,
    can_request_extension,
    verify_citizen_before_photo,
    verify_after_resolution_photo
)
from backend.app.rules.duplicate_rules import haversine_distance_meters
from backend.app.rules.issue_mapping_rules import load_taxonomy
from backend.app.models.models import VoiceNote
from backend.app.services.voice_note_service import link_to_complaint
from backend.app.services.ai_history_service import record_submission_predictions

# Allowed transitions mapping: from_status -> dict of {to_status: set of allowed roles}
ALLOWED_TRANSITIONS = {
    "SUBMITTED": {
        "ASSIGNED": {"supervisor", "corp_admin", "helpdesk"},
        "TO_CHECK": {"supervisor", "corp_admin"},
        "REJECTED": {"supervisor", "corp_admin"}
    },
    "TO_CHECK": {
        "ASSIGNED": {"supervisor", "corp_admin"},
        "REJECTED": {"supervisor", "corp_admin"}
    },
    "ASSIGNED": {
        "IN_PROGRESS": {"field_officer", "supervisor", "corp_admin"},
        "WORK_SCHEDULED": {"field_officer", "supervisor", "corp_admin"},
        "REJECTION_REQUESTED": {"field_officer"},
        "RESOLVED": {"field_officer", "supervisor", "corp_admin"}
    },
    "IN_PROGRESS": {
        "WORK_SCHEDULED": {"field_officer", "supervisor", "corp_admin"},
        "RESOLVED": {"field_officer", "supervisor", "corp_admin"},
        "REJECTION_REQUESTED": {"field_officer"}
    },
    "WORK_SCHEDULED": {
        "IN_PROGRESS": {"field_officer", "supervisor", "corp_admin"},
        "RESOLVED": {"field_officer", "supervisor", "corp_admin"}
    },
    "REJECTION_REQUESTED": {
        "REJECTED": {"supervisor", "corp_admin"},
        "ASSIGNED": {"supervisor", "corp_admin"},
        "IN_PROGRESS": {"supervisor", "corp_admin"}
    },
    "RESOLVED": {
        "REOPENED": {"citizen", "helpdesk"},
        "CLOSED": {"citizen", "corp_admin", "supervisor"}
    },
    "REOPENED": {
        "ASSIGNED": {"supervisor", "corp_admin"},
        "IN_PROGRESS": {"field_officer", "supervisor", "corp_admin"},
        "RESOLVED": {"field_officer", "supervisor", "corp_admin"}
    },
    "CLOSED": {},
    "REJECTED": {}
}

router = APIRouter(prefix="/complaints", tags=["complaints"])

def generate_complaint_ref(db: Session, year: int = 2026) -> str:
    count = db.query(Complaint).count() + 1
    return f"NN-{year}-{100000 + count}"

@router.post("", response_model=ComplaintResponse)
def create_complaint(
    payload: ComplaintCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    return _create_complaint_core(payload, db, current_user)


def _resolve_app_category(db: Session, corporation_id: str, app_category_id: Optional[str]):
    """Map a citizen-app category id to a backend category via the civic issue taxonomy."""
    if not app_category_id:
        return None
    taxonomy = load_taxonomy()
    for issue in taxonomy.issues:
        if issue.app_category_id == app_category_id and not issue.is_reject:
            for candidate in issue.candidate_category_ids(corporation_id):
                cat = db.query(Category).filter(
                    Category.id == candidate, Category.corporation_id == corporation_id).first()
                if cat:
                    return cat
    return db.query(Category).filter(
        Category.id == "cat_other", Category.corporation_id == corporation_id).first()


def _create_complaint_core(
    payload: ComplaintCreate,
    db: Session,
    current_user: Optional[User],
    commit_hook=None,
    image_ai_trace: Optional[Dict[str, Any]] = None,
):
    corporation_id = current_user.corporation_id if current_user else "SMKMC"

    # Voice note (uploaded earlier) must exist in this corporation and be unattached
    voice_note = None
    if payload.voice_note_id:
        voice_note = db.query(VoiceNote).filter(
            VoiceNote.id == payload.voice_note_id,
            VoiceNote.corporation_id == corporation_id
        ).first()
        if not voice_note:
            raise HTTPException(status_code=400, detail={"code": "VOICE_NOTE_NOT_FOUND", "message": "Voice note not found."})
        if voice_note.complaint_id:
            raise HTTPException(status_code=409, detail={"code": "VOICE_NOTE_IN_USE", "message": "Voice note is already attached to a complaint."})

    # Category validation
    category = db.query(Category).filter(
        Category.id == payload.category_id,
        Category.corporation_id == corporation_id
    ).first()

    if not category and payload.app_category_id:
        # Citizen web app category id -> backend category (taxonomy); department/SLA come from DB
        category = _resolve_app_category(db, corporation_id, payload.app_category_id)

    if not category:
        # Fallback to general category if not found
        category = db.query(Category).filter(Category.corporation_id == corporation_id).first()
        if not category:
            raise HTTPException(status_code=400, detail="Invalid category or no categories configured.")

    if category.redirect_target:
        raise HTTPException(
            status_code=400,
            detail=f"Category '{category.name}' is handled externally by {category.redirect_target}. Redirect only."
        )

    # GPS -> Ward detection
    detected_ward = detect_ward_from_gps(payload.latitude, payload.longitude)
    ward_id = payload.ward_id or (detected_ward["ward_id"] if detected_ward else None)

    # AI classification check
    if payload.description:
        _kw_text_source = "description"
    elif payload.audio_transcript:
        _kw_text_source = "voice_transcript"
    else:
        _kw_text_source = "category_name_fallback"
    _kw_text = payload.description or payload.audio_transcript or category.name
    _kw_started = time.perf_counter()
    classifier_result = ClassifierService.classify_issue(
        text=_kw_text,
        has_image=bool(payload.photo_metadata)
    )
    keyword_trace = {
        "text_source": _kw_text_source,
        "text_chars": len(_kw_text or ""),
        "has_image": bool(payload.photo_metadata),
        "latency_ms": int((time.perf_counter() - _kw_started) * 1000),
    }
    if payload.accepted_ai_issue_code:
        classifier_result["citizen_accepted_issue_code"] = payload.accepted_ai_issue_code
    if payload.app_category_id:
        classifier_result["app_category_id"] = payload.app_category_id

    # Fetch active routing rules and active officers per unit
    routing_rules_db = db.query(RoutingRule).filter(
        RoutingRule.corporation_id == corporation_id,
        RoutingRule.is_active == True
    ).all()
    routing_rules = [
        {"category_id": r.category_id, "ward_id": r.ward_id, "unit_id": r.unit_id, "is_active": r.is_active}
        for r in routing_rules_db
    ]

    officers_db = db.query(User).filter(
        User.corporation_id == corporation_id,
        User.role == "field_officer",
        User.is_active == True
    ).all()

    unit_officers: Dict[str, List[Dict[str, Any]]] = {}
    for off in officers_db:
        if off.unit_id:
            status_entry = off.officer_status
            is_on_leave = status_entry.is_on_leave if status_entry else False
            backup_id = status_entry.backup_user_id if status_entry else None
            unit_officers.setdefault(off.unit_id, []).append({
                "user_id": off.id,
                "is_on_leave": is_on_leave,
                "backup_user_id": backup_id
            })

    route_decision = determine_initial_route(
        category_id=category.id,
        ward_id=ward_id,
        ai_confidence=classifier_result["confidence"],
        citizen_confirmed=payload.citizen_confirmed_category,
        routing_rules=routing_rules,
        unit_officers=unit_officers,
        is_redirect_category=bool(category.redirect_target)
    )

    now = datetime.datetime.utcnow()
    is_urgent = payload.danger_flag or category.is_urgent
    due_dates = compute_due_dates(now, resolution_hours=category.resolution_hours or 72, is_urgent=is_urgent)

    ref = generate_complaint_ref(db, year=now.year)
    citizen_id = None if payload.is_anonymous else (current_user.id if current_user else None)
    citizen_name = "Anonymous citizen" if payload.is_anonymous else (payload.citizen_name or (current_user.name if current_user else "Citizen"))
    citizen_mobile = None if payload.is_anonymous else (payload.citizen_mobile or (current_user.mobile if current_user else None))

    # Photo verification
    photo_verified = False
    if payload.photo_metadata:
        photo_ver = verify_citizen_before_photo(
            complaint_lat=payload.latitude,
            complaint_lon=payload.longitude,
            exif_time=payload.photo_metadata.get("exif_time"),
            exif_lat=payload.photo_metadata.get("exif_latitude"),
            exif_lon=payload.photo_metadata.get("exif_longitude"),
            submission_time=now
        )
        photo_verified = photo_ver["is_verified"]

    complaint = Complaint(
        id=ref,
        corporation_id=corporation_id,
        citizen_id=citizen_id,
        citizen_name=citizen_name,
        citizen_mobile=citizen_mobile,
        is_anonymous=payload.is_anonymous,
        category_id=category.id,
        description=payload.description,
        audio_transcript=payload.audio_transcript,
        ai_scores=classifier_result,
        latitude=payload.latitude,
        longitude=payload.longitude,
        address=payload.address or (detected_ward["name"] if detected_ward else "Sangli"),
        ward_id=ward_id,
        unit_id=route_decision.get("unit_id"),
        assignee_id=route_decision.get("assignee_id"),
        status=route_decision.get("status", "SUBMITTED"),
        priority="URGENT" if is_urgent else (category.priority or "MEDIUM"),
        danger_flag=payload.danger_flag,
        danger_verified=False,
        photo_verified=photo_verified,
        created_at=now,
        response_due=due_dates["response_due"],
        resolution_due=due_dates["resolution_due"],
        channel=payload.channel
    )

    db.add(complaint)

    if voice_note is not None:
        link_to_complaint(db, voice_note, complaint, payload.audio_transcript)
    if commit_hook is not None:
        commit_hook(complaint)

    # Initial Event
    event = ComplaintEvent(
        complaint_id=ref,
        actor_id=citizen_id,
        actor_name=citizen_name,
        actor_role="citizen" if not current_user else current_user.role,
        action="COMPLAINT_SUBMITTED",
        to_status=complaint.status,
        comment=f"Complaint registered via {payload.channel}. {route_decision.get('reason')}",
        created_at=now
    )
    db.add(event)
    db.commit()
    db.refresh(complaint)

    # AI model history: one prediction event per model that ran (never blocks submission,
    # never triggers retraining).
    record_submission_predictions(
        db, complaint,
        keyword_result=classifier_result,
        keyword_trace=keyword_trace,
        image_trace=image_ai_trace,
        citizen_confirmed=payload.citizen_confirmed_category,
        accepted_issue_code=payload.accepted_ai_issue_code,
        voice_note=voice_note,
    )
    db.refresh(complaint)

    # Notifications
    if complaint.assignee_id:
        NotificationService.notify_user(
            db=db,
            corporation_id=corporation_id,
            user_id=complaint.assignee_id,
            title="New Complaint Assigned",
            body=f"{category.name} in {complaint.address} assigned to you.",
            complaint_id=ref
        )
    elif complaint.status == "TO_CHECK":
        NotificationService.notify_role(
            db=db,
            corporation_id=corporation_id,
            role="supervisor",
            title="New Complaint Requires Review (To Check)",
            body=f"{ref}: {category.name} flagged for review ({route_decision.get('reason')})",
            complaint_id=ref
        )

    # Audit log
    AuditService.log(
        db=db,
        corporation_id=corporation_id,
        actor_id=citizen_id or "anonymous",
        actor_name=citizen_name,
        actor_role="citizen",
        action="CREATE_COMPLAINT",
        entity_type="complaint",
        entity_id=ref,
        details={"status": complaint.status, "category": category.name, "ward": ward_id}
    )

    return complaint

# ---------------------------------------------------------------------------
# Citizen submission with media: photos + (pre-uploaded) voice note in one request
# ---------------------------------------------------------------------------
MAX_COMPLAINT_PHOTOS = 3


def _store_photos(ref: str, decoded_photos) -> List[str]:
    """Re-encode as JPEG (strips EXIF/GPS metadata) into UPLOAD_DIR/complaints/<ref>/."""
    import io
    import os
    from pathlib import Path
    from backend.app.config import settings

    rel_dir = f"complaints/{ref}"
    directory = Path(settings.UPLOAD_DIR) / rel_dir
    directory.mkdir(parents=True, exist_ok=True)
    paths = []
    for idx, img in enumerate(decoded_photos, start=1):
        img = img.copy()
        img.thumbnail((2048, 2048))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=88)
        rel = f"{rel_dir}/photo_{idx}.jpg"
        tmp = directory / f"photo_{idx}.jpg.tmp"
        tmp.write_bytes(buf.getvalue())
        os.replace(tmp, directory / f"photo_{idx}.jpg")
        paths.append(rel)
    return paths


def _server_image_classification(db: Session, corporation_id: str, decoded):
    """
    Re-run the image classifier on the stored photos so the ticket's AI result is server-trusted.
    Returns (summary stored in complaint.ai_scores, full trace for the AI prediction history).
    """
    import time as _time
    from backend.app.ml.registry import get_classifier_registry
    from backend.app.services.issue_classification_service import (
        ComplaintContext, build_response, run_inference,
    )
    started = _time.perf_counter()
    classifier = None
    try:
        classifier = get_classifier_registry().get()
        indexed = list(enumerate(decoded))
        report = [{"index": i, "filename": None, "status": "analyzed", "error_code": None, "error_message": None,
                   "top_issue_code": None, "top_confidence": None} for i, _ in indexed]
        infer_started = _time.perf_counter()
        probs = run_inference(classifier, indexed)
        inference_ms = int((_time.perf_counter() - infer_started) * 1000)
        result = build_response(db, corporation_id, classifier, probs, indexed,
                                report, ComplaintContext(), started, 3)
    except Exception as exc:  # classifier unavailable/failed: ticket is still created
        model = None
        if classifier is not None:
            model = {"provider": classifier.info.provider, "model_id": classifier.info.model_id,
                     "version": classifier.info.version}
        return ({"status": "unavailable", "error": str(exc)[:200]},
                {"status": "unavailable", "error": str(exc)[:200], "model": model,
                 "images": [{"index": i, "status": "analyzed"} for i in range(len(decoded))]})
    try:
        spec = classifier.inference_spec()
    except Exception:  # noqa: BLE001
        spec = {}
    trace = {
        "status": result["status"],
        "recommended_issue_code": result["recommended_issue_code"],
        "predictions": result["predictions"],
        "images": result["images"],
        "aggregation": result["aggregation"],
        "thresholds": result["thresholds"],
        "model": result["model"],
        "inference_spec": spec,
        "inference_ms": inference_ms,
        "total_ms": result["latency_ms"],
    }
    keep = ("rank", "issue_code", "issue_name", "issue_name_mr", "confidence", "confidence_band", "recommended",
            "category_id", "app_category_id", "department_code", "department_name", "department_name_mr",
            "sla_hours", "response_sla_hours")
    return ({
        "status": result["status"],
        "recommended_issue_code": result["recommended_issue_code"],
        "predictions": [{k: p.get(k) for k in keep} for p in result["predictions"]],
        "model": result["model"],
    }, trace)


@router.post("/with-media", response_model=ComplaintResponse, status_code=201,
             summary="Create a complaint with photos and a previously uploaded voice note")
async def create_complaint_with_media(
    payload: str = Form(..., description="ComplaintCreate as JSON"),
    photos: Optional[List[UploadFile]] = File(None),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    from fastapi.concurrency import run_in_threadpool
    from pydantic import ValidationError
    from backend.app.config import settings
    from backend.app.ml.preprocessing import ImageValidationError, decode_image

    try:
        data = ComplaintCreate.model_validate_json(payload)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail={"code": "INVALID_PAYLOAD", "message": str(exc)[:500]})

    files = [f for f in (photos or []) if f is not None and (f.filename or f.size)]
    if len(files) > MAX_COMPLAINT_PHOTOS:
        raise HTTPException(status_code=400, detail={"code": "TOO_MANY_IMAGES", "message": f"Maximum {MAX_COMPLAINT_PHOTOS} photos."})
    decoded = []
    for f in files:
        raw = await f.read(settings.AI_MAX_IMAGE_BYTES + 1)
        try:
            decoded.append(decode_image(raw, settings.AI_ALLOWED_IMAGE_FORMATS.split(","),
                                        settings.AI_MAX_IMAGE_BYTES, settings.AI_MAX_IMAGE_PIXELS).image)
        except ImageValidationError as exc:
            raise HTTPException(status_code=413 if exc.code == "IMAGE_TOO_LARGE" else 400,
                                detail={"code": exc.code, "message": f"{f.filename or 'photo'}: {exc.message}"})

    corporation_id = current_user.corporation_id if current_user else "SMKMC"
    image_ai, image_trace = (await run_in_threadpool(_server_image_classification, db, corporation_id, decoded)
                             if decoded else (None, None))

    def attach_media(complaint):
        paths = _store_photos(complaint.id, decoded)
        for idx, rel in enumerate(paths, start=1):
            db.add(Attachment(id=f"att_{complaint.id}_before_{idx}", complaint_id=complaint.id,
                              attachment_type="before", file_path=rel))
        if image_ai is not None:
            scores = dict(complaint.ai_scores or {})
            scores["image_classification"] = image_ai
            complaint.ai_scores = scores

    complaint = await run_in_threadpool(_create_complaint_core, data, db, current_user, attach_media, image_trace)
    db.refresh(complaint)
    return complaint


@router.get("", response_model=List[ComplaintResponse])
def list_complaints(
    status: Optional[str] = None,
    ward_id: Optional[str] = None,
    category_id: Optional[str] = None,
    priority: Optional[str] = None,
    danger_flag: Optional[bool] = None,
    assignee_id: Optional[str] = None,
    supervisor_overdue: Optional[bool] = None,
    escalation_level: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    corporation_id = current_user.corporation_id if current_user else "SMKMC"
    q = db.query(Complaint).filter(Complaint.corporation_id == corporation_id)

    if status:
        q = q.filter(Complaint.status == status)
    if ward_id:
        q = q.filter(Complaint.ward_id == ward_id)
    if category_id:
        q = q.filter(Complaint.category_id == category_id)
    if priority:
        q = q.filter(Complaint.priority == priority)
    if danger_flag is not None:
        q = q.filter(Complaint.danger_flag == danger_flag)
    if assignee_id:
        q = q.filter(Complaint.assignee_id == assignee_id)
    if supervisor_overdue is not None:
        q = q.filter(Complaint.supervisor_overdue == supervisor_overdue)
    if escalation_level:
        q = q.filter(Complaint.escalation_level == escalation_level)

    # Role specific scope
    if current_user:
        if current_user.role == "citizen":
            q = q.filter(Complaint.citizen_id == current_user.id)
        elif current_user.role == "field_officer":
            q = q.filter(Complaint.assignee_id == current_user.id)

    return q.order_by(Complaint.created_at.desc()).offset(offset).limit(limit).all()

@router.get("/public/{ref}")
def get_public_complaint(ref: str, db: Session = Depends(get_db)):
    """
    Public tracking endpoint. Returns complaint status and SLA timing ONLY.
    Never exposes citizen identity or personal contact information.
    """
    c = db.query(Complaint).filter(Complaint.id == ref).first()
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")
    
    return {
        "id": c.id,
        "status": c.status,
        "priority": c.priority,
        "category_id": c.category_id,
        "category_name": c.category.name if c.category else "Civic Issue",
        "ward_id": c.ward_id,
        "address": c.address,
        "created_at": c.created_at,
        "response_due": c.response_due,
        "resolution_due": c.resolution_due,
        "resolved_at": c.resolved_at,
        "escalation_level": c.escalation_level,
        "channel": c.channel
    }

@router.get("/{ref}", response_model=ComplaintResponse)
def get_complaint(ref: str, db: Session = Depends(get_db)):
    c = db.query(Complaint).filter(Complaint.id == ref).first()
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")
    # Strict anonymity check: staff and public never see personal details of anonymous citizen
    if c.is_anonymous:
        c.citizen_name = "Anonymous citizen"
        c.citizen_mobile = None
    return c

@router.get("/{ref}/duplicate-candidates")
def get_duplicate_candidates(ref: str, db: Session = Depends(get_db)):
    """
    Returns candidate duplicates for this complaint:
    - Same civic category
    - Distance <= 100 meters
    - Created within 7 days
    """
    c = db.query(Complaint).filter(Complaint.id == ref).first()
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")

    candidates = []
    # Search complaints in same corporation
    potential = db.query(Complaint).filter(
        Complaint.corporation_id == c.corporation_id,
        Complaint.category_id == c.category_id,
        Complaint.id != c.id,
        Complaint.status.notin_(["REJECTED"])
    ).all()

    for other in potential:
        if other.latitude is None or other.longitude is None or c.latitude is None or c.longitude is None:
            continue
        dist = haversine_distance_meters(c.latitude, c.longitude, other.latitude, other.longitude)
        time_diff_days = abs((other.created_at - c.created_at).total_seconds()) / 86400.0
        if dist <= 100.0 and time_diff_days <= 7.0:
            candidates.append({
                "id": other.id,
                "category_id": other.category_id,
                "description": other.description,
                "status": other.status,
                "distance_meters": round(dist, 1),
                "created_at": other.created_at,
                "address": other.address,
                "is_older": other.created_at < c.created_at
            })

    candidates.sort(key=lambda x: x["distance_meters"])
    return candidates

@router.post("/{ref}/verify-danger")
def verify_complaint_danger(
    ref: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Verifies that a complaint involves genuine safety danger."""
    if current_user.role not in ["field_officer", "supervisor", "corp_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized to verify danger flag")
    c = db.query(Complaint).filter(Complaint.id == ref).first()
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")

    c.danger_flag = True
    c.danger_verified = True
    now = get_now()

    event = ComplaintEvent(
        complaint_id=c.id,
        actor_id=current_user.id,
        actor_name=current_user.name,
        actor_role=current_user.role,
        action="DANGER_VERIFIED",
        comment="Danger flag verified by civic official.",
        created_at=now
    )
    db.add(event)
    db.commit()
    return {"status": "SUCCESS", "danger_flag": True, "danger_verified": True}

@router.get("/{ref}/timeline")
def get_complaint_timeline(ref: str, db: Session = Depends(get_db)):
    """Returns chronological audit timeline for the complaint."""
    c = db.query(Complaint).filter(Complaint.id == ref).first()
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")
    events = db.query(ComplaintEvent).filter(ComplaintEvent.complaint_id == ref).order_by(ComplaintEvent.created_at.asc()).all()
    return [
        {
            "id": ev.id,
            "action": ev.action,
            "actor_name": ev.actor_name,
            "actor_role": ev.actor_role,
            "from_status": ev.from_status,
            "to_status": ev.to_status,
            "comment": ev.comment,
            "created_at": ev.created_at
        }
        for ev in events
    ]

@router.post("/{ref}/assign", response_model=ComplaintResponse)
def assign_complaint(
    ref: str,
    payload: ComplaintAssignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    c = db.query(Complaint).filter(Complaint.id == ref).first()
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")

    prev_assignee = c.assignee_id
    c.assignee_id = payload.assignee_id
    c.status = "ASSIGNED"

    event = ComplaintEvent(
        complaint_id=ref,
        actor_id=current_user.id,
        actor_name=current_user.name,
        actor_role=current_user.role,
        action="ASSIGNED",
        from_status="TO_CHECK" if c.status == "TO_CHECK" else c.status,
        to_status="ASSIGNED",
        comment=payload.comment or f"Assigned to officer {payload.assignee_id}",
        created_at=get_now()
    )
    db.add(event)
    db.commit()
    db.refresh(c)

    NotificationService.notify_user(
        db=db,
        corporation_id=c.corporation_id,
        user_id=payload.assignee_id,
        title="Complaint Assigned",
        body=f"Complaint {ref} has been assigned to you.",
        complaint_id=ref
    )

    AuditService.log(
        db=db,
        corporation_id=c.corporation_id,
        actor_id=current_user.id,
        actor_name=current_user.name,
        actor_role=current_user.role,
        action="ASSIGN_COMPLAINT",
        entity_type="complaint",
        entity_id=ref,
        details={"assignee": payload.assignee_id, "prev_assignee": prev_assignee}
    )

    return c

@router.post("/{ref}/status", response_model=ComplaintResponse)
def update_complaint_status(
    ref: str,
    payload: ComplaintStatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    c = db.query(Complaint).filter(Complaint.id == ref).first()
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")

    old_status = c.status
    target_status = payload.status

    # Validate transition against strict civic state machine
    allowed_for_state = ALLOWED_TRANSITIONS.get(old_status, {})
    if target_status not in allowed_for_state:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Illegal status transition: cannot change complaint from '{old_status}' to '{target_status}'"
        )

    # Validate role authority
    allowed_roles = allowed_for_state[target_status]
    if current_user.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"User role '{current_user.role}' is not authorized to transition complaint from '{old_status}' to '{target_status}'"
        )

    c.status = target_status
    now = get_now()

    if target_status == "RESOLVED":
        c.resolved_at = now
    elif target_status == "CLOSED":
        c.closed_at = now

    event = ComplaintEvent(
        complaint_id=ref,
        actor_id=current_user.id,
        actor_name=current_user.name,
        actor_role=current_user.role,
        action=f"STATUS_CHANGE_{target_status}",
        from_status=old_status,
        to_status=target_status,
        comment=payload.comment or f"Status changed to {target_status}",
        created_at=now
    )
    db.add(event)
    db.commit()
    db.refresh(c)

    AuditService.log(
        db=db,
        corporation_id=c.corporation_id,
        actor_id=current_user.id,
        actor_name=current_user.name,
        actor_role=current_user.role,
        action="UPDATE_STATUS",
        entity_type="complaint",
        entity_id=ref,
        details={"from": old_status, "to": target_status}
    )

    return c

@router.post("/{ref}/transfer", response_model=Dict[str, Any])
def transfer_complaint(
    ref: str,
    payload: ComplaintTransferRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    c = db.query(Complaint).filter(Complaint.id == ref).first()
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")

    check = can_request_transfer(c.transfer_count, payload.target_unit_id, payload.reason)
    if not check["allowed"]:
        raise HTTPException(status_code=400, detail=check["message"])

    if check["requires_approval"]:
        # 2nd transfer requires supervisor approval
        approval_id = f"appr_tf_{c.id}_{int(datetime.datetime.utcnow().timestamp())}"
        appr = ApprovalRequest(
            id=approval_id,
            corporation_id=c.corporation_id,
            complaint_id=c.id,
            request_type="second_transfer",
            requester_id=current_user.id,
            requester_name=current_user.name,
            details={"target_unit_id": payload.target_unit_id, "reason": payload.reason},
            status="PENDING"
        )
        db.add(appr)

        event = ComplaintEvent(
            complaint_id=ref,
            actor_id=current_user.id,
            actor_name=current_user.name,
            actor_role=current_user.role,
            action="TRANSFER_APPROVAL_REQUESTED",
            comment=f"2nd transfer to unit {payload.target_unit_id} requested: {payload.reason}",
            created_at=datetime.datetime.utcnow()
        )
        db.add(event)
        db.commit()

        NotificationService.notify_role(
            db=db,
            corporation_id=c.corporation_id,
            role="supervisor",
            title="Transfer Approval Requested",
            body=f"{c.id}: 2nd transfer to unit {payload.target_unit_id} requires your approval.",
            complaint_id=ref
        )

        return {"status": "APPROVAL_REQUIRED", "message": "Second transfer submitted for supervisor approval.", "approval_id": approval_id}

    else:
        # 1st transfer is direct! Clocks restart on transfer, total age is kept.
        c.unit_id = payload.target_unit_id
        c.assignee_id = None
        c.status = "TO_CHECK"
        c.transfer_count += 1

        # Restart clocks
        now = datetime.datetime.utcnow()
        category = db.query(Category).filter(Category.id == c.category_id).first()
        res_hours = category.resolution_hours if category else 72
        due_dates = compute_due_dates(now, resolution_hours=res_hours, is_urgent=c.danger_flag)
        c.response_due = due_dates["response_due"]
        c.resolution_due = due_dates["resolution_due"]

        event = ComplaintEvent(
            complaint_id=ref,
            actor_id=current_user.id,
            actor_name=current_user.name,
            actor_role=current_user.role,
            action="TRANSFERRED",
            to_status="TO_CHECK",
            comment=f"Direct transfer (1st) to unit {payload.target_unit_id}: {payload.reason}",
            created_at=now
        )
        db.add(event)
        db.commit()

        AuditService.log(
            db=db,
            corporation_id=c.corporation_id,
            actor_id=current_user.id,
            actor_name=current_user.name,
            actor_role=current_user.role,
            action="TRANSFER_COMPLAINT_DIRECT",
            entity_type="complaint",
            entity_id=ref,
            details={"target_unit": payload.target_unit_id, "transfer_count": c.transfer_count}
        )

        return {"status": "TRANSFERRED", "message": "Complaint transferred directly.", "transfer_count": c.transfer_count}

@router.post("/{ref}/request-rejection", response_model=Dict[str, Any])
def request_rejection(
    ref: str,
    payload: ComplaintRejectionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    c = db.query(Complaint).filter(Complaint.id == ref).first()
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")

    check = can_request_rejection(payload.reason)
    if not check["allowed"]:
        raise HTTPException(status_code=400, detail=check["message"])

    c.status = "REJECTION_REQUESTED"
    appr_id = f"appr_rej_{c.id}_{int(datetime.datetime.utcnow().timestamp())}"
    appr = ApprovalRequest(
        id=appr_id,
        corporation_id=c.corporation_id,
        complaint_id=c.id,
        request_type="rejection",
        requester_id=current_user.id,
        requester_name=current_user.name,
        details={"reason": payload.reason},
        status="PENDING"
    )
    db.add(appr)

    event = ComplaintEvent(
        complaint_id=ref,
        actor_id=current_user.id,
        actor_name=current_user.name,
        actor_role=current_user.role,
        action="REJECTION_REQUESTED",
        from_status=c.status,
        to_status="REJECTION_REQUESTED",
        comment=f"Rejection requested by officer: {payload.reason}",
        created_at=datetime.datetime.utcnow()
    )
    db.add(event)
    db.commit()

    NotificationService.notify_role(
        db=db,
        corporation_id=c.corporation_id,
        role="supervisor",
        title="Rejection Approval Requested",
        body=f"{c.id}: Officer requested complaint rejection.",
        complaint_id=ref
    )

    return {"status": "PENDING_APPROVAL", "message": "Rejection submitted for supervisor review.", "approval_id": appr_id}

@router.post("/{ref}/request-extension", response_model=Dict[str, Any])
def request_extension(
    ref: str,
    payload: ComplaintExtensionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    c = db.query(Complaint).filter(Complaint.id == ref).first()
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")

    now = datetime.datetime.utcnow()
    check = can_request_extension(payload.new_due_date, payload.reason, now)
    if not check["allowed"]:
        raise HTTPException(status_code=400, detail=check["message"])

    appr_id = f"appr_ext_{c.id}_{int(now.timestamp())}"
    appr = ApprovalRequest(
        id=appr_id,
        corporation_id=c.corporation_id,
        complaint_id=c.id,
        request_type="extension",
        requester_id=current_user.id,
        requester_name=current_user.name,
        details={"new_due_date": payload.new_due_date.isoformat(), "reason": payload.reason},
        status="PENDING"
    )
    db.add(appr)

    event = ComplaintEvent(
        complaint_id=ref,
        actor_id=current_user.id,
        actor_name=current_user.name,
        actor_role=current_user.role,
        action="EXTENSION_REQUESTED",
        comment=f"Extension to {payload.new_due_date.strftime('%d %b %Y')} requested: {payload.reason}",
        created_at=now
    )
    db.add(event)
    db.commit()

    NotificationService.notify_role(
        db=db,
        corporation_id=c.corporation_id,
        role="supervisor",
        title="SLA Extension Requested",
        body=f"{c.id}: Extension requested until {payload.new_due_date.strftime('%d %b %Y')}",
        complaint_id=ref
    )

    return {"status": "PENDING_APPROVAL", "message": "Extension request submitted to supervisor.", "approval_id": appr_id}

@router.post("/{ref}/resolve", response_model=ComplaintResponse)
def resolve_complaint(
    ref: str,
    payload: ComplaintResolveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    c = db.query(Complaint).filter(Complaint.id == ref).first()
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")

    now = datetime.datetime.utcnow()

    # After-photo verification
    flagged = False
    warning = None
    if payload.after_photo_metadata:
        photo_check = verify_after_resolution_photo(
            complaint_lat=c.latitude,
            complaint_lon=c.longitude,
            complaint_created_at=c.created_at,
            after_photo_time=payload.after_photo_metadata.get("exif_time"),
            after_photo_lat=payload.after_photo_metadata.get("exif_latitude"),
            after_photo_lon=payload.after_photo_metadata.get("exif_longitude")
        )
        flagged = photo_check["flagged"]
        warning = photo_check.get("warning")

    old_status = c.status
    c.status = "RESOLVED"
    c.resolved_at = now

    event = ComplaintEvent(
        complaint_id=ref,
        actor_id=current_user.id,
        actor_name=current_user.name,
        actor_role=current_user.role,
        action="RESOLVED",
        from_status=old_status,
        to_status="RESOLVED",
        comment=payload.resolution_notes + (f" [Photo note: {warning}]" if warning else ""),
        created_at=now
    )
    db.add(event)

    if payload.after_photo_path:
        attachment = Attachment(
            id=f"att_{c.id}_after_{int(now.timestamp())}",
            complaint_id=c.id,
            attachment_type="after",
            file_path=payload.after_photo_path,
            is_verified=not flagged,
            flags={"flagged": flagged, "warning": warning}
        )
        db.add(attachment)

    db.commit()
    db.refresh(c)

    # Notify citizen
    if c.citizen_id:
        NotificationService.notify_user(
            db=db,
            corporation_id=c.corporation_id,
            user_id=c.citizen_id,
            title="Complaint Resolved",
            body=f"Your complaint {ref} has been resolved. You have 7 days to verify or reopen.",
            complaint_id=ref
        )

    AuditService.log(
        db=db,
        corporation_id=c.corporation_id,
        actor_id=current_user.id,
        actor_name=current_user.name,
        actor_role=current_user.role,
        action="RESOLVE_COMPLAINT",
        entity_type="complaint",
        entity_id=ref,
        details={"photo_flagged": flagged}
    )

    return c

@router.post("/{ref}/reopen", response_model=Dict[str, Any])
def reopen_complaint(
    ref: str,
    payload: ComplaintReopenRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    c = db.query(Complaint).filter(Complaint.id == ref).first()
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")

    now = datetime.datetime.utcnow()
    check = can_reopen_complaint(
        status=c.status,
        resolved_at=c.resolved_at,
        current_reopen_count=c.reopen_count,
        now=now
    )

    if not check["allowed"]:
        raise HTTPException(status_code=400, detail=check["message"])

    if check["requires_approval"]:
        # 3rd reopen goes to supervisor approval
        appr_id = f"appr_reopen3_{c.id}_{int(now.timestamp())}"
        appr = ApprovalRequest(
            id=appr_id,
            corporation_id=c.corporation_id,
            complaint_id=c.id,
            request_type="third_reopen",
            requester_id=current_user.id,
            requester_name=current_user.name,
            details={"reason": payload.reason},
            status="PENDING"
        )
        db.add(appr)

        event = ComplaintEvent(
            complaint_id=ref,
            actor_id=current_user.id,
            actor_name=current_user.name,
            actor_role=current_user.role,
            action="THIRD_REOPEN_REQUESTED",
            comment=f"3rd reopen requested: {payload.reason}",
            created_at=now
        )
        db.add(event)
        db.commit()

        NotificationService.notify_role(
            db=db,
            corporation_id=c.corporation_id,
            role="supervisor",
            title="3rd Reopen Approval Requested",
            body=f"{c.id}: Citizen requested 3rd reopen.",
            complaint_id=ref
        )

        return {"status": "APPROVAL_REQUIRED", "message": "3rd reopen submitted for supervisor approval.", "approval_id": appr_id}

    else:
        # Direct reopen (max 2 within 7 days)
        c.status = "REOPENED"
        c.reopen_count += 1
        c.resolved_at = None

        event = ComplaintEvent(
            complaint_id=ref,
            actor_id=current_user.id,
            actor_name=current_user.name,
            actor_role=current_user.role,
            action="REOPENED",
            from_status="RESOLVED",
            to_status="REOPENED",
            comment=f"Complaint reopened (count={c.reopen_count}): {payload.reason}",
            created_at=now
        )
        db.add(event)
        db.commit()

        # Notify assigned officer
        if c.assignee_id:
            NotificationService.notify_user(
                db=db,
                corporation_id=c.corporation_id,
                user_id=c.assignee_id,
                title="Complaint Reopened",
                body=f"Complaint {ref} was reopened by citizen: {payload.reason}",
                complaint_id=ref
            )

        AuditService.log(
            db=db,
            corporation_id=c.corporation_id,
            actor_id=current_user.id,
            actor_name=current_user.name,
            actor_role=current_user.role,
            action="REOPEN_COMPLAINT_DIRECT",
            entity_type="complaint",
            entity_id=ref,
            details={"reopen_count": c.reopen_count}
        )

        return {"status": "REOPENED", "message": "Complaint reopened.", "reopen_count": c.reopen_count}

@router.post("/{ref}/link-duplicate", response_model=Dict[str, Any])
def link_duplicate(
    ref: str,
    payload: LinkDuplicateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Links duplicate complaints manually:
    - Parent is always the oldest complaint
    - Never auto-merge
    - Notifies reporters
    """
    c = db.query(Complaint).filter(Complaint.id == ref).first()
    parent = db.query(Complaint).filter(Complaint.id == payload.parent_complaint_id).first()

    if not c or not parent:
        raise HTTPException(status_code=404, detail="Complaint not found")

    # Enforce parent is oldest
    if parent.created_at > c.created_at:
        # Swap so parent is strictly the oldest
        parent, c = c, parent

    c.parent_id = parent.id

    event = ComplaintEvent(
        complaint_id=c.id,
        actor_id=current_user.id,
        actor_name=current_user.name,
        actor_role=current_user.role,
        action="LINKED_AS_DUPLICATE",
        comment=f"Linked as duplicate of older complaint {parent.id}. {payload.notes or ''}",
        created_at=datetime.datetime.utcnow()
    )
    db.add(event)
    db.commit()

    # Notify reporter of child complaint
    if c.citizen_id:
        NotificationService.notify_user(
            db=db,
            corporation_id=c.corporation_id,
            user_id=c.citizen_id,
            title="Duplicate Linked",
            body=f"Your complaint {c.id} was linked with existing ticket {parent.id}. Progress will track together.",
            complaint_id=c.id
        )

    AuditService.log(
        db=db,
        corporation_id=c.corporation_id,
        actor_id=current_user.id,
        actor_name=current_user.name,
        actor_role=current_user.role,
        action="LINK_DUPLICATE",
        entity_type="complaint",
        entity_id=c.id,
        details={"parent_id": parent.id}
    )

    return {"status": "LINKED", "parent_id": parent.id, "child_id": c.id}
