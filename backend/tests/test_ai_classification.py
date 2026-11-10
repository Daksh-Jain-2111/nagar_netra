"""
Tests for image-based civic issue classification.

Deterministic tests inject a stub classifier through the FastAPI dependency (test-only; the
production path never uses it). `test_real_model_*` run the shipped ONNX model when its artifacts
are installed and are skipped otherwise.
"""
import io
from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from backend.app.config import settings
from backend.app.main import app
from backend.app.ml.aggregation import aggregate_probabilities
from backend.app.ml.base import CivicIssueClassifier, InferenceError, ModelInfo, ModelUnavailableError
from backend.app.ml.registry import ClassifierRegistry, get_classifier_registry
from backend.app.rules.issue_mapping_rules import (
    ConfidenceThresholds, confidence_band, load_taxonomy,
)
from backend.app.seed.seed_data import seed_database

ENDPOINT = "/api/v1/ai/classify-image"
LABELS = tuple(load_taxonomy().codes)


def png_bytes(color=(120, 120, 120), size=(64, 48), fmt="PNG") -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format=fmt)
    return buf.getvalue()


def distribution(**weights) -> np.ndarray:
    probs = np.full(len(LABELS), 1e-4)
    for code, p in weights.items():
        probs[LABELS.index(code)] = p
    return probs / probs.sum()


class StubClassifier(CivicIssueClassifier):
    """Returns a fixed distribution per image, chosen by the image's red channel value."""

    def __init__(self, by_red: dict, fail: Exception = None):
        self.by_red = by_red
        self.fail = fail

    @property
    def info(self):
        return ModelInfo(provider="stub", model_id="stub", version="test", labels=LABELS)

    def predict_proba_batch(self, images):
        if self.fail:
            raise self.fail
        return np.stack([self.by_red[img.getpixel((0, 0))[0]] for img in images])


class StubRegistry(ClassifierRegistry):
    def __init__(self, classifier=None, error=None):
        super().__init__("stub", ".", False, 0)
        self._stub, self._error = classifier, error

    def get(self):
        if self._error:
            raise self._error
        return self._stub


@pytest.fixture(scope="module")
def client():
    seed_database(force_reseed=False)
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.pop(get_classifier_registry, None)


def use(classifier=None, error=None):
    app.dependency_overrides[get_classifier_registry] = lambda: StubRegistry(classifier, error)


POTHOLE = distribution(ROAD_POTHOLE=0.94, ROAD_SURFACE_DAMAGE=0.04, ROAD_DIVIDER_DAMAGE=0.01)
GARBAGE = distribution(GARBAGE_DUMP=0.90, WASTE_ACCUMULATION=0.08)
UNSURE = distribution(ROAD_POTHOLE=0.30, GARBAGE_DUMP=0.28, OPEN_MANHOLE=0.25, WATERLOGGING=0.17)
SELFIE = distribution(NO_CIVIC_ISSUE=0.97)


# --- pure rules -----------------------------------------------------------------------------
def test_confidence_bands():
    t = ConfidenceThresholds(strong=0.8, suggestion=0.6, minimum=0.4)
    assert confidence_band(0.94, t) == "strong"
    assert confidence_band(0.80, t) == "strong"
    assert confidence_band(0.79, t) == "suggestion"
    assert confidence_band(0.45, t) == "low"
    assert confidence_band(0.39, t) == "insufficient"
    with pytest.raises(ValueError):
        ConfidenceThresholds(strong=0.5, suggestion=0.6, minimum=0.4)


def test_taxonomy_every_issue_maps_to_seeded_category():
    from backend.app.database import SessionLocal
    from backend.app.models.models import Category
    seed_database(force_reseed=False)
    db = SessionLocal()
    try:
        ids = {c.id for c in db.query(Category).filter(Category.corporation_id == "SMKMC")}
    finally:
        db.close()
    for issue in load_taxonomy().issues:
        if not issue.is_reject:
            assert issue.category_id in ids, issue.code


def test_mean_aggregation():
    agg = aggregate_probabilities(np.stack([POTHOLE, POTHOLE, GARBAGE]))
    assert agg.images_used == 3
    assert LABELS[int(np.argmax(agg.probabilities))] == "ROAD_POTHOLE"
    assert abs(agg.probabilities.sum() - 1.0) < 1e-9


# --- API --------------------------------------------------------------------------------------
def test_top3_with_department_and_sla(client):
    use(StubClassifier({10: POTHOLE}))
    res = client.post(ENDPOINT, files=[("images", ("a.png", png_bytes((10, 0, 0)), "image/png"))])
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "success"
    preds = body["predictions"]
    assert [p["rank"] for p in preds] == [1, 2, 3]
    top = preds[0]
    assert top["issue_code"] == "ROAD_POTHOLE" and top["recommended"] is True
    assert top["confidence_band"] == "strong" and abs(top["confidence"] - 0.94) < 0.01
    # Department + SLA come from the seeded category master, not from the model
    assert top["category_id"] == "cat_pothole"
    assert top["department_id"] == "dept_roads" and top["department_code"] == "RD"
    assert top["sla_hours"] == 72 and top["response_sla_hours"] == 48
    assert top["app_category_id"] == "roads_potholes"
    assert all(p["recommended"] is False for p in preds[1:])
    assert all(p["issue_code"] != "NO_CIVIC_ISSUE" for p in preds)
    assert body["meets_routing_threshold"] is True
    assert body["modalities_used"] == ["image"]


