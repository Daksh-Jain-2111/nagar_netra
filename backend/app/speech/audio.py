"""
Audio validation/decoding for citizen voice notes (PyAV / FFmpeg).

The container and codec are detected from the file content, never from the client's filename or
Content-Type. Output: mono float32 PCM at 16 kHz (what speech models expect) plus a WAV playback
rendition that every browser (incl. Safari) can play and seek.
"""
import io
from typing import Iterable

import numpy as np

from backend.app.speech.base import DecodedAudio

TARGET_SAMPLE_RATE = 16000

ERR_INVALID_AUDIO = "INVALID_AUDIO"
ERR_UNSUPPORTED_AUDIO = "UNSUPPORTED_AUDIO_FORMAT"
ERR_AUDIO_TOO_LARGE = "AUDIO_TOO_LARGE"
ERR_AUDIO_TOO_LONG = "AUDIO_TOO_LONG"
ERR_EMPTY_AUDIO = "EMPTY_RECORDING"
ERR_DECODER_MISSING = "AUDIO_DECODER_MISSING"

# FFmpeg demuxer names -> normalized container label
_CONTAINERS = {
    "matroska,webm": "webm", "webm": "webm", "ogg": "ogg", "wav": "wav",
    "mov,mp4,m4a,3gp,3g2,mj2": "mp4", "mp3": "mp3", "aac": "aac", "flac": "flac",
}


class AudioValidationError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def decode_audio(
    data: bytes,
    allowed_containers: Iterable[str],
    max_bytes: int,
    max_seconds: float,
    min_seconds: float = 0.5,
) -> DecodedAudio:
    if not data:
        raise AudioValidationError(ERR_EMPTY_AUDIO, "The recording is empty.")
    if len(data) > max_bytes:
        raise AudioValidationError(
            ERR_AUDIO_TOO_LARGE, f"Recording is larger than {max_bytes // 1_048_576} MB.")
    allowed = {c.strip().lower() for c in allowed_containers if c.strip()}
    if not pyav_available():
        # Without PyAV only plain PCM WAV can be decoded (stdlib). Browser recordings (WebM/Opus,
        # MP4/AAC) need: pip install av
        if data[:4] == b"RIFF" and data[8:12] == b"WAVE" and "wav" in allowed:
            return _finish(_decode_wav_stdlib(data), "wav", "pcm", max_seconds, min_seconds)
        raise AudioValidationError(
            ERR_DECODER_MISSING,
            "Server cannot decode this audio format: the PyAV package is not installed (pip install av).")

    import av
    try:
        with av.open(io.BytesIO(data), mode="r") as container:
            fmt = _CONTAINERS.get(container.format.name, container.format.name)
            if fmt not in allowed:
                raise AudioValidationError(
                    ERR_UNSUPPORTED_AUDIO,
                    f"Unsupported audio format '{fmt}'. Allowed: {', '.join(sorted(allowed))}.")
            if not container.streams.audio:
                raise AudioValidationError(ERR_INVALID_AUDIO, "The file contains no audio track.")
            stream = container.streams.audio[0]
            codec = stream.codec_context.name
            resampler = av.AudioResampler(format="flt", layout="mono", rate=TARGET_SAMPLE_RATE)
            chunks = []
            total = 0
            limit = int((max_seconds + 1) * TARGET_SAMPLE_RATE)
            for frame in container.decode(stream):
                for out in resampler.resample(frame):
                    arr = out.to_ndarray().reshape(-1)
                    chunks.append(arr)
                    total += arr.shape[0]
                if total > limit:
                    raise AudioValidationError(
                        ERR_AUDIO_TOO_LONG, f"Recording is longer than {int(max_seconds)} seconds.")
            for out in resampler.resample(None):
                chunks.append(out.to_ndarray().reshape(-1))
    except AudioValidationError:
        raise
    except Exception as exc:  # av.error.* (InvalidDataError, ...) and truncated files
        raise AudioValidationError(ERR_INVALID_AUDIO, "The audio file is corrupted or unreadable.") from exc

    samples = np.concatenate(chunks).astype(np.float32) if chunks else np.zeros(0, dtype=np.float32)
    return _finish(samples, fmt, codec, max_seconds, min_seconds)


def _finish(samples: np.ndarray, fmt: str, codec: str, max_seconds: float, min_seconds: float) -> DecodedAudio:
    duration = samples.shape[0] / TARGET_SAMPLE_RATE
    if duration > max_seconds:
        raise AudioValidationError(ERR_AUDIO_TOO_LONG, f"Recording is longer than {int(max_seconds)} seconds.")
    if duration < min_seconds or not np.any(np.abs(samples) > 1e-4):
        raise AudioValidationError(ERR_EMPTY_AUDIO, "The recording is empty or silent.")
    return DecodedAudio(samples=samples, sample_rate=TARGET_SAMPLE_RATE,
                        duration_seconds=round(duration, 2), container=fmt, codec=codec)


def pyav_available() -> bool:
    try:
        import av  # noqa: F401
        return True
    except ImportError:
        return False


def _decode_wav_stdlib(data: bytes) -> np.ndarray:
    """PCM WAV -> mono float32 at 16 kHz using only the standard library + numpy."""
    import wave

    try:
        with wave.open(io.BytesIO(data), "rb") as wav:
            channels, width, rate, frames = wav.getnchannels(), wav.getsampwidth(), wav.getframerate(), wav.getnframes()
            raw = wav.readframes(frames)
    except (wave.Error, EOFError) as exc:
        raise AudioValidationError(ERR_INVALID_AUDIO, "The WAV file is corrupted or not PCM.") from exc
    if width == 2:
        pcm = np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768.0
    elif width == 1:
        pcm = (np.frombuffer(raw, dtype=np.uint8).astype(np.float32) - 128.0) / 128.0
    elif width == 4:
        pcm = np.frombuffer(raw, dtype="<i4").astype(np.float32) / 2147483648.0
    else:
        raise AudioValidationError(ERR_UNSUPPORTED_AUDIO, f"Unsupported WAV sample width {width}.")
    if channels > 1:
        pcm = pcm[: len(pcm) - len(pcm) % channels].reshape(-1, channels).mean(axis=1)
    if rate != TARGET_SAMPLE_RATE and len(pcm):
        n_out = int(round(len(pcm) * TARGET_SAMPLE_RATE / rate))
        pcm = np.interp(np.linspace(0, len(pcm) - 1, n_out), np.arange(len(pcm)), pcm).astype(np.float32)
    return pcm.astype(np.float32)


def to_wav_bytes(audio: DecodedAudio) -> bytes:
    """16-bit PCM mono WAV playback rendition (universally playable and seekable)."""
    import wave

    pcm = (np.clip(audio.samples, -1.0, 1.0) * 32767.0).astype("<i2").tobytes()
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(audio.sample_rate)
        wav.writeframes(pcm)
    return buf.getvalue()
