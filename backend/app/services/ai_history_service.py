"""
Prediction history for the admin "AI Model History" module.

Flow (see models/ai_history.py):
  complaint submission -> existing AI pipeline (keyword rules + image classifier) -> complaint saved
  -> record_submission_predictions() writes one event per model that ran, linked to the complaint
  -> admins review (ACCEPTED / CORRECTED / DISPUTED)
  -> a DIFFERENT admin approves the reviewed example for training -> curated sample
  -> snapshot_dataset() freezes approved samples into a dataset version for a training pipeline.

Prediction logging never triggers retraining, and feedback never becomes training data by itself.
Logging failures never block complaint submission.
"""
import datetime
import hashlib
import json
import logging
import uuid
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from backend.app.models.ai_history import (
    AIDatasetVersion, AIModelVersion, AIPredictionEvent, AIPredictionFeedback, AITrainingSample,
    SchemaMigration,
)
from backend.app.models.models import Attachment, Category, Complaint, ComplaintEvent, Department
from backend.app.services.ai_model_registry_service import (
    IMAGE_MODEL_KEY, KEYWORD_ROUTING_THRESHOLD, TEXT_MODEL_KEY, active_model_version,
    find_model_version, keyword_rules_version,
)

logger = logging.getLogger("nagarnetra.ai_history")

ROUTING_DECISIONS = ("AI_SUGGESTED", "HUMAN_REVIEW_REQUIRED", "MANUAL_SELECTION", "PREDICTION_FAILED")
FEEDBACK_STATES = ("NOT_REVIEWED", "ACCEPTED", "CORRECTED", "DISPUTED")
INPUT_TYPES = ("IMAGE", "TEXT", "VOICE", "COMBINED")


class AIHistoryError(ValueError):
    def __init__(self, code: str, message: str, status_code: int = 400):
        super().__init__(message)
        self.code, self.message, self.status_code = code, message, status_code


def _new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:20]}"


def _category_info(db: Session, corporation_id: str, category_id: Optional[str]) -> Dict[str, Optional[str]]:
    if not category_id:
        return {"name": None, "department_id": None, "department_name": None}
    row = (db.query(Category, Department).outerjoin(Department, Department.id == Category.department_id)
           .filter(Category.id == category_id, Category.corporation_id == corporation_id).first())
    if not row:
        return {"name": None, "department_id": None, "department_name": None}
    cat, dept = row
    return {"name": cat.name, "department_id": dept.id if dept else None,
            "department_name": dept.name if dept else None}


# ---------------------------------------------------------------------------
# Routing decision (how the complaint's category was decided relative to a prediction)
# ---------------------------------------------------------------------------
def keyword_routing_decision(confidence: float, predicted_category: Optional[str], final_category: str,
                             initial_status: str, citizen_confirmed: bool, text_source: str):
    if initial_status == "TO_CHECK" and confidence < KEYWORD_ROUTING_THRESHOLD and not citizen_confirmed:
        return "HUMAN_REVIEW_REQUIRED", (f"Keyword score {confidence:.2f} < {KEYWORD_ROUTING_THRESHOLD:.2f} and the "
                                         f"citizen did not confirm the category: sent to TO_CHECK.")
    if confidence >= KEYWORD_ROUTING_THRESHOLD and predicted_category == final_category:
        reason = f"Keyword score {confidence:.2f} met the routing threshold and matches the filed category."
        if text_source == "category_name_fallback":
            reason += " Note: no citizen text was given, so the rules scored the chosen category's own name."
        return "AI_SUGGESTED", reason
    if initial_status == "TO_CHECK":
        return "HUMAN_REVIEW_REQUIRED", "Complaint entered TO_CHECK (no routing rule or 'other' category)."
    return "MANUAL_SELECTION", (f"Category confirmed by the citizen/operator; keyword score {confidence:.2f} "
                                f"{'below' if confidence < KEYWORD_ROUTING_THRESHOLD else 'met'} the threshold"
                                f"{'' if predicted_category == final_category else ' and suggested a different category'}.")


