"""
Idempotent demo ticket NN-2026-001048: a pothole complaint with a citizen voice note.

Runs on every startup (after seed_database) and only inserts what is missing, so it also works on
databases that were seeded before voice notes existed. The voice note goes through the same
validation/storage code as real uploads (services/voice_note_service.py).

Audio asset: assets/NN-2026-001048_voice.webm is SYNTHETIC demo speech (open-source Piper TTS,
hi_IN "pratham" voice reading the Marathi sentence below), encoded as WebM/Opus like a browser
MediaRecorder upload. `transcript_original` is the real output of the bundled Whisper turbo model
on that file; `transcript_final` is the citizen-corrected text (what the citizen edits in Step 1).
The sample's image-AI block mirrors the requested demo values and is marked source="seed_sample";
live tickets get server-computed values from POST /complaints/with-media.
"""
import datetime
from pathlib import Path

from backend.app.config import settings
from backend.app.database import SessionLocal
from backend.app.models.models import Attachment, Category, Complaint, ComplaintEvent, VoiceNote
from backend.app.services.voice_note_service import VOICE_DIR

DEMO_REF = "NN-2026-001048"
DEMO_VOICE_ID = "vn_demo_nn2026001048"
ASSET = Path(__file__).resolve().parent / "assets" / "NN-2026-001048_voice.webm"            # original
PLAYBACK_ASSET = Path(__file__).resolve().parent / "assets" / "NN-2026-001048_voice.wav"    # 16 kHz rendition
ORIGINAL_REL = f"{VOICE_DIR}/{'vn_demo_nn2026001048'}.webm"
PLAYBACK_REL = f"{VOICE_DIR}/{'vn_demo_nn2026001048'}.wav"


def _install_demo_audio() -> float:
    """Copy the demo recording into the uploads store (no audio decoding needed). Returns duration (s)."""
    import shutil
    import wave
    target_dir = Path(settings.UPLOAD_DIR) / VOICE_DIR
    target_dir.mkdir(parents=True, exist_ok=True)
    for src, rel in ((ASSET, ORIGINAL_REL), (PLAYBACK_ASSET, PLAYBACK_REL)):
        dst = Path(settings.UPLOAD_DIR) / rel
        if not dst.is_file() or dst.stat().st_size != src.stat().st_size:
            shutil.copyfile(src, dst)
    with wave.open(str(PLAYBACK_ASSET), "rb") as wav:
        return round(wav.getnframes() / wav.getframerate(), 2)
PHOTO_URL = "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=800&q=80"

TRANSCRIPT_STT = "या रस्तियावर मोठा खड़ा आहे, आनी रात्री वाहन चालो दाना खुब तरास होतो।"
TRANSCRIPT_FINAL = "या रस्त्यावर मोठा खड्डा आहे आणि रात्री वाहन चालवताना खूप त्रास होतो."

SAMPLE_IMAGE_AI = {
    "status": "success",
    "source": "seed_sample",
    "recommended_issue_code": "ROAD_POTHOLE",
    "predictions": [
        {"rank": 1, "issue_code": "ROAD_POTHOLE", "issue_name": "Road Potholes", "issue_name_mr": "रस्त्यावरील खड्डे",
         "confidence": 0.94, "confidence_band": "strong", "recommended": True, "category_id": "cat_pothole",
         "app_category_id": "roads_potholes"},
        {"rank": 2, "issue_code": "ROAD_SURFACE_DAMAGE", "issue_name": "Road Surface Damage",
         "issue_name_mr": "रस्त्याचा पृष्ठभाग खराब / तडे", "confidence": 0.78, "confidence_band": "suggestion",
         "recommended": False, "category_id": "cat_pothole", "app_category_id": "roads_potholes"},
        {"rank": 3, "issue_code": "ROAD_DIVIDER_DAMAGE", "issue_name": "Road Divider / Median Broken",
         "issue_name_mr": "रस्ता दुभाजक तुटलेला", "confidence": 0.31, "confidence_band": "insufficient",
         "recommended": False, "category_id": "cat_other", "app_category_id": "roads_divider"},
    ],
}


def ensure_demo_voice_ticket() -> None:
    db = SessionLocal()
    try:
        category = db.query(Category).filter(Category.id == "cat_pothole", Category.corporation_id == "SMKMC").first()
        if category is None:
            return  # corporation not seeded
        now = datetime.datetime(2026, 10, 7, 9, 30, 0)

        complaint = db.query(Complaint).filter(Complaint.id == DEMO_REF).first()
        if complaint is None:
            complaint = Complaint(
                id=DEMO_REF, corporation_id="SMKMC", citizen_id="usr_9822014589", citizen_name="Sunita Patil",
                citizen_mobile="9822014589", category_id="cat_pothole", description=TRANSCRIPT_FINAL,
                audio_transcript=TRANSCRIPT_FINAL,
                ai_scores={"image_classification": SAMPLE_IMAGE_AI, "citizen_accepted_issue_code": "ROAD_POTHOLE",
                           "app_category_id": "roads_potholes"},
                latitude=16.8524, longitude=74.5815, address="Opposite Walchand College Gate, Vishrambag, Ward 12 (DEMO)",
                ward_id="ward_12", unit_id="unit_roads", assignee_id="usr_fo_roads", status="ASSIGNED",
                priority="HIGH", photo_verified=True, created_at=now,
                response_due=now + datetime.timedelta(hours=48), resolution_due=now + datetime.timedelta(hours=72),
                channel="app",
            )
            db.add(complaint)
            db.add(ComplaintEvent(complaint_id=DEMO_REF, actor_id="usr_9822014589", actor_name="Sunita Patil",
                                  actor_role="citizen", action="COMPLAINT_SUBMITTED", to_status="ASSIGNED",
                                  comment="Complaint registered via app with photo and voice note.", created_at=now))
            db.add(Attachment(id=f"att_{DEMO_REF}_before_1", complaint_id=DEMO_REF, attachment_type="before",
                              file_path=PHOTO_URL, is_verified=True))
            db.flush()

        note = db.query(VoiceNote).filter(VoiceNote.id == DEMO_VOICE_ID).first()
        if ASSET.is_file() and PLAYBACK_ASSET.is_file():
            duration = _install_demo_audio()   # (re)installs files if missing, e.g. after deleting uploads
            if note is None:
                note = VoiceNote(
                    id=DEMO_VOICE_ID, corporation_id="SMKMC", complaint_id=DEMO_REF, uploaded_by="usr_9822014589",
                    original_path=ORIGINAL_REL, original_mime_type="audio/webm", playback_path=PLAYBACK_REL,
                    size_bytes=ASSET.stat().st_size, duration_seconds=duration, language="mr",
                    transcript_original=TRANSCRIPT_STT, transcript_final=TRANSCRIPT_FINAL,
                    transcription_status="completed", transcription_provider="whisper/whisper-turbo",
                    created_at=now, updated_at=now,
                )
                db.add(note)
            complaint.audio_url = note.audio_url
        db.commit()
    finally:
        db.close()
