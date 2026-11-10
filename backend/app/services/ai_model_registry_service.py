"""
AI model registry, built ONLY from what the backend can actually read:

  * image issue classifier - every `manifest.json` under ml_models/ (labels, preprocessing, checksums,
    build info). The version the runtime config points at (AI_CLASSIFIER_PROVIDER + AI_MODEL_DIR)
    is ACTIVE; other manifests found on disk are NOT_DEPLOYED.
  * speech recognition - the Whisper ONNX files in STT_MODEL_DIR (no manifest exists, so the version
    is derived from file names + SHA-256 and labelled as derived).
  * text keyword rules - services/classifier_service.py. It is a rule set, not a trained model, but
    its score drives complaint routing, so it is registered (version = hash of its keyword table).

Deployment status is never inferred from documentation or from a training run.
"""
import datetime
import hashlib
import inspect
import json
import logging
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.models.ai_history import AIModelVersion

logger = logging.getLogger("nagarnetra.ai_registry")

IMAGE_MODEL_KEY = "image_issue_classifier"
TEXT_MODEL_KEY = "text_keyword_rules"
SPEECH_MODEL_KEY = "speech_recognition"

MODEL_KEYS = {
    IMAGE_MODEL_KEY: "image_classification",
    TEXT_MODEL_KEY: "text_classification",
    SPEECH_MODEL_KEY: "speech_recognition",
}

# Routing threshold hard-coded in rules/routing_rules.determine_initial_route
KEYWORD_ROUTING_THRESHOLD = 0.70

_sync_lock = threading.Lock()
_hash_cache: Dict[str, tuple] = {}   # path -> (size, mtime, sha256)


def model_version_id(model_key: str, version: str) -> str:
    return "aimv_" + hashlib.sha1(f"{model_key}|{version}".encode("utf-8")).hexdigest()[:16]


def _utcnow():
    return datetime.datetime.utcnow()


def _file_sha256(path: Path) -> Optional[str]:
    """SHA-256 of a file, cached by (size, mtime) so large artifacts are hashed once."""
    try:
        st = path.stat()
    except OSError:
        return None
    key = str(path.resolve())
    cached = _hash_cache.get(key)
    if cached and cached[0] == st.st_size and cached[1] == st.st_mtime:
        return cached[2]
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    value = digest.hexdigest()
    _hash_cache[key] = (st.st_size, st.st_mtime, value)
    return value


def _rel(path: Path) -> str:
    """Path relative to the backend folder (avoids exposing absolute host paths)."""
    base = Path(settings.AI_MODEL_DIR).resolve().parent.parent  # backend/
    try:
        return str(path.resolve().relative_to(base)).replace("\\", "/")
    except ValueError:
        return path.name


def _runtime_version() -> Optional[str]:
    try:
        import onnxruntime as ort
        return ort.__version__
    except Exception:  # noqa: BLE001
        return None


