"""
Process-wide classifier registry: builds the configured provider lazily, once, thread-safely.
Swap models by changing AI_CLASSIFIER_PROVIDER / AI_MODEL_DIR; nothing else changes.
"""
import logging
import threading
import time
from pathlib import Path
from typing import Optional

from backend.app.config import settings
from backend.app.ml.base import CivicIssueClassifier, ModelUnavailableError

logger = logging.getLogger("nagarnetra.ml")

_RETRY_AFTER_FAILURE_SECONDS = 30.0


class ClassifierRegistry:
    def __init__(self, provider: str, model_dir: str, verify_checksums: bool, intra_op_threads: int):
        self.provider = (provider or "").strip().lower()
        self.model_dir = Path(model_dir)
        self.verify_checksums = verify_checksums
        self.intra_op_threads = intra_op_threads
        self._classifier: Optional[CivicIssueClassifier] = None
        self._last_error: Optional[str] = None
        self._last_failure_at = 0.0
        self._lock = threading.Lock()

    def get(self) -> CivicIssueClassifier:
        if self._classifier is not None:
            return self._classifier
        with self._lock:
            if self._classifier is not None:
                return self._classifier
            if self._last_error and time.monotonic() - self._last_failure_at < _RETRY_AFTER_FAILURE_SECONDS:
                raise ModelUnavailableError(self._last_error)
            try:
                self._classifier = self._build()
                self._last_error = None
                return self._classifier
            except ModelUnavailableError as exc:
                self._last_error = str(exc)
                self._last_failure_at = time.monotonic()
                logger.warning("Civic issue classifier unavailable: %s", exc)
                raise

    def status(self) -> dict:
        return {
            "provider": self.provider,
            "loaded": self._classifier is not None,
            "model_id": self._classifier.info.model_id if self._classifier else None,
            "last_error": self._last_error,
        }

    def _build(self) -> CivicIssueClassifier:
        if self.provider in ("", "disabled", "none"):
            raise ModelUnavailableError("AI image classification is disabled (AI_CLASSIFIER_PROVIDER=disabled).")
        from backend.app.ml.providers import PROVIDERS  # lazy: avoids loading onnxruntime when disabled
        provider_cls = PROVIDERS.get(self.provider)
        if provider_cls is None:
            raise ModelUnavailableError(
                f"Unknown AI_CLASSIFIER_PROVIDER '{self.provider}'. Options: {', '.join(PROVIDERS)} or disabled.")
        return provider_cls(self.model_dir, self.verify_checksums, self.intra_op_threads)


_registry = ClassifierRegistry(
    provider=settings.AI_CLASSIFIER_PROVIDER,
    model_dir=settings.AI_MODEL_DIR,
    verify_checksums=settings.AI_VERIFY_MODEL_CHECKSUM,
    intra_op_threads=settings.AI_ONNX_INTRA_OP_THREADS,
)


def get_classifier_registry() -> ClassifierRegistry:
    """FastAPI dependency (override in tests via app.dependency_overrides)."""
    return _registry


def preload_classifier() -> None:
    """Best-effort warm-up used at startup; never raises."""
    try:
        started = time.perf_counter()
        _registry.get()
        logger.info("Civic issue classifier ready in %.1fs", time.perf_counter() - started)
    except Exception as exc:  # noqa: BLE001 - warm-up must not crash the API
        logger.warning("Civic issue classifier not loaded at startup: %s", exc)
