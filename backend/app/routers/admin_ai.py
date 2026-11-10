"""
Admin "AI & Model Management" API (/api/v1/admin/ai/*).

Read access: platform_admin (all corporations) and corp_admin (own corporation's predictions only).
Writes that affect the model lifecycle (registry sync, training samples, datasets, training runs,
promotion approvals) are platform_admin only. Citizen identity (name, mobile) is never returned.
"""
import datetime
from collections import Counter, defaultdict
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.database import get_db
from backend.app.models.ai_history import (
    AIDatasetVersion, AIModelVersion, AIPredictionEvent, AIPredictionFeedback, AITrainingRun, AITrainingSample,
)
from backend.app.models.models import (
    Attachment, Category, Complaint, ComplaintEvent, Department, User, VoiceNote, Ward,
)
from backend.app.services.ai_history_service import (
    AIHistoryError, allowed_labels, decide_training_eligibility, record_feedback, snapshot_dataset,
)
from backend.app.services.ai_model_registry_service import (
    MODEL_KEYS, active_model_version, find_model_version, runtime_status, sync_model_registry,
)
from backend.app.services.audit_service import AuditService
from backend.app.services.auth_service import require_role

router = APIRouter(prefix="/admin/ai", tags=["admin-ai"])

READ_ROLES = ["platform_admin", "corp_admin"]
LIFECYCLE_ROLES = ["platform_admin"]


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
def _iso(dt: Optional[datetime.datetime]) -> Optional[str]:
    return dt.isoformat() + "Z" if dt else None


def _err(exc: AIHistoryError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail={"code": exc.code, "message": exc.message})


def _scoped(q, user: User, corporation_id: Optional[str] = None):
    if user.role == "platform_admin":
        return q.filter(AIPredictionEvent.corporation_id == corporation_id) if corporation_id else q
    return q.filter(AIPredictionEvent.corporation_id == user.corporation_id)