# ---------------------------------------------------------------------------
# Image classifier (manifest based)
# ---------------------------------------------------------------------------
def _image_entries(verify_checksums: bool) -> List[Dict[str, Any]]:
    from backend.app.rules.issue_mapping_rules import load_taxonomy

    configured_dir = Path(settings.AI_MODEL_DIR).resolve()
    configured_provider = (settings.AI_CLASSIFIER_PROVIDER or "").strip().lower()
    roots = {configured_dir.parent}
    manifests = []
    for root in roots:
        if root.is_dir():
            manifests.extend(sorted(root.glob("*/manifest.json")))
    if (configured_dir / "manifest.json").is_file() and configured_dir / "manifest.json" not in manifests:
        manifests.append(configured_dir / "manifest.json")

    try:
        taxonomy = load_taxonomy()
        names = {i.code: i.name_en for i in taxonomy.issues}
        taxonomy_version = taxonomy.version
    except Exception:  # noqa: BLE001
        names, taxonomy_version = {}, None

    entries = []
    for manifest_path in manifests:
        if "_to_delete" in manifest_path.parts:
            continue
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            logger.warning("Skipping unreadable manifest %s: %s", manifest_path, exc)
            continue
        provider = manifest.get("provider")
        if provider not in ("clip_zero_shot", "onnx_classifier"):
            continue
        model_dir = manifest_path.parent
        version = str(manifest.get("artifact_version") or "unversioned")
        files = []
        primary_checksum = None
        for role, spec in (manifest.get("files") or {}).items():
            path = model_dir / spec.get("path", "")
            declared = spec.get("sha256")
            exists = path.is_file()
            actual = _file_sha256(path) if (exists and verify_checksums) else None
            files.append({
                "role": role,
                "name": spec.get("path"),
                "declared_sha256": declared,
                "sha256": actual,
                "size_bytes": path.stat().st_size if exists else None,
                "present": exists or bool(spec.get("parts")),
                "assembled_from_parts": (not exists) and bool(spec.get("parts")),
                "verified": (actual == declared) if (actual and declared) else None,
            })
            if role in ("vision_encoder", "model"):
                primary_checksum = declared or actual
        labels = list(manifest.get("labels") or [])
        is_configured = model_dir.resolve() == configured_dir and configured_provider == provider
        clip = manifest.get("clip") or {}
        cls = manifest.get("classifier") or {}
        build = manifest.get("build") or {}
        if provider == "clip_zero_shot":
            architecture = (f"CLIP zero-shot: {manifest.get('model_id')} image encoder (ONNX) + "
                            f"{len(manifest.get('embedding_labels') or labels)} precomputed text embeddings "
                            f"(dim {clip.get('embedding_dim', 'n/a')})")
            notes = ["Confidence values are uncalibrated softmax probabilities, not accuracy."]
            input_name, output_name = clip.get("input_name"), clip.get("output_name")
        else:
            architecture = f"Fine-tuned ONNX classifier: {manifest.get('model_id')}"
            notes = []
            input_name, output_name = cls.get("input_name"), cls.get("output_name")
        size = manifest.get("image_size")
        entries.append({
            "model_key": IMAGE_MODEL_KEY,
            "task": "image_classification",
            "name": "Civic issue image classifier",
            "version": version,
            "version_source": f"{_rel(manifest_path)} -> artifact_version",
            "provider": provider,
            "architecture": architecture,
            "model_format": "ONNX",
            "input_spec": {
                "modality": "image (JPEG/PNG/WEBP, 1-%d photos, mean of per-photo probabilities)" % settings.AI_MAX_IMAGES,
                "tensor_layout": "NCHW",
                "image_size": size,
                "tensor_shape": ["batch", 3, size, size] if size else None,
                "data_type": "float32",
                "input_name": input_name,
                "output_name": output_name,
            },
            "output_classes": [{"code": c, "name": names.get(c)} for c in labels],
            "preprocessing": {
                "resize": f"shorter side to {size}px + center crop" if size else None,
                "interpolation": manifest.get("interpolation"),
                "mean": manifest.get("mean"),
                "std": manifest.get("std"),
                "taxonomy_version": build.get("taxonomy_version") or taxonomy_version,
                **({"logit_scale": clip.get("logit_scale")} if clip else {}),
                **({"temperature": cls.get("temperature"), "output_type": cls.get("output_type")} if cls else {}),
            },
            "confidence_thresholds": {
                "strong": settings.AI_CONFIDENCE_STRONG,
                "suggestion": settings.AI_CONFIDENCE_SUGGESTION,
                "minimum": settings.AI_CONFIDENCE_MIN,
                "source": "backend settings AI_CONFIDENCE_* (+ corporation setting ai_confidence_threshold for routing)",
            },
            "supported_languages": None,
            "artifact_uri": _rel(model_dir),
            "artifact_checksum": primary_checksum,
            "artifact_files": files,
            "framework": {
                "runtime": f"onnxruntime {_runtime_version()}" if _runtime_version() else "onnxruntime (not installed)",
                "build": {k: v for k, v in build.items() if k in ("built_at", "torch", "open_clip", "taxonomy_version")},
                "weights_source": build.get("weights_url"),
            },
            "metadata_source": _rel(manifest_path),
            "notes": ([f"Manifest: {manifest['description']}"] if manifest.get("description") else []) + notes,
            "extra": {"model_id": manifest.get("model_id"), "format_version": manifest.get("format_version"),
                      "quantization": "int8" if ".int8." in json.dumps(manifest.get("files", {})) else None,
                      "built_at": build.get("built_at")},
            "trainable": True,
            "_active": is_configured,
        })
    return entries