def image_routing_decision(status: str, recommended_code: Optional[str], predicted_category: Optional[str],
                           final_category: str, accepted_code: Optional[str], initial_status: str):
    if status in ("unavailable", "failed"):
        return "PREDICTION_FAILED", "Image classifier unavailable or failed; category chosen without image AI."
    if status != "success":
        if initial_status == "TO_CHECK":
            return "HUMAN_REVIEW_REQUIRED", f"Image AI returned '{status}'; complaint entered TO_CHECK."
        return "MANUAL_SELECTION", f"Image AI returned '{status}' (no suggestion); category chosen manually."
    if accepted_code and accepted_code == recommended_code and predicted_category == final_category:
        return "AI_SUGGESTED", "Citizen accepted the image AI suggestion; it matches the filed category."
    if initial_status == "TO_CHECK":
        return "HUMAN_REVIEW_REQUIRED", "Complaint entered TO_CHECK for human verification."
    return "MANUAL_SELECTION", "Citizen chose a category instead of the image AI suggestion."


# ---------------------------------------------------------------------------
# Live logging (called from routers/complaints.py after the complaint is committed)
# ---------------------------------------------------------------------------
def record_submission_predictions(
    db: Session,
    complaint: Complaint,
    keyword_result: Optional[Dict[str, Any]],
    keyword_trace: Optional[Dict[str, Any]],
    image_trace: Optional[Dict[str, Any]],
    citizen_confirmed: bool,
    accepted_issue_code: Optional[str],
    voice_note=None,
) -> List[str]:
    """Write prediction events for a just-created complaint. Never raises."""
    try:
        ids = _record(db, complaint, keyword_result, keyword_trace or {}, image_trace, citizen_confirmed,
                      accepted_issue_code, voice_note)
        db.commit()
        return ids
    except Exception as exc:  # noqa: BLE001 - logging must not break complaint submission
        db.rollback()
        logger.exception("Could not record AI prediction events for %s: %s", complaint.id, exc)
        return []


def _record(db, complaint, keyword_result, keyword_trace, image_trace, citizen_confirmed, accepted_code,
            voice_note) -> List[str]:
    ids = []
    corp = complaint.corporation_id
    initial_status = complaint.status
    voice_meta = None
    if voice_note is not None:
        voice_meta = {"voice_note_id": voice_note.id, "language": voice_note.language,
                      "duration_seconds": voice_note.duration_seconds,
                      "transcription_status": voice_note.transcription_status,
                      "transcription_model": voice_note.transcription_provider,
                      "transcript_edited_by_citizen": bool(voice_note.transcript_final and voice_note.transcript_original
                                                           and voice_note.transcript_final != voice_note.transcript_original)}

    # 1) Keyword rules (drives routing)
    if keyword_result:
        text_source = keyword_trace.get("text_source", "unknown")
        has_image = bool(keyword_trace.get("has_image"))
        if text_source == "voice_transcript":
            input_type = "COMBINED" if has_image else "VOICE"
        else:
            input_type = "COMBINED" if has_image else "TEXT"
        version = keyword_rules_version()
        mv = find_model_version(db, TEXT_MODEL_KEY, version)
        predicted = keyword_result.get("best_guess")
        conf = float(keyword_result.get("confidence") or 0.0)
        info = _category_info(db, corp, predicted)
        decision, reason = keyword_routing_decision(conf, predicted, complaint.category_id, initial_status,
                                                    citizen_confirmed, text_source)
        top = [{"rank": i + 1, "label": t.get("category_id"), "name": _category_info(db, corp, t.get("category_id"))["name"],
                "score": t.get("confidence")} for i, t in enumerate(keyword_result.get("top_3") or [])]
        ev = AIPredictionEvent(
            id=_new_id("pred"), corporation_id=corp, complaint_id=complaint.id,
            model_version_id=mv.id if mv else None, model_key=TEXT_MODEL_KEY,
            model_name=mv.name if mv else "Keyword rule classifier (routing score)", model_version=version,
            model_provider="keyword_rules", task="text_classification", input_type=input_type,
            input_summary={"text_source": text_source, "text_chars": keyword_trace.get("text_chars"),
                           "has_image_flag": has_image, "voice": voice_meta if text_source == "voice_transcript" else None},
            status="SUCCESS" if conf >= KEYWORD_ROUTING_THRESHOLD else "LOW_CONFIDENCE",
            predicted_label=predicted, predicted_label_name=info["name"], predicted_category_id=predicted,
            predicted_category_name=info["name"], predicted_department_id=info["department_id"],
            predicted_department_name=info["department_name"], confidence=round(conf, 4), top_predictions=top,
            routing_decision=decision, routing_reason=reason, final_category_id=complaint.category_id,
            inference_params={"confidence_threshold": KEYWORD_ROUTING_THRESHOLD,
                              "fusion": "0.6 x image_score + 0.4 x text_score",
                              "image_score_source": "heuristic constant (photo flag), not a vision model",
                              "redirect": keyword_result.get("redirect_target")},
            latency_ms=keyword_trace.get("latency_ms"), origin="LIVE", is_demo=False,
            training_eligibility="NOT_ELIGIBLE",
            training_eligibility_reason="Rule-based classifier: not trainable.",
            created_at=complaint.created_at,
        )
        db.add(ev)
        ids.append(ev.id)

    # 2) Image classifier (server re-run on the stored photos)
    if image_trace:
        ids.append(_add_image_event(db, complaint, image_trace, accepted_code, initial_status,
                                    origin="LIVE", is_demo=False, created_at=complaint.created_at))
    return ids