def _get_event(db: Session, user: User, prediction_id: str) -> AIPredictionEvent:
    ev = _scoped(db.query(AIPredictionEvent), user).filter(AIPredictionEvent.id == prediction_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Prediction not found."})
    return ev


def _audit(db: Session, user: User, action: str, entity_type: str, entity_id: str, details: Dict[str, Any]):
    try:
        AuditService.log(db=db, corporation_id=user.corporation_id or "SMKMC", actor_id=user.id,
                         actor_name=user.name, actor_role=user.role, action=action, entity_type=entity_type,
                         entity_id=entity_id, details=details)
    except Exception:  # noqa: BLE001 - audit is best effort here
        db.rollback()


def _environment() -> Dict[str, Any]:
    return {"mode": "development" if settings.DEV_MODE else "production", "dev_mode": settings.DEV_MODE}


def _event_row(ev: AIPredictionEvent) -> Dict[str, Any]:
    return {
        "id": ev.id, "complaint_id": ev.complaint_id, "corporation_id": ev.corporation_id,
        "input_type": ev.input_type, "task": ev.task, "status": ev.status,
        "predicted_label": ev.predicted_label, "predicted_label_name": ev.predicted_label_name,
        "predicted_category_id": ev.predicted_category_id, "predicted_category_name": ev.predicted_category_name,
        "predicted_department_name": ev.predicted_department_name,
        "model_key": ev.model_key, "model_name": ev.model_name, "model_version": ev.model_version,
        "model_version_id": ev.model_version_id,
        "confidence": ev.confidence, "routing_decision": ev.routing_decision,
        "feedback_status": ev.feedback_status, "training_eligibility": ev.training_eligibility,
        "origin": ev.origin, "is_demo": bool(ev.is_demo), "created_at": _iso(ev.created_at),
    }


def _model_row(mv: AIModelVersion, usage: Optional[int] = None, full: bool = False) -> Dict[str, Any]:
    row = {
        "id": mv.id, "model_key": mv.model_key, "task": mv.task, "name": mv.name, "version": mv.version,
        "version_source": mv.version_source, "provider": mv.provider, "architecture": mv.architecture,
        "model_format": mv.model_format, "deployment_status": mv.deployment_status, "trainable": bool(mv.trainable),
        "artifact_uri": mv.artifact_uri, "artifact_checksum": mv.artifact_checksum,
        "output_class_count": len(mv.output_classes or []) if mv.output_classes is not None else None,
        "supported_languages": mv.supported_languages,
        "confidence_thresholds": mv.confidence_thresholds,
        "first_seen_at": _iso(mv.first_seen_at), "last_updated_at": _iso(mv.last_synced_at),
        "activated_at": _iso(mv.activated_at), "deactivated_at": _iso(mv.deactivated_at),
        "notes": mv.notes or [],
    }
    if usage is not None:
        row["prediction_count"] = usage
    if full:
        row.update({"input_spec": mv.input_spec, "output_classes": mv.output_classes,
                    "preprocessing": mv.preprocessing, "artifact_files": mv.artifact_files,
                    "framework": mv.framework, "metadata_source": mv.metadata_source, "extra": mv.extra})
    return row


def _run_row(r: AITrainingRun, full: bool = False) -> Dict[str, Any]:
    row = {
        "id": r.id, "model_key": r.model_key, "model_name": r.model_name,
        "previous_model_version": r.previous_model_version, "candidate_model_version": r.candidate_model_version,
        "dataset_version": r.dataset_version, "training_samples": r.training_samples,
        "training_status": r.training_status, "evaluation_status": r.evaluation_status,
        "deployment_status": r.deployment_status, "approval_status": r.approval_status,
        "environment": r.environment, "is_demo": bool(r.is_demo),
        "queued_at": _iso(r.queued_at), "started_at": _iso(r.started_at), "completed_at": _iso(r.completed_at),
    }
    if full:
        row.update({
            "dataset": {"version": r.dataset_version, "version_id": r.dataset_version_id,
                        "fingerprint": r.dataset_fingerprint, "split_sizes": r.split_sizes,
                        "class_distribution": r.class_distribution, "reviewed_samples": r.reviewed_samples,
                        "training_samples": r.training_samples},
            "training_config": r.training_config, "evaluation": r.evaluation, "comparison": r.comparison,
            "promotion": {"approval_status": r.approval_status, "approved_by": r.approved_by_name or r.approved_by,
                          "approved_at": _iso(r.approved_at), "approval_notes": r.approval_notes,
                          "deployment_status": r.deployment_status, "deployed_at": _iso(r.deployed_at),
                          "rollback_info": r.rollback_info},
            "previous_model_version_id": r.previous_model_version_id,
            "candidate_model_version_id": r.candidate_model_version_id,
            "reported_by": r.reported_by, "notes": r.notes, "updated_at": _iso(r.updated_at),
        })
    return row


def _requires_review_filter():
    return (AIPredictionEvent.feedback_status == "NOT_REVIEWED") & (
        (AIPredictionEvent.routing_decision == "HUMAN_REVIEW_REQUIRED") |
        ((AIPredictionEvent.model_key == "image_issue_classifier") &
         AIPredictionEvent.status.in_(["LOW_CONFIDENCE", "NO_CIVIC_ISSUE", "NO_PREDICTION"])))


# ---------------------------------------------------------------------------
# Overview / summary
# ---------------------------------------------------------------------------
@router.get("/overview")
def ai_overview(
    corporation_id: Optional[str] = None,
    include_demo: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(READ_ROLES)),
):
    """Summary cards + chart data. Every number is computed from stored records; demo rows excluded by default."""
    base = _scoped(db.query(AIPredictionEvent), current_user, corporation_id)
    demo_count = base.filter(AIPredictionEvent.is_demo == True).count()  # noqa: E712
    if not include_demo:
        base = base.filter(AIPredictionEvent.is_demo == False)  # noqa: E712
    events = base.all()

    active = db.query(AIModelVersion).filter(AIModelVersion.deployment_status == "ACTIVE").all()
    conf_by_model: Dict[str, List[float]] = defaultdict(list)
    for e in events:
        if e.confidence is not None and e.status != "FAILED":
            conf_by_model[e.model_key].append(e.confidence)
    avg_conf = {k: {"average": round(sum(v) / len(v), 4), "count": len(v)} for k, v in conf_by_model.items()}

    runs_q = db.query(AITrainingRun)
    if not include_demo:
        runs_q = runs_q.filter(AITrainingRun.is_demo == False)  # noqa: E712
    runs = runs_q.all()
    completed = [r for r in runs if r.training_status == "COMPLETED" and r.completed_at]
    last_success = max(completed, key=lambda r: r.completed_at) if completed else None

    requiring_review = base.filter(_requires_review_filter()).count()

    # charts
    today = datetime.datetime.utcnow().date()
    days = [today - datetime.timedelta(days=i) for i in range(29, -1, -1)]
    per_day: Dict[str, Dict[str, int]] = {d.isoformat(): defaultdict(int) for d in days}
    for e in events:
        key = e.created_at.date().isoformat() if e.created_at else None
        if key in per_day:
            per_day[key][e.model_key] += 1
    histogram: Dict[str, List[int]] = defaultdict(lambda: [0] * 10)
    for k, values in conf_by_model.items():
        for v in values:
            histogram[k][min(9, int(v * 10))] += 1

    samples = db.query(AITrainingSample).filter(AITrainingSample.status == "APPROVED").count()
    datasets = db.query(AIDatasetVersion).count()
    return {
        "environment": _environment(),
        "include_demo": include_demo,
        "summary": {
            "total_predictions": len(events),
            "demo_predictions_excluded": 0 if include_demo else demo_count,
            "active_models": [{"model_key": m.model_key, "name": m.name, "version": m.version, "id": m.id}
                              for m in active],
            "predictions_requiring_review": requiring_review,
            "average_confidence": avg_conf,
            "total_training_runs": len(runs),
            "last_successful_retraining": _run_row(last_success) if last_success else None,
        },
        "charts": {
            "predictions_per_day": [{"date": d, **dict(v)} for d, v in per_day.items()],
            "routing_decisions": dict(Counter(e.routing_decision for e in events)),
            "feedback_status": dict(Counter(e.feedback_status for e in events)),
            "input_types": dict(Counter(e.input_type for e in events)),
            "status": dict(Counter(e.status for e in events)),
            "confidence_histogram": {k: v for k, v in histogram.items()},
            "by_model_version": dict(Counter(f"{e.model_key}|{e.model_version}" for e in events)),
        },
        "lifecycle": {
            "predictions_logged": len(events),
            "reviewed": sum(1 for e in events if e.feedback_status != "NOT_REVIEWED"),
            "corrected": sum(1 for e in events if e.feedback_status == "CORRECTED"),
            "pending_validation": sum(1 for e in events if e.training_eligibility == "PENDING_VALIDATION"),
            "approved_training_samples": samples,
            "dataset_versions": datasets,
            "training_runs": len(runs),
            "evaluations_passed": sum(1 for r in runs if r.evaluation_status == "PASSED"),
            "promotions_approved": sum(1 for r in runs if r.approval_status == "APPROVED"),
            "deployed_from_training": sum(1 for r in runs if r.deployment_status == "ACTIVE"),
        },
        "runtime": runtime_status(),
        "training_pipeline": {
            "exists": len(runs) > 0,
            "message": None if runs else "No training run has been reported. This repository has no fine-tuning "
                                         "pipeline yet; the active image model is a zero-shot baseline.",
        },
    }


