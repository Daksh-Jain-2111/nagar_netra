"""
AI Model History (admin) tests: access control, prediction logging on complaint submission,
complaint traceability, filters, reviewer feedback + two-person training validation, dataset
snapshots, training-run lifecycle rules and empty states.
"""
import io
import uuid

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

import backend.app.ml.registry as ml_registry
from backend.app.database import SessionLocal
from backend.app.main import app
from backend.app.models.ai_history import AIPredictionEvent, AITrainingRun
from backend.app.models.models import User
from backend.app.seed.seed_data import seed_database
from backend.app.services.ai_model_registry_service import sync_model_registry
from backend.app.services.auth_service import create_access_token, get_password_hash
from backend.tests.test_ai_classification import LABELS, StubClassifier, StubRegistry, distribution

API = "/api/v1/admin/ai"
SANGLI = {"latitude": 16.8524, "longitude": 74.5815}


def _h(user_id, role):
    return {"Authorization": "Bearer " + create_access_token({"sub": user_id, "role": role, "corp": "SMKMC"})}


@pytest.fixture(scope="module")
def client():
    seed_database(force_reseed=False)
    db = SessionLocal()
    if not db.query(User).filter(User.id == "usr_platform2").first():
        db.add(User(id="usr_platform2", corporation_id="SMKMC", name="Second Platform Admin",
                    email="platform2@nagarnetra.test", hashed_password=get_password_hash("x"),
                    role="platform_admin", is_active=True))
        db.commit()
    sync_model_registry(db, verify_checksums=False)
    db.close()
    with TestClient(app) as c:
        yield c


@pytest.fixture
def H():
    return {
        "citizen": _h("usr_9822014589", "citizen"),
        "field_officer": _h("usr_fo_roads", "field_officer"),
        "supervisor": _h("usr_dmc1", "supervisor"),
        "helpdesk": _h("usr_helpdesk", "helpdesk"),
        "corp_admin": _h("usr_admin", "corp_admin"),
        "platform": _h("usr_platform", "platform_admin"),
        "platform2": _h("usr_platform2", "platform_admin"),
    }


def _png(red):
    buf = io.BytesIO()
    Image.new("RGB", (64, 48), (red, 90, 90)).save(buf, format="PNG")
    return buf.getvalue()


def _submit_text(client, H, **extra):
    body = {"category_id": "cat_garbage", "description": "Garbage dump near the market, kachra everywhere",
            "citizen_mobile": "9811122233", "citizen_name": "Test Citizen", **SANGLI, **extra}
    r = client.post("/api/v1/complaints", json=body, headers=H["citizen"])
    assert r.status_code == 200, r.text
    return r.json()["id"]


def _submit_with_photo(client, H, monkeypatch, probs, accepted=None):
    stub = StubRegistry(StubClassifier({200: probs}))
    monkeypatch.setattr(ml_registry, "get_classifier_registry", lambda: stub)
    payload = {"category_id": "cat_pothole", "description": "Big pothole", "accepted_ai_issue_code": accepted,
               "citizen_mobile": "9811122299", **SANGLI}
    import json
    r = client.post("/api/v1/complaints/with-media", data={"payload": json.dumps(payload)},
                    files=[("photos", ("p.png", _png(200), "image/png"))], headers=H["citizen"])
    assert r.status_code == 201, r.text
    return r.json()["id"]


# ---------------------------------------------------------------------------
# Access control
# ---------------------------------------------------------------------------
READ_ENDPOINTS = ["/overview", "/predictions", "/models", "/training-runs"]


@pytest.mark.parametrize("role", ["citizen", "field_officer", "supervisor", "helpdesk"])
def test_non_admin_roles_are_forbidden(client, H, role):
    for ep in READ_ENDPOINTS:
        assert client.get(API + ep, headers=H[role]).status_code == 403, ep
    assert client.post(API + "/models/sync", headers=H[role]).status_code == 403


def test_unauthenticated_is_rejected(client):
    for ep in READ_ENDPOINTS:
        assert client.get(API + ep).status_code == 401


def test_corp_admin_reads_but_cannot_manage_lifecycle(client, H):
    for ep in READ_ENDPOINTS:
        assert client.get(API + ep, headers=H["corp_admin"]).status_code == 200
    assert client.post(API + "/models/sync", headers=H["corp_admin"]).status_code == 403
    assert client.post(API + "/datasets", json={}, headers=H["corp_admin"]).status_code == 403
    assert client.post(API + "/training-runs", json={"candidate_model_version": "x"},
                       headers=H["corp_admin"]).status_code == 403
    assert client.get(API + "/training-samples", headers=H["corp_admin"]).status_code == 403