# ---------------------------------------------------------------------------
# Speech recognition (Whisper ONNX files, no manifest)
# ---------------------------------------------------------------------------
def _speech_entries(verify_checksums: bool) -> List[Dict[str, Any]]:
    from backend.app.speech.base import SUPPORTED_LANGUAGES

    model_dir = Path(settings.STT_MODEL_DIR)
    provider = (settings.STT_PROVIDER or "").strip().lower()
    if not model_dir.is_dir():
        return []
    encoders = sorted(model_dir.glob("*-encoder.int8.onnx")) or sorted(model_dir.glob("*-encoder.onnx"))
    if not encoders:
        return []
    encoder = encoders[0]
    prefix = encoder.name.split("-encoder")[0]
    suffix = encoder.name.split("-encoder")[1]
    paths = [encoder, model_dir / f"{prefix}-decoder{suffix}", model_dir / f"{prefix}-tokens.txt"]
    files = []
    combined = hashlib.sha256()
    for role, p in zip(("encoder", "decoder", "tokens"), paths):
        exists = p.is_file()
        digest = _file_sha256(p) if (exists and verify_checksums) else None
        if digest:
            combined.update(digest.encode())
        files.append({"role": role, "name": p.name, "sha256": digest, "declared_sha256": None,
                      "size_bytes": p.stat().st_size if exists else None, "present": exists, "verified": None})
    quant = "int8" if ".int8." in encoder.name else None
    have_all = all(f["sha256"] for f in files)
    version = f"whisper-{prefix}{'-' + quant if quant else ''}" + (f"+{combined.hexdigest()[:8]}" if have_all else "")

    # Runtime metadata only if the model is already loaded (loading 1 GB just to read it is avoided)
    engine_meta = {}
    try:
        from backend.app.speech.registry import get_speech_registry
        inst = get_speech_registry()._instance
        engine = getattr(inst, "_engine", None)
        if engine is not None:
            engine_meta = {"model_type": engine.model_type, "n_mels": engine.n_mels,
                           "n_text_layer": engine.n_text_layer, "n_text_ctx": engine.n_text_ctx,
                           "n_text_state": engine.n_text_state,
                           "languages_in_model": len(engine.lang_tokens)}
    except Exception:  # noqa: BLE001
        pass

    return [{
        "model_key": SPEECH_MODEL_KEY,
        "task": "speech_recognition",
        "name": "Voice complaint speech-to-text (Whisper)",
        "version": version,
        "version_source": "derived: encoder file name + SHA-256 of encoder/decoder/tokens (no manifest shipped)",
        "provider": "whisper_onnx",
        "architecture": f"Whisper encoder-decoder transformer ({engine_meta.get('model_type') or prefix}), "
                        f"sherpa-onnx export, greedy decoding",
        "model_format": "ONNX (encoder + decoder) + BPE token table",
        "input_spec": {
            "modality": "audio (webm/ogg/mp4/wav/mp3/aac), decoded to 16 kHz mono float32 PCM",
            "max_seconds": settings.VOICE_MAX_SECONDS,
            "max_bytes": settings.VOICE_MAX_BYTES,
            "features": f"log-mel spectrogram ({engine_meta['n_mels']} mel bins, 30 s chunks)" if engine_meta.get("n_mels")
                        else "log-mel spectrogram, 30 s chunks (mel bins read from the model when loaded)",
        },
        "output_classes": None,
        "preprocessing": {"sample_rate_hz": 16000, "channels": 1, "chunk_seconds": 30,
                          "fft": 400, "hop_length": 160},
        "confidence_thresholds": None,
        "supported_languages": list(SUPPORTED_LANGUAGES),
        "artifact_uri": _rel(model_dir),
        "artifact_checksum": combined.hexdigest() if have_all else None,
        "artifact_files": files,
        "framework": {"runtime": f"onnxruntime {_runtime_version()}" if _runtime_version() else "onnxruntime (not installed)"},
        "metadata_source": f"files in {_rel(model_dir)} + STT_* settings" + (" + loaded model metadata" if engine_meta else ""),
        "notes": ["Speech recognition produces transcripts, not category predictions; it is not logged "
                  "as a prediction event. Transcript provenance is shown on voice-based predictions.",
                  "Supported languages are those the app requests (mr, hi, en); the model itself is multilingual."],
        "extra": {"quantization": quant, **engine_meta},
        "trainable": False,
        "_active": provider == "whisper_onnx" and all(f["present"] for f in files),
    }]


# ---------------------------------------------------------------------------
# Text keyword rules (source code)
# ---------------------------------------------------------------------------
def keyword_rules_version() -> str:
    from backend.app.services import classifier_service

    source = inspect.getsource(classifier_service.ClassifierService.classify_issue)
    blob = json.dumps(classifier_service.CATEGORY_KEYWORDS, sort_keys=True, ensure_ascii=False) + source
    return "rules-" + hashlib.sha256(blob.encode("utf-8")).hexdigest()[:10]


