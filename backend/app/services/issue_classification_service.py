"""
Orchestrates image-based civic issue classification:

  uploaded photos --validate/decode--> ML classifier (per-photo probabilities)
                  --aggregate--> issue distribution --top-k + confidence policy-->
                  --issue_mapping_rules + category master (DB)--> category / department / SLA

Model inference, mapping and SLA logic stay in their own modules; this service only wires them.
"""
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Sequence

import numpy as np
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.ml.aggregation import AGGREGATION_METHOD, aggregate_probabilities
from backend.app.ml.base import CivicIssueClassifier, InferenceError
from backend.app.ml.preprocessing import DecodedImage, ImageValidationError, decode_image
from backend.app.models.models import Category, Department, Setting
from backend.app.rules.issue_mapping_rules import (
    BAND_INSUFFICIENT, CivicIssueTaxonomy, ConfidenceThresholds, build_issue_mapping,
    confidence_band, load_taxonomy, resolve_category_record,
)

DEFAULT_ROUTING_THRESHOLD = 0.70  # fallback when the corporation has no ai_confidence_threshold setting

MESSAGES = {
    "success": "Civic issue identified from the photo(s).",
    "low_confidence": "AI could not confidently identify the civic issue. Please select a category manually.",
    "no_civic_issue": "AI could not find a civic issue in the photo(s). Please select a category manually.",
    "no_prediction": "AI could not identify the civic issue. Please select a category manually.",
}


@dataclass
class UploadedImage:
    filename: Optional[str]
    data: bytes


@dataclass
class ComplaintContext:
    """Optional non-image signals. Accepted now so the API is ready for multimodal models."""
    description: Optional[str] = None
    voice_transcript: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    def received(self) -> Dict[str, bool]:
        return {
            "description": bool(self.description and self.description.strip()),
            "voice_transcript": bool(self.voice_transcript and self.voice_transcript.strip()),
            "location": self.latitude is not None and self.longitude is not None,
        }


class AllImagesRejectedError(ValueError):
    def __init__(self, rejected: List[Dict[str, Any]]):
        first = rejected[0]
        super().__init__(first["error_message"])
        self.code = first["error_code"]
        self.message = first["error_message"]
        self.rejected = rejected


def configured_thresholds() -> ConfidenceThresholds:
    return ConfidenceThresholds(
        strong=settings.AI_CONFIDENCE_STRONG,
        suggestion=settings.AI_CONFIDENCE_SUGGESTION,
        minimum=settings.AI_CONFIDENCE_MIN,
    )


def decode_uploads(uploads: Sequence[UploadedImage]):
    """Validate every upload. Returns (decoded images with original index, per-image report rows)."""
    allowed = settings.AI_ALLOWED_IMAGE_FORMATS.split(",")
    decoded: List[tuple] = []
    report: List[Dict[str, Any]] = []
    for idx, upload in enumerate(uploads):
        row: Dict[str, Any] = {"index": idx, "filename": upload.filename, "status": "analyzed",
                               "error_code": None, "error_message": None,
                               "top_issue_code": None, "top_confidence": None}
        try:
            img: DecodedImage = decode_image(
                upload.data, allowed, settings.AI_MAX_IMAGE_BYTES, settings.AI_MAX_IMAGE_PIXELS)
            decoded.append((idx, img.image))
        except ImageValidationError as exc:
            row.update(status="rejected", error_code=exc.code, error_message=exc.message)
        report.append(row)
    if not decoded:
        raise AllImagesRejectedError([r for r in report if r["status"] == "rejected"])
    return decoded, report


def run_inference(classifier: CivicIssueClassifier, decoded: List[tuple]) -> np.ndarray:
    probs = classifier.predict_proba_batch([img for _, img in decoded])
    probs = np.asarray(probs, dtype=np.float64)
    if probs.shape != (len(decoded), len(classifier.info.labels)) or not np.all(np.isfinite(probs)):
        raise InferenceError(f"Classifier returned an invalid probability matrix {probs.shape}")
    return probs


def _load_category_master(db: Session, corporation_id: str, taxonomy: CivicIssueTaxonomy):
    candidate_ids = set()
    for issue in taxonomy.issues:
        candidate_ids.update(issue.candidate_category_ids(corporation_id))
    rows = (
        db.query(Category, Department)
        .outerjoin(Department, Department.id == Category.department_id)
        .filter(Category.corporation_id == corporation_id, Category.id.in_(candidate_ids))
        .all()
    )
    categories: Dict[str, Dict[str, Any]] = {}
    departments: Dict[str, Dict[str, Any]] = {}
    for cat, dept in rows:
        categories[cat.id] = {
            "id": cat.id, "name": cat.name, "name_mr": cat.name_mr, "priority": cat.priority,
            "resolution_hours": cat.resolution_hours, "is_urgent": cat.is_urgent,
            "redirect_target": cat.redirect_target, "is_active": cat.is_active,
            "department_id": cat.department_id,
        }
        if dept is not None:
            departments[dept.id] = {"id": dept.id, "code": dept.code, "name": dept.name, "name_mr": dept.name_mr}
    return categories, departments