def test_corp_admin_is_scoped_to_own_corporation(client, H):
    kdmc = _h("usr_kdmc_admin", "corp_admin")
    items = client.get(API + "/predictions?page_size=100", headers=kdmc).json()["items"]
    assert all(i["corporation_id"] == "KDMC" for i in items)
    smkmc_pred = client.get(API + "/predictions?page_size=1", headers=H["platform"]).json()["items"]
    if smkmc_pred and smkmc_pred[0]["corporation_id"] == "SMKMC":
        assert client.get(f"{API}/predictions/{smkmc_pred[0]['id']}", headers=kdmc).status_code == 404


# ---------------------------------------------------------------------------
# Logging on submission + traceability
# ---------------------------------------------------------------------------
def test_text_submission_logs_keyword_prediction_linked_to_complaint(client, H):
    db = SessionLocal()
    runs_before = db.query(AITrainingRun).count()
    db.close()
    ref = _submit_text(client, H)
    r = client.get(f"{API}/complaints/{ref}/predictions", headers=H["platform"])
    items = r.json()["items"]
    assert len(items) == 1
    ev = items[0]
    assert ev["model_key"] == "text_keyword_rules" and ev["input_type"] == "TEXT"
    assert ev["origin"] == "LIVE" and ev["model_version_id"] and ev["feedback_status"] == "NOT_REVIEWED"
    assert ev["predicted_category_id"] == "cat_garbage"
    # Logging is not retraining
    db = SessionLocal()
    assert db.query(AITrainingRun).count() == runs_before
    db.close()


def test_voice_transcript_submission_is_voice_input(client, H):
    ref = _submit_text(client, H, description=None, audio_transcript="road pothole near bus stand")
    ev = client.get(f"{API}/complaints/{ref}/predictions", headers=H["platform"]).json()["items"][0]
    assert ev["input_type"] == "VOICE"


def test_photo_submission_logs_image_prediction_with_inference_details(client, H, monkeypatch):
    probs = distribution(ROAD_POTHOLE=0.9, ROAD_SURFACE_DAMAGE=0.05)
    ref = _submit_with_photo(client, H, monkeypatch, probs, accepted="ROAD_POTHOLE")
    items = client.get(f"{API}/complaints/{ref}/predictions", headers=H["platform"]).json()["items"]
    image = [i for i in items if i["model_key"] == "image_issue_classifier"]
    assert len(image) == 1 and len(items) == 2
    img = image[0]
    assert img["input_type"] == "IMAGE" and img["predicted_label"] == "ROAD_POTHOLE"
    assert img["routing_decision"] == "AI_SUGGESTED"
    assert abs(img["confidence"] - float(probs[LABELS.index("ROAD_POTHOLE")])) < 1e-3
    detail = client.get(f"{API}/predictions/{img['id']}", headers=H["platform"]).json()
    assert detail["complaint"]["complaint_reference"] == ref
    assert detail["results"]["top_predictions"][0]["label"] == "ROAD_POTHOLE"
    assert detail["inference"]["params"]["aggregation"]["images_analyzed"] == 1
    assert detail["inference"]["latency_ms"] is not None
    assert detail["feedback"]["training_eligibility"] == "NEEDS_REVIEW"
    # Personal data is not exposed
    text = str(detail)
    assert "9811122299" not in text and "citizen_mobile" not in text and "citizen_name" not in text


def test_failed_image_inference_is_logged_as_failed(client, H, monkeypatch):
    from backend.app.ml.base import ModelUnavailableError
    monkeypatch.setattr(ml_registry, "get_classifier_registry",
                        lambda: StubRegistry(error=ModelUnavailableError("model missing")))
    import json
    r = client.post("/api/v1/complaints/with-media",
                    data={"payload": json.dumps({"category_id": "cat_pothole", **SANGLI})},
                    files=[("photos", ("p.png", _png(10), "image/png"))], headers=H["citizen"])
    assert r.status_code == 201  # submission still succeeds
    items = client.get(f"{API}/complaints/{r.json()['id']}/predictions", headers=H["platform"]).json()["items"]
    img = [i for i in items if i["model_key"] == "image_issue_classifier"][0]
    assert img["routing_decision"] == "PREDICTION_FAILED" and img["status"] == "FAILED"


