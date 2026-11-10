import asyncio
import threading
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.database import get_db
from backend.app.models.models import User
from backend.app.schemas.voice import VoiceNoteOut, VoiceTranscriptUpdate
from backend.app.services.auth_service import get_current_user_optional
from backend.app.services.voice_note_service import (
    VoiceNoteNotFound, create_voice_note, get_voice_note, load_decoded, normalize_language,
    run_transcription, validate_audio,
)
from backend.app.speech.audio import AudioValidationError
from backend.app.speech.registry import SpeechRegistry, get_speech_registry

router = APIRouter(prefix="/voice-notes", tags=["voice"])

_stt_slots = threading.BoundedSemaphore(1)  # CPU-heavy: one transcription at a time
_MULTIPART_OVERHEAD = 64 * 1024


def _err(status: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status, detail={"code": code, "message": message})


def _corp(user: Optional[User]) -> str:
    return user.corporation_id if user and user.corporation_id else "SMKMC"


def _transcribe_with_timeout(registry: SpeechRegistry, audio, language) -> dict:
    if not _stt_slots.acquire(timeout=settings.STT_TIMEOUT_SECONDS):
        return {"transcription_status": "failed", "transcription_error": "Speech service busy"}
    try:
        return run_transcription(registry, audio, language)
    finally:
        _stt_slots.release()


async def _transcribe(registry: SpeechRegistry, audio, language) -> dict:
    try:
        return await asyncio.wait_for(
            run_in_threadpool(_transcribe_with_timeout, registry, audio, language),
            timeout=settings.STT_TIMEOUT_SECONDS)
    except asyncio.TimeoutError:
        return {"transcription_status": "failed", "transcription_error": "Transcription timed out"}


@router.post("", response_model=VoiceNoteOut, status_code=201,
             summary="Upload a citizen voice recording, store it and transcribe it")
async def upload_voice_note(
    request: Request,
    audio: Optional[UploadFile] = File(None, description="Recording (webm/opus, ogg, m4a/mp4, wav, mp3)"),
    language: Optional[str] = Form(None, description="Spoken language: mr | hi | en (omit to auto-detect)"),
    transcribe: bool = Form(True),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
    registry: SpeechRegistry = Depends(get_speech_registry),
):
    length = request.headers.get("content-length")
    if length and length.isdigit() and int(length) > settings.VOICE_MAX_BYTES + _MULTIPART_OVERHEAD:
        raise _err(413, "AUDIO_TOO_LARGE", "The recording is too large.")
    if audio is None:
        raise _err(400, "NO_AUDIO", "Please attach a voice recording.")
    data = await audio.read(settings.VOICE_MAX_BYTES + 1)
    if len(data) > settings.VOICE_MAX_BYTES:
        raise _err(413, "AUDIO_TOO_LARGE", f"The recording is larger than {settings.VOICE_MAX_BYTES // 1_048_576} MB.")

    try:
        decoded = await run_in_threadpool(validate_audio, data)
    except AudioValidationError as exc:
        status = 413 if exc.code in ("AUDIO_TOO_LARGE", "AUDIO_TOO_LONG") else 503 if exc.code == "AUDIO_DECODER_MISSING" else 400
        raise _err(status, exc.code, exc.message)

    lang = normalize_language(language)
    transcription = await _transcribe(registry, decoded, lang) if transcribe else \
        {"transcription_status": "pending"}
    try:
        note = await run_in_threadpool(
            create_voice_note, db, _corp(current_user), current_user.id if current_user else None,
            data, decoded, transcription.pop("language", None) or lang, transcription)
    except OSError:
        raise _err(507, "STORAGE_FAILED", "The voice note could not be stored.")
    return note


@router.get("/{note_id}", response_model=VoiceNoteOut)
def read_voice_note(note_id: str, db: Session = Depends(get_db),
                    current_user: Optional[User] = Depends(get_current_user_optional)):
    try:
        return get_voice_note(db, note_id, _corp(current_user))
    except VoiceNoteNotFound:
        raise _err(404, "VOICE_NOTE_NOT_FOUND", "Voice note not found.")


@router.patch("/{note_id}/transcript", response_model=VoiceNoteOut,
              summary="Save the citizen-edited transcript (before the complaint is submitted)")
def update_transcript(note_id: str, payload: VoiceTranscriptUpdate, db: Session = Depends(get_db),
                      current_user: Optional[User] = Depends(get_current_user_optional)):
    try:
        note = get_voice_note(db, note_id, _corp(current_user))
    except VoiceNoteNotFound:
        raise _err(404, "VOICE_NOTE_NOT_FOUND", "Voice note not found.")
    if note.complaint_id:
        raise _err(409, "VOICE_NOTE_LOCKED", "The transcript of a submitted complaint cannot be changed.")
    note.transcript_final = payload.transcript.strip()
    db.commit()
    db.refresh(note)
    return note


@router.post("/{note_id}/transcribe", response_model=VoiceNoteOut, summary="Retry speech-to-text")
async def retry_transcription(note_id: str, language: Optional[str] = Form(None),
                              db: Session = Depends(get_db),
                              current_user: Optional[User] = Depends(get_current_user_optional),
                              registry: SpeechRegistry = Depends(get_speech_registry)):
    try:
        note = get_voice_note(db, note_id, _corp(current_user))
    except VoiceNoteNotFound:
        raise _err(404, "VOICE_NOTE_NOT_FOUND", "Voice note not found.")
    if note.complaint_id:
        raise _err(409, "VOICE_NOTE_LOCKED", "Voice note is already attached to a complaint.")
    decoded = await run_in_threadpool(load_decoded, note)
    lang = normalize_language(language) or note.language
    result = await _transcribe(registry, decoded, lang)
    note.language = result.pop("language", None) or lang
    for key, value in result.items():
        setattr(note, key, value)
    db.commit()
    db.refresh(note)
    return note
