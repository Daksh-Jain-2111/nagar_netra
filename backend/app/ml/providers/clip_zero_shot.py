"""
Zero-shot civic issue classifier built on a CLIP image encoder exported to ONNX.

How it works:
  1. Offline (backend/ml/build_clip_model.py): every issue code gets several natural-language
     prompts ("a photo of a deep pothole on an asphalt road", ...). The CLIP text encoder embeds
     them; the per-issue mean embedding is stored in `class_embeddings.npy`, and the image encoder
     is exported to ONNX (int8-quantized).
  2. Online (this file): the photo is embedded by the ONNX image encoder and compared (cosine
     similarity * CLIP logit scale) with each issue embedding; softmax gives a probability per issue.

This is real visual inference, but it is NOT trained on civic complaint photos. Treat it as a
baseline until a fine-tuned model (see onnx_classifier.py and backend/ml/README.md) replaces it.
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

PROVIDER_NAME = "clip_zero_shot"


class ClipZeroShotClassifier(CivicIssueClassifier):
    def __init__(self, model_dir: Path, verify_checksums: bool = True, intra_op_threads: int = 0):
        manifest = load_manifest(model_dir)
        if manifest.get("provider") != PROVIDER_NAME:
            raise ModelUnavailableError(
                f"Model in '{model_dir}' is for provider '{manifest.get('provider')}', not '{PROVIDER_NAME}'.")
        files = manifest.get("files", {})
        clip_cfg = manifest.get("clip", {})

        encoder_path = resolve_artifact(model_dir, files.get("vision_encoder"), "vision_encoder", verify_checksums)
        embeddings_path = resolve_artifact(model_dir, files.get("class_embeddings"), "class_embeddings", verify_checksums)

        labels = tuple(manifest["labels"])
        class_embeddings = np.load(embeddings_path, allow_pickle=False).astype(np.float32)
        # Each embedding row belongs to a label; a label may own several rows (e.g. the reject
        # class keeps one row per "not a civic issue" concept). Default: one row per label.
        row_labels = np.asarray(manifest.get("embedding_labels", list(range(len(labels)))), dtype=np.int64)
        if class_embeddings.ndim != 2 or class_embeddings.shape[0] != row_labels.shape[0]:
            raise ModelUnavailableError(
                f"class_embeddings shape {class_embeddings.shape} does not match embedding_labels.")
        if row_labels.min() < 0 or row_labels.max() >= len(labels) or \
                len(np.unique(row_labels)) != len(labels):
            raise ModelUnavailableError("embedding_labels must reference every label at least once.")
        norms = np.linalg.norm(class_embeddings, axis=1, keepdims=True)
        self._class_embeddings = class_embeddings / np.clip(norms, 1e-12, None)
        self._row_labels = row_labels

        self._session = create_onnx_session(encoder_path, intra_op_threads)
        self._quantization = declared_quantization(encoder_path.name)
        self._input_name = clip_cfg.get("input_name") or self._session.get_inputs()[0].name
        self._output_name = clip_cfg.get("output_name") or self._session.get_outputs()[0].name
        self._logit_scale = float(clip_cfg.get("logit_scale", 100.0))
        self._image_size = int(manifest.get("image_size", 224))
        self._mean = tuple(manifest.get("mean", (0.48145466, 0.4578275, 0.40821073)))
        self._std = tuple(manifest.get("std", (0.26862954, 0.26130258, 0.27577711)))
        self._interpolation = manifest.get("interpolation", "bicubic")
        self._lock = threading.Lock()  # ORT sessions are thread-safe; lock keeps CPU use predictable
        self._info = ModelInfo(
            provider=PROVIDER_NAME,
            model_id=str(manifest.get("model_id", "unknown")),
            version=str(manifest.get("artifact_version", "unknown")),
            labels=labels,
        )

        output_dim = self._session.get_outputs()[0].shape[-1]
        if isinstance(output_dim, int) and output_dim != self._class_embeddings.shape[1]:
            raise ModelUnavailableError(
                f"Image embedding dim {output_dim} != class embedding dim {self._class_embeddings.shape[1]}.")
        logger.info("Loaded %s model %s (%d labels)", PROVIDER_NAME, self._info.model_id, len(labels))

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
            "logit_scale": self._logit_scale,
            "embedding_dim": int(self._class_embeddings.shape[1]),
            "class_embedding_rows": int(self._class_embeddings.shape[0]),
            "output_activation": "softmax over per-label max cosine similarity x logit_scale",
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
                (embeddings,) = self._session.run([self._output_name], {self._input_name: pixels})
        except Exception as exc:
            raise InferenceError(f"CLIP image encoder failed: {exc}") from exc
        embeddings = embeddings.astype(np.float32)
        embeddings /= np.clip(np.linalg.norm(embeddings, axis=1, keepdims=True), 1e-12, None)
        row_logits = self._logit_scale * embeddings @ self._class_embeddings.T
        # label logit = best-matching row of that label
        logits = np.full((row_logits.shape[0], len(self._info.labels)), -np.inf, dtype=np.float32)
        for label_idx in range(len(self._info.labels)):
            logits[:, label_idx] = row_logits[:, self._row_labels == label_idx].max(axis=1)
        return softmax(logits, axis=1)
