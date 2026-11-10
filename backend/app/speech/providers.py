"""Speech-to-text providers."""
import logging
from pathlib import Path
from typing import Optional

from backend.app.speech.base import (
    SUPPORTED_LANGUAGES, DecodedAudio, SpeechToTextProvider, SpeechUnavailableError,
    TranscriptionError, TranscriptionResult,
)

logger = logging.getLogger("nagarnetra.speech")


class WhisperOnnxProvider(SpeechToTextProvider):
    """
    Offline OpenAI Whisper (multilingual: Marathi, Hindi, English, ...) on ONNX Runtime.
    Model files: <model_dir>/<name>-encoder.int8.onnx, <name>-decoder.int8.onnx, <name>-tokens.txt
    (install with: python backend/scripts/download_speech_model.py).
    """
    name = "whisper_onnx"

    def __init__(self, model_dir: Path, intra_op_threads: int = 0):
        model_dir = Path(model_dir)
        encoders = sorted(model_dir.glob("*-encoder.int8.onnx")) or sorted(model_dir.glob("*-encoder.onnx"))
        if not encoders:
            raise SpeechUnavailableError(
                f"Whisper model not found in '{model_dir}'. Run: python backend/scripts/download_speech_model.py")
        encoder = encoders[0]
        prefix = encoder.name.split("-encoder")[0]
        suffix = encoder.name.split("-encoder")[1]
        decoder = model_dir / f"{prefix}-decoder{suffix}"
        tokens = model_dir / f"{prefix}-tokens.txt"
        missing = [p.name for p in (decoder, tokens) if not p.is_file()]
        if missing:
            raise SpeechUnavailableError(f"Whisper model files missing: {', '.join(missing)}")
        try:
            from backend.app.speech.whisper_onnx import WhisperOnnx
            self._engine = WhisperOnnx(encoder, decoder, tokens, intra_op_threads)
        except ImportError as exc:  # pragma: no cover
            raise SpeechUnavailableError("onnxruntime is not installed.") from exc
        except Exception as exc:
            raise SpeechUnavailableError(f"Could not load Whisper model: {exc}") from exc
        self._model_id = f"whisper/{self._engine.model_type}"
        logger.info("Loaded speech model %s from %s", self._model_id, model_dir)

    @property
    def model_id(self) -> str:
        return self._model_id

    def transcribe(self, audio: DecodedAudio, language: Optional[str] = None) -> TranscriptionResult:
        try:
            lang = language
            if not lang:
                lang = self._engine.detect_language(audio.samples, candidates=SUPPORTED_LANGUAGES)
            text = self._engine.transcribe(audio.samples, lang)
        except Exception as exc:
            raise TranscriptionError(f"Whisper transcription failed: {exc}") from exc
        return TranscriptionResult(text=text, language=lang, provider=self.name, model_id=self._model_id)


PROVIDERS = {"whisper_onnx": WhisperOnnxProvider}
