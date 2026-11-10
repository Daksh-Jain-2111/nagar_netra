"""
Model artifact handling: manifest loading, integrity checks and ONNX Runtime sessions.

A model directory contains a `manifest.json` describing the provider, label space (issue codes),
preprocessing and files (with SHA-256 checksums). Large files may be shipped as numbered parts
(`<file>.part-000`, ...) and are re-assembled and verified on first load.
"""
import hashlib
import json
import logging
import os
import threading
from pathlib import Path
from typing import Any, Dict, Optional

from backend.app.ml.base import ModelUnavailableError

logger = logging.getLogger("nagarnetra.ml")

MANIFEST_FILE = "manifest.json"
SUPPORTED_FORMAT_VERSIONS = {1}
_assembly_lock = threading.Lock()


def load_manifest(model_dir: Path) -> Dict[str, Any]:
    path = model_dir / MANIFEST_FILE
    if not path.is_file():
        raise ModelUnavailableError(
            f"Model manifest not found at '{path}'. Build or install the model "
            f"(see backend/ml/README.md)."
        )
    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ModelUnavailableError(f"Model manifest '{path}' is unreadable: {exc}") from exc
    if manifest.get("format_version") not in SUPPORTED_FORMAT_VERSIONS:
        raise ModelUnavailableError(f"Unsupported model manifest format_version: {manifest.get('format_version')}")
    labels = manifest.get("labels")
    if not isinstance(labels, list) or not labels or len(set(labels)) != len(labels):
        raise ModelUnavailableError("Model manifest must list unique, non-empty 'labels' (issue codes).")
    return manifest


def sha256_of(path: Path, chunk_size: int = 4 * 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(chunk_size), b""):
            digest.update(chunk)
    return digest.hexdigest()


def resolve_artifact(model_dir: Path, spec: Optional[Dict[str, Any]], name: str, verify: bool) -> Path:
    """Return the local path of a manifest file entry, assembling it from parts if necessary."""
    if not spec or "path" not in spec:
        raise ModelUnavailableError(f"Model manifest is missing the '{name}' file entry.")
    target = (model_dir / spec["path"]).resolve()
    if model_dir.resolve() not in target.parents:
        raise ModelUnavailableError(f"Artifact path for '{name}' escapes the model directory.")
    expected = spec.get("sha256")

    if not target.is_file() and spec.get("parts"):
        _assemble_parts(model_dir, target, spec["parts"], expected)

    if not target.is_file():
        raise ModelUnavailableError(f"Model file '{target.name}' ({name}) not found in '{model_dir}'.")
    if verify and expected:
        actual = sha256_of(target)
        if actual != expected and spec.get("parts"):
            # Stale file from an older artifact version: rebuild it from the current parts.
            logger.warning("'%s' does not match the manifest; re-assembling from parts", target.name)
            target.unlink()
            _assemble_parts(model_dir, target, spec["parts"], expected)
            actual = sha256_of(target)
        if actual != expected:
            raise ModelUnavailableError(
                f"Checksum mismatch for '{target.name}': expected {expected[:12]}..., got {actual[:12]}...")
    return target


def _assemble_parts(model_dir: Path, target: Path, parts: list, expected_sha256: Optional[str]) -> None:
    with _assembly_lock:
        if target.is_file():
            return
        part_paths = [(model_dir / p).resolve() for p in parts]
        missing = [p.name for p in part_paths if not p.is_file()]
        if missing:
            raise ModelUnavailableError(f"Missing model file parts: {', '.join(missing)}")
        tmp = target.with_suffix(target.suffix + ".assembling")
        digest = hashlib.sha256()
        with open(tmp, "wb") as out:
            for part in part_paths:
                with open(part, "rb") as fh:
                    for chunk in iter(lambda: fh.read(4 * 1024 * 1024), b""):
                        digest.update(chunk)
                        out.write(chunk)
        if expected_sha256 and digest.hexdigest() != expected_sha256:
            tmp.unlink(missing_ok=True)
            raise ModelUnavailableError(f"Assembled '{target.name}' failed checksum verification.")
        os.replace(tmp, target)
        logger.info("Assembled model artifact %s from %d parts", target.name, len(part_paths))


def create_onnx_session(model_path: Path, intra_op_threads: int = 0):
    try:
        import onnxruntime as ort
    except ImportError as exc:  # pragma: no cover - depends on environment
        raise ModelUnavailableError(
            "onnxruntime is not installed. Run: pip install -r backend/requirements.txt") from exc
    options = ort.SessionOptions()
    options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    if intra_op_threads and intra_op_threads > 0:
        options.intra_op_num_threads = intra_op_threads
    try:
        return ort.InferenceSession(str(model_path), sess_options=options, providers=["CPUExecutionProvider"])
    except Exception as exc:
        raise ModelUnavailableError(f"Could not load ONNX model '{model_path.name}': {exc}") from exc


def onnx_session_spec(session) -> dict:
    """Input/output signature and runtime of a loaded ONNX Runtime session."""
    spec = {}
    try:
        import onnxruntime as ort
        spec["runtime"] = f"onnxruntime {ort.__version__}"
        spec["execution_providers"] = list(session.get_providers())
        inp = session.get_inputs()[0]
        out = session.get_outputs()[0]
        spec["input_name"] = inp.name
        spec["input_tensor_shape"] = [d if isinstance(d, int) else str(d) for d in inp.shape]
        spec["input_dtype"] = inp.type
        spec["output_name"] = out.name
        spec["output_shape"] = [d if isinstance(d, int) else str(d) for d in out.shape]
    except Exception:  # noqa: BLE001 - metadata is best-effort
        pass
    return spec


def declared_quantization(file_name: str):
    """Quantization declared by the artifact file name (e.g. 'vision_encoder.int8.onnx'), else None."""
    for q in ("int8", "uint8", "fp16", "int4"):
        if f".{q}." in file_name or file_name.endswith(f".{q}"):
            return {"mode": q, "source": f"artifact file name '{file_name}'"}
    return None