# ---------------------------------------------------------------------------
# Predictions
# ---------------------------------------------------------------------------
@router.get("/predictions")
def list_predictions(
    q: Optional[str] = Query(None, max_length=100, description="Prediction id, complaint reference or category"),
    date_from: Optional[datetime.date] = None,
    date_to: Optional[datetime.date] = None,
    model_key: Optional[str] = None,
    model_version: Optional[str] = None,
    input_type: Optional[str] = None,
    category: Optional[str] = None,
    min_confidence: Optional[float] = Query(None, ge=0, le=1),
    max_confidence: Optional[float] = Query(None, ge=0, le=1),
    feedback_status: Optional[str] = None,
    routing_decision: Optional[str] = None,
    requires_review: bool = False,
    include_demo: bool = True,
    corporation_id: Optional[str] = None,
    sort: Literal["newest", "oldest", "confidence_desc", "confidence_asc"] = "newest",
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(READ_ROLES)),
):
    base = _scoped(db.query(AIPredictionEvent), current_user, corporation_id)
    facets_q = base
    if not include_demo:
        base = base.filter(AIPredictionEvent.is_demo == False)  # noqa: E712
    if q:
        like = f"%{q.strip()}%"
        base = base.filter(or_(AIPredictionEvent.id.ilike(like), AIPredictionEvent.complaint_id.ilike(like),
                               AIPredictionEvent.predicted_label.ilike(like),
                               AIPredictionEvent.predicted_label_name.ilike(like),
                               AIPredictionEvent.predicted_category_name.ilike(like)))
    if date_from:
        base = base.filter(AIPredictionEvent.created_at >= datetime.datetime.combine(date_from, datetime.time.min))
    if date_to:
        base = base.filter(AIPredictionEvent.created_at < datetime.datetime.combine(date_to + datetime.timedelta(days=1), datetime.time.min))
    if model_key:
        base = base.filter(AIPredictionEvent.model_key == model_key)
    if model_version:
        base = base.filter(AIPredictionEvent.model_version == model_version)
    if input_type:
        base = base.filter(AIPredictionEvent.input_type == input_type.upper())
    if category:
        base = base.filter(or_(AIPredictionEvent.predicted_category_id == category,
                               AIPredictionEvent.predicted_label == category))
    if min_confidence is not None:
        base = base.filter(AIPredictionEvent.confidence >= min_confidence)
    if max_confidence is not None:
        base = base.filter(AIPredictionEvent.confidence <= max_confidence)
    if feedback_status:
        base = base.filter(AIPredictionEvent.feedback_status == feedback_status.upper())
    if routing_decision:
        base = base.filter(AIPredictionEvent.routing_decision == routing_decision.upper())
    if requires_review:
        base = base.filter(_requires_review_filter())

    total = base.count()
    order = {
        "newest": [AIPredictionEvent.created_at.desc(), AIPredictionEvent.id],
        "oldest": [AIPredictionEvent.created_at.asc(), AIPredictionEvent.id],
        "confidence_desc": [AIPredictionEvent.confidence.desc(), AIPredictionEvent.created_at.desc()],
        "confidence_asc": [AIPredictionEvent.confidence.asc(), AIPredictionEvent.created_at.desc()],
    }[sort]
    rows = base.order_by(*order).offset((page - 1) * page_size).limit(page_size).all()

    versions = facets_q.with_entities(AIPredictionEvent.model_key, AIPredictionEvent.model_version,
                                      func.count()).group_by(AIPredictionEvent.model_key, AIPredictionEvent.model_version).all()
    cats = facets_q.with_entities(AIPredictionEvent.predicted_category_id, AIPredictionEvent.predicted_category_name,
                                  func.count()).group_by(AIPredictionEvent.predicted_category_id,
                                                         AIPredictionEvent.predicted_category_name).all()
    labels = facets_q.with_entities(AIPredictionEvent.predicted_label, AIPredictionEvent.predicted_label_name,
                                    func.count()).group_by(AIPredictionEvent.predicted_label,
                                                           AIPredictionEvent.predicted_label_name).all()
    return {
        "items": [_event_row(r) for r in rows],
        "total": total, "page": page, "page_size": page_size,
        "facets": {
            "model_versions": [{"model_key": k, "version": v, "count": n} for k, v, n in versions],
            "categories": [{"id": i, "name": nm, "count": n} for i, nm, n in cats if i],
            "labels": [{"id": i, "name": nm, "count": n} for i, nm, n in labels if i],
        },
        "environment": _environment(),
    }


