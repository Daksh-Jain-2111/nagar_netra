"""
Supervised (fine-tuned) civic issue classifier exported to ONNX.

Drop-in replacement for the zero-shot CLIP baseline once a model has been trained on labelled
civic complaint photos (see backend/ml/README.md). Expected model directory:

    manifest.json   {"format_version": 1, "provider": "onnx_classifier",
                     "model_id": "...", "artifact_version": "...",
                     "labels": ["ROAD_POTHOLE", ...],            # output order, = taxonomy codes
                     "image_size": 224, "mean": [...], "std": [...], "interpolation": "bilinear",
                     "classifier": {"input_name": "input", "output_name": "logits",
                                    "output_type": "logits", "temperature": 1.0},
                     "files": {"model": {"path": "model.onnx", "sha256": "..."}}}
    model.onnx      input: float32 NCHW, output: (N, len(labels)) logits or probabilities

`temperature` lets you apply post-hoc calibration (temperature scaling fitted on a validation set)
so that the confidence thresholds mean what they say.
"""
import logging
import threading
from pathlib import Path
from typing import Sequence

import numpy as np
from PIL import Image

from backend.app.ml.artifacts import (
    create_onnx_session, declared_quantization, load_manifest, onnx_session_spec, resolve_artifact,
)
from backend.app.ml.base import (
    CivicIssueClassifier, InferenceError, ModelInfo, ModelUnavailableError, softmax,
)
from backend.app.ml.preprocessing import resize_center_crop_normalize

logger = logging.getLogger("nagarnetra.ml")

PROVIDER_NAME = "onnx_classifier"


class OnnxIssueClassifier(CivicIssueClassifier):
    def __init__(self, model_dir: Path, verify_checksums: bool = True, intra_op_threads: int = 0):
        manifest = load_manifest(model_dir)
        if manifest.get("provider") != PROVIDER_NAME:
            raise ModelUnavailableError(
                f"Model in '{model_dir}' is for provider '{manifest.get('provider')}', not '{PROVIDER_NAME}'.")
        cfg = manifest.get("classifier", {})
        model_path = resolve_artifact(model_dir, manifest.get("files", {}).get("model"), "model", verify_checksums)

        self._session = create_onnx_session(model_path, intra_op_threads)
        self._quantization = declared_quantization(model_path.name)
        self._input_name = cfg.get("input_name") or self._session.get_inputs()[0].name
        self._output_name = cfg.get("output_name") or self._session.get_outputs()[0].name
        self._output_type = cfg.get("output_type", "logits")
        if self._output_type not in ("logits", "probabilities"):
            raise ModelUnavailableError(f"Unsupported classifier output_type '{self._output_type}'.")
        self._temperature = float(cfg.get("temperature", 1.0))
        if self._temperature <= 0:
            raise ModelUnavailableError("classifier.temperature must be > 0.")
        self._image_size = int(manifest.get("image_size", 224))
        self._mean = tuple(manifest.get("mean", (0.485, 0.456, 0.406)))
        self._std = tuple(manifest.get("std", (0.229, 0.224, 0.225)))
        self._interpolation = manifest.get("interpolation", "bilinear")
        self._lock = threading.Lock()
        self._info = ModelInfo(
            provider=PROVIDER_NAME,
            model_id=str(manifest.get("model_id", "unknown")),
            version=str(manifest.get("artifact_version", "unknown")),
            labels=tuple(manifest["labels"]),
        )
        logger.info("Loaded %s model %s (%d labels)", PROVIDER_NAME, self._info.model_id, len(self._info.labels))

    @property
    def info(self) -> ModelInfo:
        return self._info

    def inference_spec(self) -> dict:
        spec = onnx_session_spec(self._session)
        spec.update({
            "input_dimensions": {"channels": 3, "height": self._image_size, "width": self._image_size,
                                 "layout": "NCHW"},
            "preprocessing": {
                "resize": f"shorter side to {self._image_size}px, center crop {self._image_size}x{self._image_size}",
                "interpolation": self._interpolation,
                "scaling": "pixel / 255",
                "normalization": "per-channel (x - mean) / std",
                "mean": [float(m) for m in self._mean],
                "std": [float(s) for s in self._std],
            },
            "data_type": "float32",
            "output_type": self._output_type,
            "temperature": self._temperature,
        })
        if self._quantization:
            spec["quantization"] = self._quantization
        return spec

    def predict_proba_batch(self, images: Sequence[Image.Image]) -> np.ndarray:
        if not images:
            return np.zeros((0, len(self._info.labels)), dtype=np.float32)
        pixels = resize_center_crop_normalize(
            images, self._image_size, self._mean, self._std, self._interpolation)
        try:
            with self._lock:
                (outputs,) = self._session.run([self._output_name], {self._input_name: pixels})
        except Exception as exc:
            raise InferenceError(f"ONNX classifier failed: {exc}") from exc
        outputs = np.asarray(outputs, dtype=np.float32)
        if outputs.ndim != 2 or outputs.shape[1] != len(self._info.labels):
            raise InferenceError(
                f"Classifier output shape {outputs.shape} does not match {len(self._info.labels)} labels.")
        if self._output_type == "probabilities":
            probs = np.clip(outputs, 0.0, None)
            return probs / np.clip(probs.sum(axis=1, keepdims=True), 1e-12, None)
        return softmax(outputs / self._temperature, axis=1)