def _add_image_event(db, complaint, trace, accepted_code, initial_status, origin, is_demo, created_at,
                     note: Optional[str] = None) -> str:
    corp = complaint.corporation_id
    status = (trace.get("status") or "failed").lower()
    model = trace.get("model") or {}
    version = model.get("version")
    mv = find_model_version(db, IMAGE_MODEL_KEY, version) if version else None
    if mv is None and status in ("unavailable", "failed") and origin == "LIVE":
        mv = active_model_version(db, IMAGE_MODEL_KEY)  # the version the runtime was configured to serve
    preds = trace.get("predictions") or []
    top = preds[0] if preds else {}
    predicted_cat = top.get("category_id")
    info = _category_info(db, corp, predicted_cat)
    decision, reason = image_routing_decision(status, trace.get("recommended_issue_code"), predicted_cat,
                                              complaint.category_id, accepted_code, initial_status)
    if note:
        reason = f"{reason} {note}"
    status_map = {"success": "SUCCESS", "low_confidence": "LOW_CONFIDENCE", "no_civic_issue": "NO_CIVIC_ISSUE",
                  "no_prediction": "NO_PREDICTION"}
    images = trace.get("images") or []
    analyzed = sum(1 for i in images if i.get("status") == "analyzed") if images else None
    has_photos = bool(complaint.attachments) or bool(images)
    params = {}
    if trace.get("inference_spec"):
        params.update(trace["inference_spec"])
    if trace.get("thresholds"):
        params["confidence_thresholds"] = trace["thresholds"]
    if trace.get("aggregation"):
        params["aggregation"] = trace["aggregation"]
    if model.get("taxonomy_version"):
        params["taxonomy_version"] = model["taxonomy_version"]
    if trace.get("total_ms") is not None:
        params["end_to_end_ms"] = trace["total_ms"]

    eligible = status not in ("unavailable", "failed") and has_photos and (mv is None or mv.trainable)
    ev = AIPredictionEvent(
        id=_new_id("pred"), corporation_id=corp, complaint_id=complaint.id,
        model_version_id=mv.id if mv else None, model_key=IMAGE_MODEL_KEY,
        model_name=mv.name if mv else "Civic issue image classifier",
        model_version=version or (mv.version if mv else "unknown"),
        model_provider=model.get("provider") or (mv.provider if mv else None),
        task="image_classification", input_type="IMAGE",
        input_summary={"images_received": len(images) if images else None, "images_analyzed": analyzed,
                       "per_image": [{k: i.get(k) for k in ("index", "status", "top_issue_code", "top_confidence", "error_code")}
                                     for i in images] or None},
        status=status_map.get(status, "FAILED"),
        predicted_label=top.get("issue_code"), predicted_label_name=top.get("issue_name"),
        predicted_category_id=predicted_cat, predicted_category_name=info["name"] or top.get("category_name"),
        predicted_department_id=info["department_id"],
        predicted_department_name=info["department_name"] or top.get("department_name"),
        confidence=float(top["confidence"]) if top.get("confidence") is not None else None,
        top_predictions=[{"rank": p.get("rank"), "label": p.get("issue_code"), "name": p.get("issue_name"),
                          "score": p.get("confidence"), "band": p.get("confidence_band"),
                          "category_id": p.get("category_id"), "department": p.get("department_name")} for p in preds],
        routing_decision=decision, routing_reason=reason, final_category_id=complaint.category_id,
        inference_params=params or None, latency_ms=trace.get("inference_ms"),
        error_message=(trace.get("error") or None) and str(trace.get("error"))[:250],
        origin=origin, is_demo=is_demo,
        training_eligibility="NEEDS_REVIEW" if eligible else "NOT_ELIGIBLE",
        training_eligibility_reason=None if eligible else (
            "Prediction failed." if status in ("unavailable", "failed") else "No stored complaint photos."),
        created_at=created_at,
    )
    db.add(ev)
    return ev.id


