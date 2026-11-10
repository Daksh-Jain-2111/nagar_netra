"""
Citizen voice notes: validate -> store (existing UPLOAD_DIR) -> transcribe -> link to complaint.

Storage layout (served read-only at /api/v1/uploads/...):
    voice_notes/<id>.<ext>       original recording, byte-for-byte as uploaded
    voice_notes/<id>.wav         16 kHz mono playback rendition (seekable in every browser)
File names are random 128-bit ids; no client-provided names or paths are used.
"""
import logging
import os
import uuid
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.models.models import VoiceNote
from backend.app.speech.audio import DecodedAudio, decode_audio, to_wav_bytes
from backend.app.speech.base import SUPPORTED_LANGUAGES, SpeechUnavailableError, TranscriptionError
from backend.app.speech.registry import SpeechRegistry

logger = logging.getLogger("nagarnetra.voice")

VOICE_DIR = "voice_notes"
_EXTENSIONS = {"webm": ".webm", "ogg": ".ogg", "mp4": ".m4a", "wav": ".wav", "mp3": ".mp3", "aac": ".aac", "flac": ".flac"}
_MIME = {"webm": "audio/webm", "ogg": "audio/ogg", "mp4": "audio/mp4", "wav": "audio/wav",
         "mp3": "audio/mpeg", "aac": "audio/aac", "flac": "audio/flac"}


class VoiceNoteNotFound(LookupError):
    pass


class VoiceNoteConflict(ValueError):
    pass


def normalize_language(language: Optional[str]) -> Optional[str]:
    lang = (language or "").strip().lower()[:2]
    return lang if lang in SUPPORTED_LANGUAGES else None


def validate_audio(data: bytes) -> DecodedAudio:
    return decode_audio(
        data,
        allowed_containers=settings.VOICE_ALLOWED_CONTAINERS.split(","),
        max_bytes=settings.VOICE_MAX_BYTES,
        max_seconds=settings.VOICE_MAX_SECONDS,
    )


def store_files(note_id: str, data: bytes, audio: DecodedAudio) -> tuple:
    """Write original + playback rendition atomically. Returns (original_rel, playback_rel)."""
    directory = Path(settings.UPLOAD_DIR) / VOICE_DIR
    directory.mkdir(parents=True, exist_ok=True)
    original_rel = f"{VOICE_DIR}/{note_id}{_EXTENSIONS.get(audio.container, '.bin')}"
    playback_rel = f"{VOICE_DIR}/{note_id}.wav" if audio.container != "wav" else None
    for rel, payload in ((original_rel, data), (playback_rel, to_wav_bytes(audio) if playback_rel else None)):
        if rel is None:
            continue
        target = Path(settings.UPLOAD_DIR) / rel
        tmp = target.with_suffix(target.suffix + ".tmp")
        with open(tmp, "wb") as fh:
            fh.write(payload)
        os.replace(tmp, target)
    return original_rel, playback_rel


def run_transcription(registry: SpeechRegistry, audio: DecodedAudio, language: Optional[str]) -> dict:
    """Never raises: returns the fields to store on the VoiceNote."""
    try:
        provider = registry.get()
    except SpeechUnavailableError as exc:
        return {"transcription_status": "unavailable", "transcription_error": str(exc)[:250]}
    try:
        result = provider.transcribe(audio, language)
    except TranscriptionError as exc:
        logger.warning("Transcription failed: %s", exc)
        return {"transcription_status": "failed", "transcription_error": str(exc)[:250],
                "transcription_provider": provider.model_id}
    return {
        "transcription_status": "completed",
        "transcript_original": result.text,
        "language": result.language or language,
        "transcription_provider": result.model_id,
        "transcription_error": None,
    }


def create_voice_note(
    db: Session,
    corporation_id: str,
    uploaded_by: Optional[str],
    data: bytes,
    audio: DecodedAudio,
    language: Optional[str],
    transcription: dict,
) -> VoiceNote:
    note_id = f"vn_{uuid.uuid4().hex}"
    original_rel, playback_rel = store_files(note_id, data, audio)
    note = VoiceNote(
        id=note_id,
        corporation_id=corporation_id,
        uploaded_by=uploaded_by,
        original_path=original_rel,
        original_mime_type=_MIME.get(audio.container, "application/octet-stream"),
        playback_path=playback_rel,
        size_bytes=len(data),
        duration_seconds=audio.duration_seconds,
        language=language,
        **transcription,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


def get_voice_note(db: Session, note_id: str, corporation_id: str) -> VoiceNote:
    note = db.query(VoiceNote).filter(VoiceNote.id == note_id, VoiceNote.corporation_id == corporation_id).first()
    if not note:
        raise VoiceNoteNotFound(note_id)
    return note


def load_decoded(note: VoiceNote) -> DecodedAudio:
    data = (Path(settings.UPLOAD_DIR) / note.original_path).read_bytes()
    return validate_audio(data)


def link_to_complaint(db: Session, note: VoiceNote, complaint, final_transcript: Optional[str]) -> None:
    """Attach an unlinked voice note to a newly created complaint (caller commits)."""
    if note.complaint_id and note.complaint_id != complaint.id:
        raise VoiceNoteConflict("Voice note is already attached to another complaint.")
    note.complaint_id = complaint.id
    if final_transcript is not None and final_transcript.strip():
        note.transcript_final = final_transcript.strip()
    complaint.audio_url = note.audio_url
    complaint.audio_transcript = note.transcript
