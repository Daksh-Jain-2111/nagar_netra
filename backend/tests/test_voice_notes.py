"""
Voice complaint tests: real audio decoding/storage with a stub speech provider (deterministic),
plus a real Whisper test that runs when the speech model is installed.
"""
import io
import json
from pathlib import Path

import av
import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from backend.app.config import settings
from backend.app.main import app
from backend.app.seed.seed_data import seed_database
from backend.app.services.auth_service import create_access_token
from backend.app.speech.base import SpeechToTextProvider, SpeechUnavailableError, TranscriptionResult
from backend.app.speech.registry import SpeechRegistry, get_speech_registry

DEMO_ASSET = Path(__file__).resolve().parents[1] / "app" / "seed" / "assets" / "NN-2026-001048_voice.webm"


def webm_tone(seconds=1.5, freq=440.0) -> bytes:
    """A real WebM/Opus file, like a browser MediaRecorder upload."""
    sr = 48000
    t = np.arange(int(seconds * sr)) / sr
    samples = (0.3 * np.sin(2 * np.pi * freq * t)).astype(np.float32)
    buf = io.BytesIO()
    with av.open(buf, "w", format="webm") as out:
        stream = out.add_stream("libopus", rate=sr)
        stream.layout = "mono"
        frame = av.AudioFrame.from_ndarray(samples.reshape(1, -1), format="flt", layout="mono")
        frame.sample_rate = sr
        for f in av.AudioResampler(format="s16", layout="mono", rate=sr).resample(frame):
            for packet in stream.encode(f):
                out.mux(packet)
        for packet in stream.encode(None):
            out.mux(packet)
    return buf.getvalue()


def silent_wav(seconds=1.0) -> bytes:
    import wave
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(16000)
        w.writeframes(b"\x00\x00" * int(16000 * seconds))
    return buf.getvalue()


class StubSTT(SpeechToTextProvider):
    name = "stub"

    @property
    def model_id(self):
        return "stub"

    def transcribe(self, audio, language=None):
        return TranscriptionResult(text=f"इथे कचरा पडलेला आहे ({audio.duration_seconds:.0f}s)", language=language or "mr",
                                   provider="stub", model_id="stub")


class StubRegistry(SpeechRegistry):
    def __init__(self, provider=None, error=None):
        super().__init__("stub", ".", 0)
        self._p, self._e = provider, error

    def get(self):
        if self._e:
            raise self._e
        return self._p


@pytest.fixture(scope="module")
def client():
    seed_database(force_reseed=False)
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.pop(get_speech_registry, None)


def use_stt(provider=None, error=None):
    app.dependency_overrides[get_speech_registry] = lambda: StubRegistry(provider, error)


def upload(client, data, name="voice.webm", ctype="audio/webm", language="mr"):
    return client.post("/api/v1/voice-notes", data={"language": language},
                       files={"audio": (name, data, ctype)})


def test_upload_stores_original_and_playback_and_transcribes(client):
    use_stt(StubSTT())
    res = upload(client, webm_tone(2.0))
    assert res.status_code == 201, res.text
    note = res.json()
    assert note["id"].startswith("vn_") and note["complaint_id"] is None
    assert note["original_mime_type"] == "audio/webm" and note["mime_type"] == "audio/wav"
    assert 1.8 <= note["duration_seconds"] <= 2.2
    assert note["transcription_status"] == "completed" and note["language"] == "mr"
    assert note["transcript"].startswith("इथे कचरा")
    original = client.get(note["original_audio_url"])
    assert original.status_code == 200 and original.content[:4] == b"\x1a\x45\xdf\xa3"  # EBML (WebM) header
    playback = client.get(note["audio_url"])
    assert playback.status_code == 200 and playback.content[:4] == b"RIFF"


def test_transcription_unavailable_still_saves_recording(client):
    use_stt(error=SpeechUnavailableError("no model"))
    res = upload(client, webm_tone(1.0))
    assert res.status_code == 201
    assert res.json()["transcription_status"] == "unavailable"
    assert res.json()["transcript"] is None


@pytest.mark.parametrize("data,name,status,code", [
    (b"", "empty.webm", 400, "NO_AUDIO"),
    (b"definitely not audio", "x.webm", 400, "INVALID_AUDIO"),
    (None, "silence.wav", 400, "EMPTY_RECORDING"),
])
def test_invalid_audio(client, data, name, status, code):
    use_stt(StubSTT())
    payload = silent_wav() if data is None else data
    if code == "NO_AUDIO":
        res = client.post("/api/v1/voice-notes", data={"language": "mr"})
    else:
        res = upload(client, payload, name=name)
    assert res.status_code == status, res.text
    assert res.json()["detail"]["code"] == code


def test_unsupported_container(client):
    use_stt(StubSTT())
    buf = io.BytesIO()
    Image.new("RGB", (8, 8)).save(buf, format="PNG")
    res = upload(client, buf.getvalue(), name="fake.webm")
    assert res.status_code == 400
    assert res.json()["detail"]["code"] in ("UNSUPPORTED_AUDIO_FORMAT", "INVALID_AUDIO")