# ---------------------------------------------------------------------------
# Migration + backfill (idempotent)
# ---------------------------------------------------------------------------
MIGRATION_ID = "2026_10_09_ai_model_history"


def run_migrations(engine, db: Session) -> None:
    """Create the AI history tables (new tables only) and backfill events from complaints.ai_scores."""
    from backend.app.database import Base
    from backend.app.models import ai_history  # noqa: F401 - registers tables

    tables = [t for name, t in Base.metadata.tables.items() if name.startswith("ai_") or name == "schema_migrations"]
    Base.metadata.create_all(bind=engine, tables=tables)
    if db.query(SchemaMigration).filter(SchemaMigration.id == MIGRATION_ID).first():
        return
    created = backfill_from_complaints(db)
    db.add(SchemaMigration(id=MIGRATION_ID, notes=f"Created AI history tables; backfilled {created} prediction events "
                                                  f"from complaints.ai_scores."))
    db.commit()
    logger.info("Applied migration %s (%d backfilled events)", MIGRATION_ID, created)


def backfill_from_complaints(db: Session) -> int:
    """Reconstruct events for complaints submitted before logging existed. Clearly marked BACKFILL."""
    count = 0
    logged = {cid for (cid,) in db.query(AIPredictionEvent.complaint_id).distinct()}
    for c in db.query(Complaint).filter(Complaint.ai_scores.isnot(None)).all():
        if c.id in logged or not isinstance(c.ai_scores, dict):
            continue
        scores = c.ai_scores
        first = (db.query(ComplaintEvent).filter(ComplaintEvent.complaint_id == c.id,
                                                 ComplaintEvent.action == "COMPLAINT_SUBMITTED")
                 .order_by(ComplaintEvent.created_at.asc()).first())
        initial_status = first.to_status if first and first.to_status else c.status
        note = "Backfilled from complaint.ai_scores; inference parameters and latency were not recorded at the time."
        if "best_guess" in scores:
            conf = float(scores.get("confidence") or 0.0)
            predicted = scores.get("best_guess")
            info = _category_info(db, c.corporation_id, predicted)
            decision, reason = keyword_routing_decision(conf, predicted, c.category_id, initial_status,
                                                        initial_status != "TO_CHECK", "unknown")
            db.add(AIPredictionEvent(
                id=_new_id("pred"), corporation_id=c.corporation_id, complaint_id=c.id, model_version_id=None,
                model_key=TEXT_MODEL_KEY, model_name="Keyword rule classifier (routing score)",
                model_version="unrecorded (pre-logging)", model_provider="keyword_rules",
                task="text_classification",
                input_type="VOICE" if (c.audio_transcript and not c.description) else "TEXT",
                input_summary={"text_source": "unknown (not recorded)"},
                status="SUCCESS" if conf >= KEYWORD_ROUTING_THRESHOLD else "LOW_CONFIDENCE",
                predicted_label=predicted, predicted_label_name=info["name"], predicted_category_id=predicted,
                predicted_category_name=info["name"], predicted_department_id=info["department_id"],
                predicted_department_name=info["department_name"], confidence=round(conf, 4),
                top_predictions=[{"rank": i + 1, "label": t.get("category_id"), "score": t.get("confidence")}
                                 for i, t in enumerate(scores.get("top_3") or [])],
                routing_decision=decision, routing_reason=f"{reason} {note}", final_category_id=c.category_id,
                inference_params=None, latency_ms=None, origin="BACKFILL", is_demo=False,
                training_eligibility="NOT_ELIGIBLE", training_eligibility_reason="Rule-based classifier: not trainable.",
                created_at=c.created_at))
            count += 1
        image = scores.get("image_classification")
        if isinstance(image, dict):
            seed = image.get("source") == "seed_sample"
            trace = {"status": image.get("status"), "model": image.get("model") or {},
                     "recommended_issue_code": image.get("recommended_issue_code"),
                     "predictions": image.get("predictions") or [], "error": image.get("error")}
            if seed:
                trace["model"] = {"provider": None, "version": "seed sample (no model run)"}
            _add_image_event(db, c, trace, scores.get("citizen_accepted_issue_code"), initial_status,
                             origin="SEED_SAMPLE" if seed else "BACKFILL", is_demo=seed, created_at=c.created_at,
                             note="Demo seed data: these scores were written by the seed script, not produced by a model."
                             if seed else note)
            count += 1
    # Seed-sample events must never be used for training
    db.flush()
    for ev in db.query(AIPredictionEvent).filter(AIPredictionEvent.is_demo == True).all():  # noqa: E712
        ev.training_eligibility = "NOT_ELIGIBLE"
        ev.training_eligibility_reason = "Demo seed record."
    db.commit()
    return count