# ---------------------------------------------------------------------------
# Search, filters, pagination
# ---------------------------------------------------------------------------
def test_filters_and_pagination(client, H):
    ref = _submit_text(client, H)
    by_ref = client.get(f"{API}/predictions", params={"q": ref}, headers=H["platform"]).json()
    assert by_ref["total"] == 1 and by_ref["items"][0]["complaint_id"] == ref
    text_only = client.get(f"{API}/predictions", params={"input_type": "TEXT", "page_size": 100},
                           headers=H["platform"]).json()
    assert all(i["input_type"] == "TEXT" for i in text_only["items"])
    hi = client.get(f"{API}/predictions", params={"min_confidence": 0.8, "page_size": 100}, headers=H["platform"]).json()
    assert all(i["confidence"] >= 0.8 for i in hi["items"])
    page = client.get(f"{API}/predictions", params={"page_size": 1, "page": 2}, headers=H["platform"]).json()
    assert len(page["items"]) <= 1 and page["page"] == 2
    nr = client.get(f"{API}/predictions", params={"feedback_status": "NOT_REVIEWED", "page_size": 100},
                    headers=H["platform"]).json()
    assert all(i["feedback_status"] == "NOT_REVIEWED" for i in nr["items"])
    mk = client.get(f"{API}/predictions", params={"model_key": "text_keyword_rules", "page_size": 100},
                    headers=H["platform"]).json()
    assert all(i["model_key"] == "text_keyword_rules" for i in mk["items"])
    assert "model_versions" in mk["facets"]


def test_empty_state_for_corporation_without_predictions(client, H):
    ov = client.get(f"{API}/overview", params={"corporation_id": "NO_SUCH_CORP"}, headers=H["platform"]).json()
    assert ov["summary"]["total_predictions"] == 0
    assert ov["summary"]["average_confidence"] == {}
    lst = client.get(f"{API}/predictions", params={"corporation_id": "NO_SUCH_CORP"}, headers=H["platform"]).json()
    assert lst["total"] == 0 and lst["items"] == []


# ---------------------------------------------------------------------------
# Feedback -> validation -> curated dataset
# ---------------------------------------------------------------------------
def test_feedback_two_person_validation_and_dataset(client, H, monkeypatch):
    ref = _submit_with_photo(client, H, monkeypatch, distribution(ROAD_SURFACE_DAMAGE=0.7, ROAD_POTHOLE=0.2))
    items = client.get(f"{API}/complaints/{ref}/predictions", headers=H["platform"]).json()["items"]
    pid = [i for i in items if i["model_key"] == "image_issue_classifier"][0]["id"]

    bad = client.post(f"{API}/predictions/{pid}/feedback",
                      json={"review_status": "CORRECTED", "corrected_label": "NOT_A_LABEL"}, headers=H["platform"])
    assert bad.status_code == 400
    ok = client.post(f"{API}/predictions/{pid}/feedback",
                     json={"review_status": "CORRECTED", "corrected_label": "ROAD_POTHOLE", "notes": "clearly a pothole"},
                     headers=H["platform"])
    assert ok.status_code == 200 and ok.json()["training_eligibility"] == "PENDING_VALIDATION"

    detail = client.get(f"{API}/predictions/{pid}", headers=H["platform"]).json()
    assert detail["predicted_label"] == "ROAD_SURFACE_DAMAGE"            # model prediction kept
    assert detail["feedback"]["ground_truth_label"] == "ROAD_POTHOLE"    # reviewer label separate
    assert detail["feedback"]["training_sample_id"] is None              # not training data yet

    same = client.post(f"{API}/predictions/{pid}/training-eligibility", json={"decision": "approve"},
                       headers=H["platform"])
    assert same.status_code == 403  # reviewer cannot self-approve
    assert client.post(f"{API}/predictions/{pid}/training-eligibility", json={"decision": "approve"},
                       headers=H["corp_admin"]).status_code == 403
    approved = client.post(f"{API}/predictions/{pid}/training-eligibility", json={"decision": "approve"},
                           headers=H["platform2"])
    assert approved.status_code == 200 and approved.json()["training_sample_id"]

    ds = client.post(f"{API}/datasets", json={"notes": "test"}, headers=H["platform"])
    assert ds.status_code == 200, ds.text
    assert ds.json()["class_distribution"].get("ROAD_POTHOLE", 0) >= 1 and len(ds.json()["fingerprint"]) == 64
    again = client.post(f"{API}/datasets", json={}, headers=H["platform"])
    assert again.status_code == 409  # unchanged snapshot is refused
    assert client.post(f"{API}/predictions/{pid}/feedback", json={"review_status": "ACCEPTED"},
                       headers=H["platform"]).status_code == 409  # locked once in dataset


def test_keyword_predictions_are_not_training_eligible(client, H):
    ref = _submit_text(client, H)
    pid = client.get(f"{API}/complaints/{ref}/predictions", headers=H["platform"]).json()["items"][0]["id"]
    r = client.post(f"{API}/predictions/{pid}/feedback", json={"review_status": "ACCEPTED"}, headers=H["corp_admin"])
    assert r.status_code == 200 and r.json()["training_eligibility"] == "NOT_ELIGIBLE"