def test_multi_image_aggregation(client):
    use(StubClassifier({10: POTHOLE, 20: GARBAGE}))
    files = [("images", (f"{i}.png", png_bytes((r, 0, 0)), "image/png")) for i, r in enumerate([10, 10, 20])]
    body = client.post(ENDPOINT, files=files).json()
    assert body["aggregation"] == {"method": "mean_probability", "images_received": 3,
                                   "images_analyzed": 3, "top_issue_agreement": 2}
    assert body["predictions"][0]["issue_code"] == "ROAD_POTHOLE"
    assert body["predictions"][0]["confidence"] < 0.94  # disagreement lowers confidence
    assert [i["top_issue_code"] for i in body["images"]] == ["ROAD_POTHOLE", "ROAD_POTHOLE", "GARBAGE_DUMP"]


def test_low_confidence_is_not_recommended(client):
    use(StubClassifier({10: UNSURE}))
    body = client.post(ENDPOINT, files=[("images", ("a.png", png_bytes((10, 0, 0)), "image/png"))]).json()
    assert body["status"] == "low_confidence"
    assert body["recommended_issue_code"] is None
    assert all(not p["recommended"] for p in body["predictions"])
    assert "select a category manually" in body["message"]


def test_no_civic_issue(client):
    use(StubClassifier({10: SELFIE}))
    body = client.post(ENDPOINT, files=[("images", ("a.png", png_bytes((10, 0, 0)), "image/png"))]).json()
    assert body["status"] == "no_civic_issue"
    assert body["recommended_issue_code"] is None


def test_invalid_image_among_valid_ones_is_reported(client):
    use(StubClassifier({10: POTHOLE}))
    files = [("images", ("ok.png", png_bytes((10, 0, 0)), "image/png")),
             ("images", ("bad.jpg", b"not an image at all", "image/jpeg"))]
    body = client.post(ENDPOINT, files=files).json()
    assert body["status"] == "success"
    assert body["images"][1]["status"] == "rejected" and body["images"][1]["error_code"] == "INVALID_IMAGE"
    assert body["aggregation"]["images_analyzed"] == 1


@pytest.mark.parametrize("files,status,code", [
    ([], 400, "NO_IMAGE"),
    ([("images", ("x.jpg", b"garbage-bytes", "image/jpeg"))], 400, "INVALID_IMAGE"),
    ([("images", ("x.gif", None, "image/gif"))], 400, "UNSUPPORTED_FORMAT"),
    ([("images", (f"{i}.png", None, "image/png")) for i in range(4)], 400, "TOO_MANY_IMAGES"),
])
def test_validation_errors(client, files, status, code):
    use(StubClassifier({10: POTHOLE}))
    prepared = []
    for field, (name, data, ctype) in files:
        if data is None:
            data = png_bytes((10, 0, 0), fmt="GIF" if name.endswith(".gif") else "PNG")
        prepared.append((field, (name, data, ctype)))
    res = client.post(ENDPOINT, files=prepared) if prepared else client.post(ENDPOINT, data={"top_k": "3"})
    assert res.status_code == status, res.text
    assert res.json()["detail"]["code"] == code


def test_image_too_large(client, monkeypatch):
    use(StubClassifier({10: POTHOLE}))
    monkeypatch.setattr(settings, "AI_MAX_IMAGE_BYTES", 1000)
    res = client.post(ENDPOINT, files=[("images", ("big.png", png_bytes((10, 0, 0), size=(400, 400)), "image/png"))])
    assert res.status_code == 413
    assert res.json()["detail"]["code"] == "IMAGE_TOO_LARGE"


def test_model_unavailable_returns_503(client):
    use(error=ModelUnavailableError("model files missing"))
    res = client.post(ENDPOINT, files=[("images", ("a.png", png_bytes((10, 0, 0)), "image/png"))])
    assert res.status_code == 503
    assert res.json()["detail"]["code"] == "MODEL_UNAVAILABLE"


def test_inference_failure_returns_500(client):
    use(StubClassifier({}, fail=InferenceError("boom")))
    res = client.post(ENDPOINT, files=[("images", ("a.png", png_bytes((10, 0, 0)), "image/png"))])
    assert res.status_code == 500
    assert res.json()["detail"]["code"] == "INFERENCE_FAILED"


def test_context_fields_are_accepted_for_future_multimodal(client):
    use(StubClassifier({10: POTHOLE}))
    res = client.post(ENDPOINT, data={"description": "खड्डा", "latitude": "16.85", "longitude": "74.58"},
                      files=[("images", ("a.png", png_bytes((10, 0, 0)), "image/png"))])
    assert res.json()["context_received"] == {"description": True, "voice_transcript": False, "location": True}


# --- real model (skipped when artifacts are not installed) -----------------------------------
MODEL_DIR = Path(settings.AI_MODEL_DIR)
needs_model = pytest.mark.skipif(not (MODEL_DIR / "manifest.json").is_file(), reason="model artifacts not installed")


@needs_model
def test_real_model_loads_and_returns_distribution():
    from backend.app.ml.providers.clip_zero_shot import ClipZeroShotClassifier
    clf = ClipZeroShotClassifier(MODEL_DIR)
    assert set(clf.info.labels) <= set(LABELS)
    img = Image.new("RGB", (320, 240), (90, 90, 90))
    scores = clf.predict_top_k(img, k=3)
    assert len(scores) == 3 and scores[0].confidence >= scores[1].confidence
    probs = clf.predict_proba_batch([img, img])
    assert probs.shape == (2, len(clf.info.labels)) and np.allclose(probs.sum(axis=1), 1.0, atol=1e-4)


@needs_model
def test_real_model_end_to_end(client):
    app.dependency_overrides.pop(get_classifier_registry, None)
    res = client.post(ENDPOINT, files=[("images", ("a.jpg", png_bytes((90, 90, 90), (320, 240), "JPEG"), "image/jpeg"))])
    assert res.status_code == 200, res.text
    assert res.json()["model"]["provider"] == "clip_zero_shot"