# ---------------------------------------------------------------------------
# Feedback and training-sample validation
# ---------------------------------------------------------------------------
def allowed_labels(db: Session, ev: AIPredictionEvent) -> Optional[List[str]]:
    mv = db.query(AIModelVersion).filter(AIModelVersion.id == ev.model_version_id).first() if ev.model_version_id else None
    if mv is None:
        mv = active_model_version(db, ev.model_key)
    if mv and mv.output_classes:
        return [c["code"] for c in mv.output_classes if c.get("code")]
    return None


def record_feedback(db: Session, ev: AIPredictionEvent, reviewer, review_status: str,
                    corrected_label: Optional[str], notes: Optional[str]) -> AIPredictionFeedback:
    if ev.is_demo:
        raise AIHistoryError("DEMO_RECORD", "Demo seed records cannot be reviewed.")
    if ev.status == "FAILED":
        raise AIHistoryError("NO_PREDICTION", "There is no prediction to review on a failed inference.")
    if ev.training_eligibility == "APPROVED":
        raise AIHistoryError("ALREADY_IN_DATASET",
                             "This example is already in the curated dataset; revoke it before changing the label.", 409)
    review_status = review_status.upper()
    if review_status not in ("ACCEPTED", "CORRECTED", "DISPUTED"):
        raise AIHistoryError("INVALID_STATUS", "review_status must be ACCEPTED, CORRECTED or DISPUTED.")
    label_name = None
    if review_status == "CORRECTED":
        if not corrected_label:
            raise AIHistoryError("LABEL_REQUIRED", "A corrected label is required.")
        labels = allowed_labels(db, ev)
        if labels is not None and corrected_label not in labels:
            raise AIHistoryError("INVALID_LABEL", f"'{corrected_label}' is not an output class of this model.")
        if corrected_label == ev.predicted_label:
            raise AIHistoryError("SAME_LABEL", "The corrected label equals the prediction; use ACCEPTED instead.")
        mv = db.query(AIModelVersion).filter(AIModelVersion.id == ev.model_version_id).first() if ev.model_version_id else None
        for c in ((mv.output_classes if mv else None) or []):
            if c.get("code") == corrected_label:
                label_name = c.get("name")
    else:
        corrected_label = None

    fb = AIPredictionFeedback(
        prediction_id=ev.id, review_status=review_status, original_label=ev.predicted_label,
        corrected_label=corrected_label, corrected_label_name=label_name, notes=(notes or "").strip() or None,
        reviewer_id=reviewer.id, reviewer_name=reviewer.name, reviewer_role=reviewer.role)
    db.add(fb)
    ev.feedback_status = review_status
    ev.ground_truth_label = corrected_label if review_status == "CORRECTED" else (
        ev.predicted_label if review_status == "ACCEPTED" else None)
    if ev.training_eligibility in ("NEEDS_REVIEW", "PENDING_VALIDATION", "REJECTED"):
        if review_status == "DISPUTED":
            ev.training_eligibility = "NEEDS_REVIEW"
            ev.training_eligibility_reason = "Label disputed: needs a decisive review before it can be used."
        else:
            ev.training_eligibility = "PENDING_VALIDATION"
            ev.training_eligibility_reason = "Reviewed label awaits approval by a second administrator."
    db.commit()
    db.refresh(fb)
    return fb