def test_demo_records_cannot_be_reviewed(client, H):
    db = SessionLocal()
    demo = db.query(AIPredictionEvent).filter(AIPredictionEvent.is_demo == True).first()  # noqa: E712
    db.close()
    if demo is None:
        pytest.skip("no seed-sample record in this database")
    r = client.post(f"{API}/predictions/{demo.id}/feedback", json={"review_status": "ACCEPTED"}, headers=H["platform"])
    assert r.status_code == 400
    ov = client.get(f"{API}/overview", headers=H["platform"]).json()
    assert ov["summary"]["demo_predictions_excluded"] >= 1


# ---------------------------------------------------------------------------
# Model registry
# ---------------------------------------------------------------------------
def test_model_registry_reflects_runtime_metadata(client, H):
    from backend.app.config import settings
    import json
    from pathlib import Path
    models = client.get(f"{API}/models", headers=H["platform"]).json()["items"]
    keyword = [m for m in models if m["model_key"] == "text_keyword_rules"]
    assert keyword and keyword[0]["deployment_status"] == "ACTIVE" and keyword[0]["trainable"] is False
    manifest_path = Path(settings.AI_MODEL_DIR) / "manifest.json"
    if not manifest_path.is_file():
        pytest.skip("image model not installed")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    img = [m for m in models if m["model_key"] == "image_issue_classifier" and m["version"] == manifest["artifact_version"]]
    assert img and img[0]["deployment_status"] == "ACTIVE"
    params = client.get(f"{API}/models/{img[0]['id']}/parameters", headers=H["platform"]).json()
    assert [c["code"] for c in params["output_classes"]] == manifest["labels"]
    assert params["preprocessing"]["mean"] == manifest["mean"]
    assert params["input_spec"]["image_size"] == manifest["image_size"]


# ---------------------------------------------------------------------------
# Training runs
# ---------------------------------------------------------------------------
def test_training_run_lifecycle_rules(client, H):
    cand = f"test-candidate-{uuid.uuid4().hex[:6]}"
    r = client.post(f"{API}/training-runs", json={"candidate_model_version": cand, "training_status": "RUNNING",
                                                   "training_config": {"epochs": 10, "batch_size": 32},
                                                   "environment": "staging"}, headers=H["platform"])
    assert r.status_code == 201, r.text
    run = r.json()
    assert run["approval_status"] == "PENDING" and run["deployment_status"] == "NOT_DEPLOYED"
    rid = run["id"]
    # metrics before completion are refused
    assert client.patch(f"{API}/training-runs/{rid}", json={"evaluation": {"accuracy": 0.9}},
                        headers=H["platform"]).status_code == 409
    done = client.patch(f"{API}/training-runs/{rid}", json={"training_status": "COMPLETED"}, headers=H["platform"])
    assert done.status_code == 200 and done.json()["approval_status"] == "PENDING"  # completion != approval
    assert client.post(f"{API}/training-runs/{rid}/approval", json={"decision": "approve"},
                       headers=H["platform"]).status_code == 409  # not evaluated
    assert client.patch(f"{API}/training-runs/{rid}", json={"evaluation_status": "PASSED"},
                        headers=H["platform"]).status_code == 400  # no metrics
    ev = client.patch(f"{API}/training-runs/{rid}", json={
        "evaluation": {"accuracy": 0.81, "macro_f1": 0.78},
        "comparison": {"evaluation_dataset": "test-set-1", "previous": {"accuracy": 0.6}, "candidate": {"accuracy": 0.81}},
        "evaluation_status": "PASSED"}, headers=H["platform"])
    assert ev.status_code == 200
    assert client.patch(f"{API}/training-runs/{rid}", json={"deployment_status": "ACTIVE"},
                        headers=H["platform"]).status_code == 422  # ACTIVE only from runtime
    ap = client.post(f"{API}/training-runs/{rid}/approval", json={"decision": "approve", "notes": "ok"},
                     headers=H["platform"])
    assert ap.status_code == 200
    body = ap.json()
    assert body["approval_status"] == "APPROVED" and body["deployment_status"] == "NOT_DEPLOYED"  # approval != deploy
    assert body["promotion"]["approved_by"]
    assert client.patch(f"{API}/training-runs/{rid}", json={"training_status": "RUNNING"},
                        headers=H["platform"]).status_code == 409  # terminal state
    lst = client.get(f"{API}/training-runs", headers=H["corp_admin"]).json()
    assert any(i["id"] == rid for i in lst["items"])