def _routing_threshold(db: Session, corporation_id: str) -> float:
    row = db.query(Setting).filter(
        Setting.corporation_id == corporation_id, Setting.key == "ai_confidence_threshold").first()
    try:
        return float((row.value or {}).get("threshold", DEFAULT_ROUTING_THRESHOLD)) if row else DEFAULT_ROUTING_THRESHOLD
    except (TypeError, ValueError, AttributeError):
        return DEFAULT_ROUTING_THRESHOLD


def build_response(
    db: Session,
    corporation_id: str,
    classifier: CivicIssueClassifier,
    per_image_probs: np.ndarray,
    decoded: List[tuple],
    report: List[Dict[str, Any]],
    context: ComplaintContext,
    started_at: float,
    top_k: int,
) -> Dict[str, Any]:
    taxonomy = load_taxonomy()
    thresholds = configured_thresholds()
    labels = list(classifier.info.labels)

    aggregated = aggregate_probabilities(per_image_probs)
    probs = aggregated.probabilities

    # Per-image transparency
    for (orig_idx, _), top_idx, row_probs in zip(decoded, aggregated.per_image_top, per_image_probs):
        report[orig_idx]["top_issue_code"] = labels[top_idx]
        report[orig_idx]["top_confidence"] = round(float(row_probs[top_idx]), 4)

    # Only issue codes known to the taxonomy are considered; reject classes are never suggested.
    order = [int(i) for i in np.argsort(-probs, kind="stable")]
    known = [i for i in order if taxonomy.get(labels[i]) is not None]
    overall_top = known[0] if known else None
    top_is_reject = overall_top is not None and taxonomy.get(labels[overall_top]).is_reject
    candidates = [i for i in known if not taxonomy.get(labels[i]).is_reject][: max(1, top_k)]

    categories, departments = _load_category_master(db, corporation_id, taxonomy)
    routing_threshold = _routing_threshold(db, corporation_id)

    predictions: List[Dict[str, Any]] = []
    for rank, label_idx in enumerate(candidates, start=1):
        issue = taxonomy.get(labels[label_idx])
        conf = float(probs[label_idx])
        category = resolve_category_record(issue, corporation_id, categories)
        department = departments.get(category["department_id"]) if category else None
        band = confidence_band(conf, thresholds)
        predictions.append({
            "rank": rank,
            "issue_code": issue.code,
            "issue_name": issue.name_en,
            "issue_name_mr": issue.name_mr,
            "confidence": round(conf, 4),
            "confidence_band": band,
            "recommended": False,
            **build_issue_mapping(issue, category, department),
        })

    top_conf = predictions[0]["confidence"] if predictions else 0.0
    if not predictions:
        status = "no_prediction"
    elif top_is_reject:
        status = "no_civic_issue"
    elif predictions[0]["confidence_band"] == BAND_INSUFFICIENT:
        status = "low_confidence"
    else:
        status = "success"
        predictions[0]["recommended"] = True

    final_top_code = predictions[0]["issue_code"] if predictions else None
    agreement = sum(1 for t in aggregated.per_image_top if labels[t] == final_top_code)

    return {
        "status": status,
        "message": MESSAGES[status],
        "recommended_issue_code": final_top_code if status == "success" else None,
        "top_confidence": top_conf,
        "meets_routing_threshold": status == "success" and top_conf >= routing_threshold,
        "predictions": predictions,
        "images": report,
        "aggregation": {
            "method": AGGREGATION_METHOD,
            "images_received": len(report),
            "images_analyzed": aggregated.images_used,
            "top_issue_agreement": agreement,
        },
        "thresholds": {
            "strong": thresholds.strong,
            "suggestion": thresholds.suggestion,
            "minimum": thresholds.minimum,
            "routing": routing_threshold,
        },
        "model": {
            "provider": classifier.info.provider,
            "model_id": classifier.info.model_id,
            "version": classifier.info.version,
            "taxonomy_version": taxonomy.version,
        },
        "modalities_used": ["image"],
        "context_received": context.received(),
        "latency_ms": int((time.perf_counter() - started_at) * 1000),
    }