@router.get("/predictions/{prediction_id}")
def get_prediction(
    prediction_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(READ_ROLES)),
):
    ev = _get_event(db, current_user, prediction_id)
    complaint = db.query(Complaint).filter(Complaint.id == ev.complaint_id).first() if ev.complaint_id else None
    context = None
    if complaint:
        cat = db.query(Category).filter(Category.id == complaint.category_id).first()
        dept = db.query(Department).filter(Department.id == cat.department_id).first() if cat else None
        ward = db.query(Ward).filter(Ward.id == complaint.ward_id).first() if complaint.ward_id else None
        vn = db.query(VoiceNote).filter(VoiceNote.complaint_id == complaint.id).order_by(VoiceNote.created_at.desc()).first()
        photos = db.query(Attachment).filter(Attachment.complaint_id == complaint.id,
                                             Attachment.attachment_type == "before").all()
        initial = (db.query(ComplaintEvent).filter(ComplaintEvent.complaint_id == complaint.id,
                                                   ComplaintEvent.action == "COMPLAINT_SUBMITTED")
                   .order_by(ComplaintEvent.created_at.asc()).first())
        modalities = []
        if photos:
            modalities.append("image")
        if complaint.description:
            modalities.append("text")
        if vn:
            modalities.append("voice")
        context = {
            "complaint_reference": complaint.id,
            "submitted_at": _iso(complaint.created_at),
            "channel": complaint.channel,
            "input_modalities": modalities,
            "is_anonymous": bool(complaint.is_anonymous),
            "filed_category_id": complaint.category_id,
            "filed_category_name": cat.name if cat else None,
            "department": dept.name if dept else None,
            "ward": ward.name if ward else None,
            "initial_status": initial.to_status if initial else None,
            "current_status": complaint.status,
            "description": complaint.description,
            "photo_urls": [a.url for a in photos],
            "voice": ({"language": vn.language, "duration_seconds": vn.duration_seconds,
                       "transcription_status": vn.transcription_status,
                       "transcription_model": vn.transcription_provider, "transcript": vn.transcript}
                      if vn else None),
        }
    mv = db.query(AIModelVersion).filter(AIModelVersion.id == ev.model_version_id).first() if ev.model_version_id else None
    siblings = _scoped(db.query(AIPredictionEvent), current_user).filter(
        AIPredictionEvent.complaint_id == ev.complaint_id, AIPredictionEvent.id != ev.id).all() if ev.complaint_id else []
    sample = db.query(AITrainingSample).filter(AITrainingSample.prediction_id == ev.id).first()
    labels = allowed_labels(db, ev)
    names = {c.get("code"): c.get("name") for c in ((mv.output_classes if mv else None) or [])}
    return {
        **_event_row(ev),
        "complaint": context,
        "model": ({**_model_row(mv), "artifact_files": mv.artifact_files, "framework": mv.framework}
                  if mv else {"name": ev.model_name, "version": ev.model_version, "provider": ev.model_provider,
                              "registered": False}),
        "inference": {"params": ev.inference_params, "latency_ms": ev.latency_ms, "input_summary": ev.input_summary},
        "results": {"status": ev.status, "top_predictions": ev.top_predictions or [],
                    "routing_decision": ev.routing_decision, "routing_reason": ev.routing_reason,
                    "final_category_id": ev.final_category_id, "error_message": ev.error_message,
                    "timestamp": _iso(ev.created_at)},
        "feedback": {
            "original_prediction": ev.predicted_label,
            "ground_truth_label": ev.ground_truth_label,
            "ground_truth_label_name": names.get(ev.ground_truth_label) if ev.ground_truth_label else None,
            "review_status": ev.feedback_status,
            "training_eligibility": ev.training_eligibility,
            "training_eligibility_reason": ev.training_eligibility_reason,
            "training_sample_id": sample.id if sample else None,
            "history": [{"id": f.id, "review_status": f.review_status, "original_label": f.original_label,
                         "corrected_label": f.corrected_label, "corrected_label_name": f.corrected_label_name,
                         "notes": f.notes, "reviewer": f.reviewer_name, "reviewer_id": f.reviewer_id,
                         "reviewer_role": f.reviewer_role, "created_at": _iso(f.created_at)} for f in ev.feedback],
            "allowed_labels": [{"code": c, "name": names.get(c)} for c in (labels or [])],
            "can_review": not ev.is_demo and ev.status != "FAILED" and ev.training_eligibility != "APPROVED",
            "can_validate": (current_user.role == "platform_admin" and ev.training_eligibility == "PENDING_VALIDATION"
                             and bool(ev.feedback) and ev.feedback[0].reviewer_id != current_user.id),
        },
        "related_predictions": [_event_row(s) for s in siblings],
        "environment": _environment(),
    }