def test_too_large_and_too_long(client, monkeypatch):
    use_stt(StubSTT())
    monkeypatch.setattr(settings, "VOICE_MAX_SECONDS", 1.0)
    assert upload(client, webm_tone(2.5)).json()["detail"]["code"] == "AUDIO_TOO_LONG"
    monkeypatch.setattr(settings, "VOICE_MAX_BYTES", 100)
    res = upload(client, webm_tone(1.0))
    assert res.status_code == 413 and res.json()["detail"]["code"] == "AUDIO_TOO_LARGE"


def test_edit_transcript_then_submit_complaint_with_media(client):
    use_stt(StubSTT())
    note = upload(client, webm_tone(1.5)).json()
    edited = "इथे गेल्या दोन दिवसांपासून कचरा पडलेला आहे आणि कोणीही साफ केलेला नाही."
    res = client.patch(f"/api/v1/voice-notes/{note['id']}/transcript", json={"transcript": edited})
    assert res.status_code == 200 and res.json()["transcript"] == edited
    assert res.json()["transcript_original"] != edited          # original STT output is kept

    photo = io.BytesIO()
    Image.new("RGB", (64, 48), (120, 110, 100)).save(photo, format="JPEG")
    payload = {"category_id": "solid_waste", "app_category_id": "solid_waste", "description": edited,
               "audio_transcript": edited, "latitude": 16.8524, "longitude": 74.5815,
               "voice_note_id": note["id"], "accepted_ai_issue_code": "GARBAGE_DUMP"}
    res = client.post("/api/v1/complaints/with-media", data={"payload": json.dumps(payload)},
                      files=[("photos", ("p.jpg", photo.getvalue(), "image/jpeg"))])
    assert res.status_code == 201, res.text
    c = res.json()
    assert c["category_id"] == "cat_garbage"                     # resolved server-side, not trusted from client
    assert c["voice_note"]["id"] == note["id"] and c["voice_note"]["complaint_id"] == c["id"]
    assert c["voice_note"]["transcript"] == edited
    assert len(c["photo_urls"]) == 1 and client.get(c["photo_urls"][0]).status_code == 200
    assert c["ai_scores"]["citizen_accepted_issue_code"] == "GARBAGE_DUMP"
    assert "image_classification" in c["ai_scores"]

    # transcript is locked once submitted; the same voice note cannot be reused
    assert client.patch(f"/api/v1/voice-notes/{note['id']}/transcript", json={"transcript": "x"}).status_code == 409
    again = client.post("/api/v1/complaints/with-media", data={"payload": json.dumps(payload)})
    assert again.status_code == 409


def test_demo_voice_ticket_for_field_officer(client):
    token = create_access_token({"sub": "usr_fo_roads", "role": "field_officer", "corp": "SMKMC"})
    res = client.get("/api/v1/complaints/NN-2026-001048", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    c = res.json()
    assert c["status"] == "ASSIGNED" and c["category_id"] == "cat_pothole"
    vn = c["voice_note"]
    assert vn["language"] == "mr" and "खड्डा" in vn["transcript"]
    audio = client.get(vn["audio_url"])
    assert audio.status_code == 200 and len(audio.content) > 10_000
    preds = c["ai_scores"]["image_classification"]["predictions"]
    assert [p["issue_code"] for p in preds] == ["ROAD_POTHOLE", "ROAD_SURFACE_DAMAGE", "ROAD_DIVIDER_DAMAGE"]


STT_DIR = Path(settings.STT_MODEL_DIR)


@pytest.mark.skipif(not any(STT_DIR.glob("*-encoder*.onnx")), reason="speech model not installed")
def test_real_whisper_transcribes_marathi(client):
    app.dependency_overrides.pop(get_speech_registry, None)
    res = upload(client, DEMO_ASSET.read_bytes(), language="mr")
    assert res.status_code == 201, res.text
    note = res.json()
    assert note["transcription_status"] == "completed", note
    assert "मोठा" in note["transcript"] and "आहे" in note["transcript"]


def test_wav_upload_and_demo_work_without_pyav(client, monkeypatch):
    """Browsers without MediaRecorder upload WAV; that path (and the demo ticket) must not need PyAV."""
    import backend.app.speech.audio as audio_mod
    use_stt(StubSTT())
    monkeypatch.setattr(audio_mod, "pyav_available", lambda: False)
    wav = (Path(__file__).resolve().parents[1] / "app" / "seed" / "assets" / "NN-2026-001048_voice.wav").read_bytes()
    res = upload(client, wav, name="voice.wav", ctype="audio/wav")
    assert res.status_code == 201, res.text
    assert 5.5 < res.json()["duration_seconds"] < 6.5
    webm = upload(client, webm_tone(1.0))
    assert webm.status_code == 503 and webm.json()["detail"]["code"] == "AUDIO_DECODER_MISSING"
