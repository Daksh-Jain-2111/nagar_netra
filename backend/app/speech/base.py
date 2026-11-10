"""
Speech-to-text contract. Providers are replaceable (offline Whisper, a cloud API, ...); callers only
see `SpeechToTextProvider.transcribe(audio, language)`.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional

import numpy as np

# App language codes (src/utils/l10n.ts) == ISO 639-1 codes used by Whisper.
SUPPORTED_LANGUAGES = ("mr", "hi", "en")


class SpeechUnavailableError(RuntimeError):
    """No speech-to-text provider is configured / its model is not installed."""


class TranscriptionError(RuntimeError):
    """The provider failed while transcribing."""


@dataclass(frozen=True)
class DecodedAudio:
    samples: np.ndarray        # mono float32 PCM at `sample_rate`
    sample_rate: int
    duration_seconds: float
    container: str             # detected container, e.g. "webm", "wav", "mp4"
    codec: str                 # detected codec, e.g. "opus", "pcm_s16le"


@dataclass(frozen=True)
class TranscriptionResult:
    text: str
    language: Optional[str]    # language actually used/detected
    provider: str
    model_id: str


class SpeechToTextProvider(ABC):
    name: str = "base"

    @property
    @abstractmethod
    def model_id(self) -> str:
        ...

    @abstractmethod
    def transcribe(self, audio: DecodedAudio, language: Optional[str] = None) -> TranscriptionResult:
        """Transcribe in the spoken language (no translation). `language=None` means auto-detect."""