class FeedbackRequest(BaseModel):
    review_status: Literal["ACCEPTED", "CORRECTED", "DISPUTED"]
    corrected_label: Optional[str] = Field(None, max_length=60)
    notes: Optional[str] = Field(None, max_length=1000)


@router.post("/predictions/{prediction_id}/feedback")
def submit_feedback(
    prediction_id: str,
    payload: FeedbackRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(READ_ROLES)),
):
    """Record a reviewer verdict. It does NOT add the example to training data."""
    ev = _get_event(db, current_user, prediction_id)
    try:
        fb = record_feedback(db, ev, current_user, payload.review_status, payload.corrected_label, payload.notes)
    except AIHistoryError as exc:
        raise _err(exc)
    _audit(db, current_user, "AI_PREDICTION_FEEDBACK", "ai_prediction", ev.id,
           {"review_status": fb.review_status, "corrected_label": fb.corrected_label, "complaint": ev.complaint_id})
    return {"prediction_id": ev.id, "feedback_status": ev.feedback_status,
            "training_eligibility": ev.training_eligibility, "feedback_id": fb.id}


class EligibilityDecision(BaseModel):
    decision: Literal["approve", "reject"]
    notes: Optional[str] = Field(None, max_length=1000)


@router.post("/predictions/{prediction_id}/training-eligibility")
def decide_eligibility(
    prediction_id: str,
    payload: EligibilityDecision,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(LIFECYCLE_ROLES)),
):
    """Second-person validation of a reviewed label before it enters the curated dataset."""
    ev = _get_event(db, current_user, prediction_id)
    try:
        sample = decide_training_eligibility(db, ev, current_user, payload.decision == "approve", payload.notes)
    except AIHistoryError as exc:
        raise _err(exc)
    _audit(db, current_user, "AI_TRAINING_SAMPLE_" + payload.decision.upper(), "ai_prediction", ev.id,
           {"sample_id": sample.id if sample else None, "label": ev.ground_truth_label})
    return {"prediction_id": ev.id, "training_eligibility": ev.training_eligibility,
            "training_sample_id": sample.id if sample else None}


@router.get("/complaints/{complaint_ref}/predictions")
def complaint_predictions(
    complaint_ref: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(READ_ROLES)),
):
    rows = _scoped(db.query(AIPredictionEvent), current_user).filter(
        AIPredictionEvent.complaint_id == complaint_ref).order_by(AIPredictionEvent.created_at).all()
    return {"complaint_reference": complaint_ref, "items": [_event_row(r) for r in rows]}


# ---------------------------------------------------------------------------
# Model registry
# ---------------------------------------------------------------------------
@router.get("/models")
def list_models(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(READ_ROLES)),
):
    usage = dict(db.query(AIPredictionEvent.model_version_id, func.count())
                 .group_by(AIPredictionEvent.model_version_id).all())
    rows = db.query(AIModelVersion).order_by(AIModelVersion.model_key, AIModelVersion.first_seen_at.desc()).all()
    return {"items": [_model_row(r, usage.get(r.id, 0)) for r in rows], "runtime": runtime_status(),
            "model_keys": MODEL_KEYS, "environment": _environment()}


@router.get("/models/{model_version_id}/parameters")
def model_parameters(
    model_version_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(READ_ROLES)),
):
    mv = db.query(AIModelVersion).filter(AIModelVersion.id == model_version_id).first()
    if not mv:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Model version not found."})
    usage = db.query(AIPredictionEvent).filter(AIPredictionEvent.model_version_id == mv.id).count()
    return {**_model_row(mv, usage, full=True), "runtime": runtime_status().get(mv.model_key)}


@router.post("/models/sync")
def sync_models(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(LIFECYCLE_ROLES)),
):
    """Re-read model metadata from disk/config and recompute deployment status (no model is changed)."""
    result = sync_model_registry(db, verify_checksums=True)
    _audit(db, current_user, "AI_MODEL_REGISTRY_SYNC", "ai_model_registry", "all", result)
    return result