def _text_entries() -> List[Dict[str, Any]]:
    from backend.app.services import classifier_service

    keywords = classifier_service.CATEGORY_KEYWORDS
    return [{
        "model_key": TEXT_MODEL_KEY,
        "task": "text_classification",
        "name": "Keyword rule classifier (routing score)",
        "version": keyword_rules_version(),
        "version_source": "derived: SHA-256 of CATEGORY_KEYWORDS + classify_issue source",
        "provider": "keyword_rules",
        "architecture": "Keyword matching (EN + Marathi) with fixed fusion 0.6 x image_score + 0.4 x text_score; not a trained ML model",
        "model_format": "Python rules (backend/app/services/classifier_service.py)",
        "input_spec": {"modality": "complaint text (description, else voice transcript, else the chosen category name)",
                       "flags": ["has_image"]},
        "output_classes": [{"code": k, "name": None, "keywords": len(v)} for k, v in keywords.items()],
        "preprocessing": {"lowercase": True, "matching": "substring", "text_score": "min(0.45 x matches, 1.0), 0.1 if no match"},
        "confidence_thresholds": {"routing": KEYWORD_ROUTING_THRESHOLD,
                                  "source": "rules/routing_rules.determine_initial_route (hard-coded)"},
        "supported_languages": ["en", "mr"],
        "artifact_uri": "backend/app/services/classifier_service.py",
        "artifact_checksum": None,
        "artifact_files": [],
        "framework": {"runtime": "Python (no ML runtime)"},
        "metadata_source": "backend/app/services/classifier_service.py",
        "notes": [
            "Its 'image_score' is a heuristic constant based on whether a photo flag was sent, not a vision model.",
            "When the citizen gives no text, it classifies the chosen category's name, so the prediction is not independent.",
            "This score (not the CLIP image model) decides whether a complaint is auto-routed or sent to TO_CHECK.",
        ],
        "extra": {"keyword_count": sum(len(v) for v in keywords.values())},
        "trainable": False,
        "_active": True,
    }]


# ---------------------------------------------------------------------------
# Sync
# ---------------------------------------------------------------------------
def collect_runtime_models(verify_checksums: bool = True) -> List[Dict[str, Any]]:
    entries: List[Dict[str, Any]] = []
    for collector in (lambda: _image_entries(verify_checksums), lambda: _speech_entries(verify_checksums), _text_entries):
        try:
            entries.extend(collector())
        except Exception as exc:  # noqa: BLE001 - one broken source must not hide the others
            logger.warning("Model registry collector failed: %s", exc)
    return entries


def sync_model_registry(db: Session, verify_checksums: bool = True) -> Dict[str, Any]:
    """Upsert registry rows from runtime metadata and recompute deployment status per model key."""
    with _sync_lock:
        entries = collect_runtime_models(verify_checksums)
        now = _utcnow()
        seen_active: Dict[str, str] = {}
        touched = []
        for entry in entries:
            active = entry.pop("_active")
            row_id = model_version_id(entry["model_key"], entry["version"])
            row = db.query(AIModelVersion).filter(AIModelVersion.id == row_id).first()
            if row is None:
                row = AIModelVersion(id=row_id, first_seen_at=now, deployment_status="NOT_DEPLOYED")
                db.add(row)
            for key, value in entry.items():
                setattr(row, key, value)
            row.last_synced_at = now
            if active:
                seen_active[entry["model_key"]] = row_id
            touched.append(row_id)
        db.flush()

        changes = []
        for model_key in MODEL_KEYS:
            rows = db.query(AIModelVersion).filter(AIModelVersion.model_key == model_key).all()
            active_id = seen_active.get(model_key)
            active_row = next((r for r in rows if r.id == active_id), None)
            for r in rows:
                if r.id == active_id:
                    if r.deployment_status != "ACTIVE":
                        changes.append({"model_key": model_key, "version": r.version, "to": "ACTIVE"})
                        r.deployment_status = "ACTIVE"
                        r.activated_at = now
                        r.deactivated_at = None
                elif r.deployment_status == "ACTIVE":
                    # It was serving and no longer is: rolled back if the new active one was served before it
                    rolled_back = bool(active_row and active_row.activated_at and r.activated_at
                                       and active_row.first_seen_at < r.first_seen_at)
                    r.deployment_status = "ROLLED_BACK" if rolled_back else ("SUPERSEDED" if active_row else "NOT_DEPLOYED")
                    r.deactivated_at = now
                    changes.append({"model_key": model_key, "version": r.version, "to": r.deployment_status})
        db.commit()
        _relink_prediction_events(db)
        _reconcile_training_run_deployments(db)
        return {"synced_at": now.isoformat() + "Z", "versions_seen": len(touched), "status_changes": changes}


