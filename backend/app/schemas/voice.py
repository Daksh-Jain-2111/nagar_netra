"""Schemas for citizen voice notes."""
import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class VoiceNoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    complaint_id: Optional[str] = None
    audio_url: str = Field(..., description="Playback rendition (WAV) served from the uploads store")
    original_audio_url: str = Field(..., description="Original recording exactly as uploaded")
    mime_type: str
    original_mime_type: str
    duration_seconds: float
    size_bytes: int
    language: Optional[str] = None
    transcript: Optional[str] = Field(None, description="Final transcript (citizen-edited if edited)")
    transcript_original: Optional[str] = Field(None, description="Unedited speech-to-text output")
    transcription_status: str
    transcription_provider: Optional[str] = None
    transcription_error: Optional[str] = None
    created_at: datetime.datetime


class VoiceTranscriptUpdate(BaseModel):
    transcript: str = Field(..., max_length=4000)