def decide_training_eligibility(db: Session, ev: AIPredictionEvent, approver, approve: bool,
                                notes: Optional[str]) -> Optional[AITrainingSample]:
    if ev.training_eligibility != "PENDING_VALIDATION":
        raise AIHistoryError("NOT_PENDING", f"Example is '{ev.training_eligibility}', not awaiting validation.", 409)
    latest = ev.feedback[0] if ev.feedback else None
    if latest is None or latest.review_status not in ("ACCEPTED", "CORRECTED") or not ev.ground_truth_label:
        raise AIHistoryError("NO_REVIEWED_LABEL", "No accepted or corrected label to validate.", 409)
    if latest.reviewer_id == approver.id:
        raise AIHistoryError("SAME_REVIEWER",
                             "The reviewer who labelled this example cannot also approve it (two-person rule).", 403)
    if not approve:
        ev.training_eligibility = "REJECTED"
        ev.training_eligibility_reason = f"Rejected by {approver.name}" + (f": {notes}" if notes else "")
        db.commit()
        return None
    media = [a.file_path for a in db.query(Attachment).filter(
        Attachment.complaint_id == ev.complaint_id, Attachment.attachment_type == "before").all()]
    if not media:
        raise AIHistoryError("NO_MEDIA", "The complaint has no stored photos to train on.", 409)
    sample = AITrainingSample(
        id=_new_id("ts"), prediction_id=ev.id, complaint_id=ev.complaint_id, model_key=ev.model_key,
        label=ev.ground_truth_label,
        label_source="REVIEWER_CORRECTION" if latest.review_status == "CORRECTED" else "CONFIRMED_PREDICTION",
        feedback_id=latest.id, labelled_by=latest.reviewer_id, approved_by=approver.id,
        approved_by_name=approver.name, media_paths=media, status="APPROVED", notes=(notes or None))
    db.add(sample)
    ev.training_eligibility = "APPROVED"
    ev.training_eligibility_reason = f"Approved for the curated dataset by {approver.name}."
    db.commit()
    db.refresh(sample)
    return sample


def snapshot_dataset(db: Session, model_key: str, creator, notes: Optional[str]) -> AIDatasetVersion:
    samples = (db.query(AITrainingSample)
               .filter(AITrainingSample.model_key == model_key, AITrainingSample.status == "APPROVED")
               .order_by(AITrainingSample.id).all())
    if not samples:
        raise AIHistoryError("NO_SAMPLES", "There are no approved samples to snapshot.", 409)
    manifest = [{"sample_id": s.id, "prediction_id": s.prediction_id, "complaint_id": s.complaint_id,
                 "label": s.label, "label_source": s.label_source, "media_paths": s.media_paths or []}
                for s in samples]
    fingerprint = hashlib.sha256(json.dumps(manifest, sort_keys=True).encode("utf-8")).hexdigest()
    existing = db.query(AIDatasetVersion).filter(AIDatasetVersion.fingerprint == fingerprint,
                                                 AIDatasetVersion.model_key == model_key).first()
    if existing:
        raise AIHistoryError("UNCHANGED", f"Identical to dataset {existing.version}; nothing new to snapshot.", 409)
    distribution: Dict[str, int] = {}
    for s in samples:
        distribution[s.label] = distribution.get(s.label, 0) + 1
    n = db.query(AIDatasetVersion).filter(AIDatasetVersion.model_key == model_key).count() + 1
    version = f"{model_key}-ds-{datetime.datetime.utcnow():%Y%m%d}-{n:03d}"
    ds = AIDatasetVersion(id=_new_id("ds"), model_key=model_key, version=version, fingerprint=fingerprint,
                          sample_count=len(samples), class_distribution=distribution, manifest=manifest,
                          created_by=creator.id, created_by_name=creator.name, notes=notes)
    db.add(ds)
    db.commit()
    db.refresh(ds)
    return ds
