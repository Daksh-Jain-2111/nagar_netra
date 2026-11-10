"""Process-wide speech-to-text provider registry (lazy, thread-safe, swappable via settings)."""
import logging
import threading
import time
from typing import Optional

from backend.app.config import settings
from backend.app.speech.base import SpeechToTextProvider, SpeechUnavailableError

logger = logging.getLogger("nagarnetra.speech")
_RETRY_AFTER_FAILURE_SECONDS = 30.0


class SpeechRegistry:
    def __init__(self, provider: str, model_dir: str, intra_op_threads: int = 0):
        self.provider = (provider or "").strip().lower()
        self.model_dir = model_dir
        self.intra_op_threads = intra_op_threads
        self._instance: Optional[SpeechToTextProvider] = None
        self._last_error: Optional[str] = None
        self._failed_at = 0.0
        self._lock = threading.Lock()

    def get(self) -> SpeechToTextProvider:
        if self._instance is not None:
            return self._instance
        with self._lock:
            if self._instance is not None:
                return self._instance
            if self._last_error and time.monotonic() - self._failed_at < _RETRY_AFTER_FAILURE_SECONDS:
                raise SpeechUnavailableError(self._last_error)
            try:
                if self.provider in ("", "disabled", "none"):
                    raise SpeechUnavailableError("Speech-to-text is disabled (STT_PROVIDER=disabled).")
                from backend.app.speech.providers import PROVIDERS
                cls = PROVIDERS.get(self.provider)
                if cls is None:
                    raise SpeechUnavailableError(f"Unknown STT_PROVIDER '{self.provider}'.")
                self._instance = cls(self.model_dir, self.intra_op_threads)
                self._last_error = None
                return self._instance
            except SpeechUnavailableError as exc:
                self._last_error = str(exc)
                self._failed_at = time.monotonic()
                logger.warning("Speech-to-text unavailable: %s", exc)
                raise


_registry = SpeechRegistry(settings.STT_PROVIDER, settings.STT_MODEL_DIR, settings.STT_INTRA_OP_THREADS)


def get_speech_registry() -> SpeechRegistry:
    """FastAPI dependency (override in tests)."""
    return _registry


def preload_speech_model() -> None:
    try:
        started = time.perf_counter()
        _registry.get()
        logger.info("Speech model ready in %.1fs", time.perf_counter() - started)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Speech model not loaded at startup: %s", exc)
