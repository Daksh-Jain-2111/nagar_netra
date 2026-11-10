import asyncio
import threading
import time
from typing import Optional, Dict, Any, List

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.database import get_db
from backend.app.ml.base import InferenceError, ModelUnavailableError
from backend.app.ml.registry import ClassifierRegistry, get_classifier_registry
from backend.app.schemas.ai_classification import ClassifyImageResponse
from backend.app.services.classifier_service import ClassifierService
from backend.app.services.auth_service import get_current_user_optional
from backend.app.services.issue_classification_service import (
    AllImagesRejectedError, ComplaintContext, UploadedImage, build_response, decode_uploads, run_inference,
)
from backend.app.models.models import User

router = APIRouter(prefix="/ai", tags=["ai"])

class ClassifyRequest(BaseModel):
    text: Optional[str] = Field(None, description="Citizen complaint text or transcript")
    has_image: bool = Field(False, description="Whether photo attachment is present")
    image_metadata: Optional[Dict[str, Any]] = None

class ClassifyResponse(BaseModel):
    category_id: Optional[str]
    category_name: str
    confidence: float
    text_score: float
    image_score: float
    meets_threshold: bool
    requires_human_verification: bool
    redirect_target: Optional[str] = None
    all_scores: Dict[str, float]

@router.post("/classify", response_model=ClassifyResponse)
def classify_complaint_ai(
    payload: ClassifyRequest,
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Multimodal classification combining keyword/text rules and visual inference.
    Fusion: 0.60 image + 0.40 text.
    Confidence threshold: 0.70.
    Below 0.70 flags complaint for TO_CHECK human verification.
    """
    res = ClassifierService.classify_issue(
        text=payload.text or "",
        has_image=payload.has_image
    )
    return res


# ---------------------------------------------------------------------------
# Image-based civic issue classification
# ---------------------------------------------------------------------------
_inference_slots = threading.BoundedSemaphore(max(1, settings.AI_MAX_CONCURRENT_INFERENCES))
_MULTIPART_OVERHEAD_BYTES = 256 * 1024


def _ai_error(status_code: int, code: str, message: str, **extra) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"code": code, "message": message, **extra})


async def _read_limited(upload: UploadFile, max_bytes: int) -> bytes:
    data = await upload.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise _ai_error(
            413, "IMAGE_TOO_LARGE",
            f"'{upload.filename or 'image'}' is larger than {max_bytes // 1_048_576} MB.")
    return data


def _infer_with_slot(registry: ClassifierRegistry, decoded, timeout: float):
    if not _inference_slots.acquire(timeout=timeout):
        raise _ai_error(503, "AI_BUSY", "AI analysis is busy. Please try again in a moment.")
    try:
        classifier = registry.get()
        return classifier, run_inference(classifier, decoded)
    finally:
        _inference_slots.release()


@router.post(
    "/classify-image",
    response_model=ClassifyImageResponse,
    summary="Classify the civic issue shown in 1-3 complaint photos (Top-K with department & SLA)",
)
async def classify_complaint_images(
    request: Request,
    images: Optional[List[UploadFile]] = File(None, description="1 to AI_MAX_IMAGES photos (JPEG/PNG/WEBP)"),
    description: Optional[str] = Form(None, max_length=2000),
    voice_transcript: Optional[str] = Form(None, max_length=4000),
    latitude: Optional[float] = Form(None, ge=-90, le=90),
    longitude: Optional[float] = Form(None, ge=-180, le=180),
    top_k: int = Form(3, ge=1, le=5),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
    registry: ClassifierRegistry = Depends(get_classifier_registry),
):
    """
    Image -> civic issue probabilities (ML) -> Top-K issues -> category -> department -> SLA (rules + DB).

    `description`, `voice_transcript`, `latitude`, `longitude` are accepted for future multimodal
    models; the current model uses images only (see `modalities_used`).
    """
    started = time.perf_counter()
    max_images = settings.AI_MAX_IMAGES
    max_bytes = settings.AI_MAX_IMAGE_BYTES

    content_length = request.headers.get("content-length")
    if content_length and content_length.isdigit() and \
            int(content_length) > max_images * max_bytes + _MULTIPART_OVERHEAD_BYTES:
        raise _ai_error(413, "PAYLOAD_TOO_LARGE", "The uploaded photos are too large.")

    files = [f for f in (images or []) if f is not None and (f.filename or f.size)]
    if not files:
        raise _ai_error(400, "NO_IMAGE", "Please attach at least one photo of the issue.")
    if len(files) > max_images:
        raise _ai_error(400, "TOO_MANY_IMAGES", f"A maximum of {max_images} photos can be analysed.")

    uploads = [UploadedImage(filename=f.filename, data=await _read_limited(f, max_bytes)) for f in files]

    try:
        decoded, report = await run_in_threadpool(decode_uploads, uploads)
    except AllImagesRejectedError as exc:
        status_code = 413 if exc.code == "IMAGE_TOO_LARGE" else 400
        raise _ai_error(status_code, exc.code, exc.message, images=exc.rejected)

    timeout = settings.AI_INFERENCE_TIMEOUT_SECONDS
    try:
        classifier, per_image_probs = await asyncio.wait_for(
            run_in_threadpool(_infer_with_slot, registry, decoded, timeout), timeout=timeout)
    except asyncio.TimeoutError:
        raise _ai_error(504, "INFERENCE_TIMEOUT", "AI analysis took too long. Please select the category manually.")
    except ModelUnavailableError as exc:
        raise _ai_error(503, "MODEL_UNAVAILABLE", "AI analysis is currently unavailable.", reason=str(exc))
    except InferenceError as exc:
        raise _ai_error(500, "INFERENCE_FAILED", "AI analysis failed for these photos.", reason=str(exc))

    corporation_id = (current_user.corporation_id if current_user and current_user.corporation_id else "SMKMC")
    context = ComplaintContext(description, voice_transcript, latitude, longitude)
    return await run_in_threadpool(
        build_response, db, corporation_id, classifier, per_image_probs, decoded, report,
        context, started, top_k)


@router.get("/model-status", summary="Image classifier load status (no inference)")
def ai_model_status(registry: ClassifierRegistry = Depends(get_classifier_registry)):
    try:
        info = registry.get().info
        return {"available": True, "provider": info.provider, "model_id": info.model_id,
                "version": info.version, "labels": list(info.labels)}
    except ModelUnavailableError as exc:
        return {"available": False, "provider": registry.provider, "reason": str(exc)}