# ---------------------------------------------------------------------------
# Curated training samples & dataset versions
# ---------------------------------------------------------------------------
@router.get("/training-samples")
def list_training_samples(
    model_key: Optional[str] = None,
    status: Optional[str] = "APPROVED",
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(LIFECYCLE_ROLES)),
):
    q = db.query(AITrainingSample)
    if model_key:
        q = q.filter(AITrainingSample.model_key == model_key)
    if status:
        q = q.filter(AITrainingSample.status == status.upper())
    rows = q.order_by(AITrainingSample.approved_at.desc()).all()
    pending = db.query(AIPredictionEvent).filter(AIPredictionEvent.training_eligibility == "PENDING_VALIDATION").count()
    return {"items": [{"id": s.id, "prediction_id": s.prediction_id, "complaint_id": s.complaint_id,
                       "model_key": s.model_key, "label": s.label, "label_source": s.label_source,
                       "approved_by": s.approved_by_name or s.approved_by, "approved_at": _iso(s.approved_at),
                       "media_count": len(s.media_paths or []), "status": s.status} for s in rows],
            "pending_validation": pending}


@router.post("/training-samples/{sample_id}/revoke")
def revoke_training_sample(
    sample_id: str,
    payload: EligibilityDecision,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(LIFECYCLE_ROLES)),
):
    s = db.query(AITrainingSample).filter(AITrainingSample.id == sample_id).first()
    if not s or s.status != "APPROVED":
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Approved sample not found."})
    s.status = "REVOKED"
    s.notes = ((s.notes or "") + f"\nRevoked by {current_user.name}: {payload.notes or ''}").strip()
    ev = db.query(AIPredictionEvent).filter(AIPredictionEvent.id == s.prediction_id).first()
    if ev:
        ev.training_eligibility = "REJECTED"
        ev.training_eligibility_reason = f"Removed from curated dataset by {current_user.name}."
    db.commit()
    _audit(db, current_user, "AI_TRAINING_SAMPLE_REVOKE", "ai_training_sample", s.id, {"notes": payload.notes})
    return {"id": s.id, "status": s.status}


@router.get("/datasets")
def list_datasets(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(LIFECYCLE_ROLES)),
):
    rows = db.query(AIDatasetVersion).order_by(AIDatasetVersion.created_at.desc()).all()
    return {"items": [{"id": d.id, "model_key": d.model_key, "version": d.version, "fingerprint": d.fingerprint,
                       "sample_count": d.sample_count, "class_distribution": d.class_distribution,
                       "created_by": d.created_by_name or d.created_by, "created_at": _iso(d.created_at),
                       "notes": d.notes} for d in rows]}


class DatasetSnapshotRequest(BaseModel):
    model_key: str = "image_issue_classifier"
    notes: Optional[str] = Field(None, max_length=1000)


@router.post("/datasets")
def create_dataset(
    payload: DatasetSnapshotRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(LIFECYCLE_ROLES)),
):
    """Freeze the currently approved samples into an immutable dataset version. Does not start training."""
    try:
        ds = snapshot_dataset(db, payload.model_key, current_user, payload.notes)
    except AIHistoryError as exc:
        raise _err(exc)
    _audit(db, current_user, "AI_DATASET_SNAPSHOT", "ai_dataset", ds.id,
           {"version": ds.version, "samples": ds.sample_count, "fingerprint": ds.fingerprint})
    return {"id": ds.id, "version": ds.version, "fingerprint": ds.fingerprint, "sample_count": ds.sample_count,
            "class_distribution": ds.class_distribution}


@router.get("/datasets/{dataset_id}")
def get_dataset(
    dataset_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(LIFECYCLE_ROLES)),
):
    d = db.query(AIDatasetVersion).filter(AIDatasetVersion.id == dataset_id).first()
    if not d:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Dataset not found."})
    return {"id": d.id, "model_key": d.model_key, "version": d.version, "fingerprint": d.fingerprint,
            "sample_count": d.sample_count, "class_distribution": d.class_distribution, "manifest": d.manifest,
            "created_by": d.created_by_name or d.created_by, "created_at": _iso(d.created_at), "notes": d.notes}


# ---------------------------------------------------------------------------
# Training runs (reported by the training pipeline)
# ---------------------------------------------------------------------------
TRAINING_STATUSES = ("QUEUED", "RUNNING", "COMPLETED", "FAILED", "CANCELLED")
EVAL_STATUSES = ("NOT_EVALUATED", "AWAITING_REVIEW", "PASSED", "FAILED")
_TRANSITIONS = {"QUEUED": {"RUNNING", "CANCELLED", "FAILED"}, "RUNNING": {"COMPLETED", "FAILED", "CANCELLED"},
                "COMPLETED": set(), "FAILED": set(), "CANCELLED": set()}


class TrainingRunCreate(BaseModel):
    model_key: str = "image_issue_classifier"
    candidate_model_version: str = Field(..., min_length=1, max_length=100)
    previous_model_version: Optional[str] = Field(None, max_length=100)
    dataset_version_id: Optional[str] = None
    split_sizes: Optional[Dict[str, int]] = None
    training_config: Optional[Dict[str, Any]] = None
    training_status: Literal["QUEUED", "RUNNING"] = "QUEUED"
    started_at: Optional[datetime.datetime] = None
    environment: Literal["production", "staging", "demo"] = "production"
    notes: Optional[str] = Field(None, max_length=2000)