def _relink_prediction_events(db: Session) -> None:
    """Link events logged before their model version was registered (e.g. right after startup)."""
    from backend.app.models.ai_history import AIPredictionEvent

    rows = db.query(AIPredictionEvent).filter(AIPredictionEvent.model_version_id.is_(None)).all()
    changed = False
    for ev in rows:
        mv = find_model_version(db, ev.model_key, ev.model_version)
        if mv is not None:
            ev.model_version_id = mv.id
            if not ev.model_name or ev.model_name != mv.name:
                ev.model_name = mv.name
            changed = True
    if changed:
        db.commit()


def _reconcile_training_run_deployments(db: Session) -> None:
    """A training run's candidate is ACTIVE only when the runtime actually serves that version."""
    from backend.app.models.ai_history import AITrainingRun

    runs = db.query(AITrainingRun).filter(AITrainingRun.approval_status == "APPROVED").all()
    changed = False
    for run in runs:
        version = db.query(AIModelVersion).filter(
            AIModelVersion.model_key == run.model_key,
            AIModelVersion.version == run.candidate_model_version).first()
        if version is None:
            continue
        run.candidate_model_version_id = version.id
        if version.deployment_status == "ACTIVE" and run.deployment_status != "ACTIVE":
            run.deployment_status = "ACTIVE"
            run.deployed_at = version.activated_at
            changed = True
        elif version.deployment_status == "ROLLED_BACK" and run.deployment_status == "ACTIVE":
            run.deployment_status = "ROLLED_BACK"
            run.rollback_info = {"rolled_back_at": (version.deactivated_at or _utcnow()).isoformat() + "Z",
                                 "detected_by": "runtime model registry sync"}
            changed = True
    if changed:
        db.commit()


def active_model_version(db: Session, model_key: str) -> Optional[AIModelVersion]:
    return db.query(AIModelVersion).filter(
        AIModelVersion.model_key == model_key, AIModelVersion.deployment_status == "ACTIVE").first()


def find_model_version(db: Session, model_key: str, version: Optional[str]) -> Optional[AIModelVersion]:
    if not version:
        return None
    return db.query(AIModelVersion).filter(
        AIModelVersion.model_key == model_key, AIModelVersion.version == version).first()


def runtime_status() -> Dict[str, Any]:
    """Live load state of the models in this process (no inference, no loading)."""
    out: Dict[str, Any] = {}
    try:
        from backend.app.ml.registry import get_classifier_registry
        reg = get_classifier_registry()
        st = reg.status()
        out[IMAGE_MODEL_KEY] = {"provider": st["provider"], "loaded": st["loaded"],
                                "model_id": st["model_id"], "last_error": st["last_error"],
                                "version": reg._classifier.info.version if reg._classifier else None}
    except Exception as exc:  # noqa: BLE001
        out[IMAGE_MODEL_KEY] = {"loaded": False, "last_error": str(exc)[:200]}
    try:
        from backend.app.speech.registry import get_speech_registry
        sreg = get_speech_registry()
        out[SPEECH_MODEL_KEY] = {"provider": sreg.provider, "loaded": sreg._instance is not None,
                                 "model_id": sreg._instance.model_id if sreg._instance else None,
                                 "last_error": sreg._last_error}
    except Exception as exc:  # noqa: BLE001
        out[SPEECH_MODEL_KEY] = {"loaded": False, "last_error": str(exc)[:200]}
    out[TEXT_MODEL_KEY] = {"provider": "keyword_rules", "loaded": True, "model_id": "ClassifierService",
                           "last_error": None}
    return out


def sync_in_background() -> None:
    """Startup helper: hash artifacts and sync the registry without blocking the API."""
    from backend.app.database import SessionLocal

    def _run():
        db = SessionLocal()
        try:
            result = sync_model_registry(db, verify_checksums=True)
            logger.info("AI model registry synced: %s", result)
        except Exception as exc:  # noqa: BLE001
            logger.warning("AI model registry sync failed: %s", exc)
        finally:
            db.close()

    threading.Thread(target=_run, name="ai-registry-sync", daemon=True).start()