class TrainingRunUpdate(BaseModel):
    training_status: Optional[Literal["QUEUED", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"]] = None
    evaluation_status: Optional[Literal["NOT_EVALUATED", "AWAITING_REVIEW", "PASSED", "FAILED"]] = None
    deployment_status: Optional[Literal["NOT_DEPLOYED", "STAGING"]] = None
    started_at: Optional[datetime.datetime] = None
    completed_at: Optional[datetime.datetime] = None
    split_sizes: Optional[Dict[str, int]] = None
    training_config: Optional[Dict[str, Any]] = None
    evaluation: Optional[Dict[str, Any]] = None
    comparison: Optional[Dict[str, Any]] = None
    notes: Optional[str] = Field(None, max_length=2000)

    @model_validator(mode="after")
    def _check(self):
        if self.comparison is not None:
            prev, cand = self.comparison.get("previous"), self.comparison.get("candidate")
            if not isinstance(prev, dict) or not isinstance(cand, dict):
                raise ValueError("comparison must contain 'previous' and 'candidate' metric objects")
            if not self.comparison.get("evaluation_dataset"):
                raise ValueError("comparison.evaluation_dataset is required (both models must use the same set)")
        return self


@router.get("/training-runs")
def list_training_runs(
    model_key: Optional[str] = None,
    training_status: Optional[str] = None,
    include_demo: bool = True,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(READ_ROLES)),
):
    q = db.query(AITrainingRun)
    if model_key:
        q = q.filter(AITrainingRun.model_key == model_key)
    if training_status:
        q = q.filter(AITrainingRun.training_status == training_status.upper())
    if not include_demo:
        q = q.filter(AITrainingRun.is_demo == False)  # noqa: E712
    total = q.count()
    rows = q.order_by(AITrainingRun.queued_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    approved_samples = db.query(AITrainingSample).filter(AITrainingSample.status == "APPROVED").count()
    return {"items": [_run_row(r) for r in rows], "total": total, "page": page, "page_size": page_size,
            "pipeline": {"runs_reported": total, "approved_training_samples": approved_samples,
                         "dataset_versions": db.query(AIDatasetVersion).count(),
                         "message": None if total else "No training runs have been reported. NagarNetra does not "
                                                       "include a fine-tuning pipeline yet, and complaint submission "
                                                       "never triggers retraining."},
            "environment": _environment()}


@router.get("/training-runs/{run_id}")
def get_training_run(
    run_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(READ_ROLES)),
):
    r = db.query(AITrainingRun).filter(AITrainingRun.id == run_id).first()
    if not r:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Training run not found."})
    return {**_run_row(r, full=True), "environment": _environment()}


@router.post("/training-runs", status_code=201)
def report_training_run(
    payload: TrainingRunCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(LIFECYCLE_ROLES)),
):
    """Register a training job started by the (external) training pipeline."""
    if payload.model_key not in MODEL_KEYS:
        raise HTTPException(status_code=400, detail={"code": "UNKNOWN_MODEL", "message": "Unknown model_key."})
    active = active_model_version(db, payload.model_key)
    if active is not None and not active.trainable:
        raise HTTPException(status_code=400, detail={"code": "NOT_TRAINABLE",
                                                     "message": f"{active.name} is not a trainable model."})
    if payload.candidate_model_version == (payload.previous_model_version or (active.version if active else None)):
        raise HTTPException(status_code=400, detail={"code": "SAME_VERSION",
                                                     "message": "Candidate version must differ from the previous version."})
    ds = None
    if payload.dataset_version_id:
        ds = db.query(AIDatasetVersion).filter(AIDatasetVersion.id == payload.dataset_version_id).first()
        if not ds or ds.model_key != payload.model_key:
            raise HTTPException(status_code=400, detail={"code": "UNKNOWN_DATASET", "message": "Dataset version not found for this model."})
    if payload.split_sizes and ds and sum(payload.split_sizes.values()) > ds.sample_count:
        raise HTTPException(status_code=400, detail={"code": "SPLIT_EXCEEDS_DATASET",
                                                     "message": "Split sizes exceed the dataset sample count."})
    prev_version = payload.previous_model_version or (active.version if active else None)
    prev = find_model_version(db, payload.model_key, prev_version)
    count = db.query(AITrainingRun).count() + 1
    run = AITrainingRun(
        id=f"tr_{datetime.datetime.utcnow():%Y%m%d}_{count:04d}",
        model_key=payload.model_key, model_name=(active.name if active else payload.model_key),
        previous_model_version_id=prev.id if prev else None, previous_model_version=prev_version,
        candidate_model_version=payload.candidate_model_version,
        dataset_version_id=ds.id if ds else None, dataset_version=ds.version if ds else None,
        dataset_fingerprint=ds.fingerprint if ds else None, training_samples=ds.sample_count if ds else None,
        class_distribution=ds.class_distribution if ds else None,
        reviewed_samples=ds.sample_count if ds else None,
        split_sizes=payload.split_sizes, training_config=payload.training_config,
        training_status=payload.training_status,
        started_at=payload.started_at or (datetime.datetime.utcnow() if payload.training_status == "RUNNING" else None),
        environment=payload.environment, is_demo=payload.environment == "demo", reported_by=current_user.id,
        notes=payload.notes)
    db.add(run)
    db.commit()
    _audit(db, current_user, "AI_TRAINING_RUN_REPORTED", "ai_training_run", run.id,
           {"candidate": run.candidate_model_version, "dataset": run.dataset_version})
    return _run_row(run, full=True)


@router.patch("/training-runs/{run_id}")
def update_training_run(
    run_id: str,
    payload: TrainingRunUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(LIFECYCLE_ROLES)),
):
    r = db.query(AITrainingRun).filter(AITrainingRun.id == run_id).first()
    if not r:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Training run not found."})
    if payload.training_status and payload.training_status != r.training_status:
        if payload.training_status not in _TRANSITIONS[r.training_status]:
            raise HTTPException(status_code=409, detail={"code": "INVALID_TRANSITION",
                                                         "message": f"{r.training_status} -> {payload.training_status} is not allowed."})
        r.training_status = payload.training_status
        if payload.training_status == "RUNNING" and not r.started_at:
            r.started_at = payload.started_at or datetime.datetime.utcnow()
        if payload.training_status in ("COMPLETED", "FAILED", "CANCELLED"):
            r.completed_at = payload.completed_at or datetime.datetime.utcnow()
    if payload.started_at:
        r.started_at = payload.started_at
    if payload.completed_at and r.training_status in ("COMPLETED", "FAILED", "CANCELLED"):
        r.completed_at = payload.completed_at
    if r.started_at and r.completed_at and r.completed_at < r.started_at:
        raise HTTPException(status_code=400, detail={"code": "INVALID_TIMES", "message": "completed_at is before started_at."})
    if (payload.evaluation is not None or payload.comparison is not None or
            (payload.evaluation_status and payload.evaluation_status != "NOT_EVALUATED")) and r.training_status != "COMPLETED":
        raise HTTPException(status_code=409, detail={"code": "NOT_TRAINED",
                                                     "message": "Evaluation can only be reported for a completed training run."})
    if payload.evaluation_status in ("PASSED", "FAILED", "AWAITING_REVIEW") and not (payload.evaluation or r.evaluation):
        raise HTTPException(status_code=400, detail={"code": "METRICS_REQUIRED",
                                                     "message": "Report evaluation metrics before setting an evaluation result."})
    for field in ("split_sizes", "training_config", "evaluation", "comparison", "notes"):
        value = getattr(payload, field)
        if value is not None:
            setattr(r, field, value)
    if payload.evaluation_status:
        r.evaluation_status = payload.evaluation_status
    if payload.deployment_status:
        if r.deployment_status in ("ACTIVE", "ROLLED_BACK"):
            raise HTTPException(status_code=409, detail={"code": "RUNTIME_MANAGED",
                                                         "message": "Deployment state is now tracked from the running backend."})
        if payload.deployment_status == "STAGING" and r.approval_status != "APPROVED":
            raise HTTPException(status_code=409, detail={"code": "NOT_APPROVED",
                                                         "message": "Only an approved candidate can be staged."})
        r.deployment_status = payload.deployment_status
    db.commit()
    return _run_row(r, full=True)


class PromotionDecision(BaseModel):
    decision: Literal["approve", "reject"]
    notes: Optional[str] = Field(None, max_length=1000)


@router.post("/training-runs/{run_id}/approval")
def decide_promotion(
    run_id: str,
    payload: PromotionDecision,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(LIFECYCLE_ROLES)),
):
    """Approve/reject a candidate for deployment. Approval does not deploy anything."""
    r = db.query(AITrainingRun).filter(AITrainingRun.id == run_id).first()
    if not r:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Training run not found."})
    if r.is_demo:
        raise HTTPException(status_code=409, detail={"code": "DEMO_RUN", "message": "Demo runs cannot be promoted."})
    if r.approval_status != "PENDING":
        raise HTTPException(status_code=409, detail={"code": "ALREADY_DECIDED", "message": f"Already {r.approval_status}."})
    if payload.decision == "approve":
        if r.training_status != "COMPLETED" or r.evaluation_status != "PASSED":
            raise HTTPException(status_code=409, detail={"code": "NOT_READY",
                                                         "message": "Only a completed run whose evaluation PASSED can be approved."})
        if not r.comparison:
            raise HTTPException(status_code=409, detail={"code": "NO_COMPARISON",
                                                         "message": "A previous-vs-candidate comparison on the same evaluation set is required."})
    r.approval_status = "APPROVED" if payload.decision == "approve" else "REJECTED"
    r.approved_by, r.approved_by_name = current_user.id, current_user.name
    r.approved_at = datetime.datetime.utcnow()
    r.approval_notes = payload.notes
    db.commit()
    _audit(db, current_user, "AI_MODEL_PROMOTION_" + r.approval_status, "ai_training_run", r.id,
           {"candidate": r.candidate_model_version, "notes": payload.notes})
    return _run_row(r, full=True)
