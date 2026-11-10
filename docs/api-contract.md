# NagarNetra SMKMC Civic Governance API Contract

Base URL: `/api/v1`  
Tenant Default: `SMKMC` (Sangli Miraj Kupwad Municipal Corporation)

---

## 1. Authentication & Identity (`/auth`)

### `POST /auth/otp/request`
- **Role**: Public / Citizen
- **Request**: `{"mobile": "9822014589", "corporation_id": "SMKMC"}`
- **Response**: `{"success": true, "mobile": "9822014589", "message": "OTP sent", "mock_otp": "123456"}`

### `POST /auth/otp/verify`
- **Role**: Public / Citizen
- **Request**: `{"mobile": "9822014589", "otp": "123456", "name": "Sunita Patil"}`
- **Response**: `{"access_token": "...", "token_type": "bearer", "user": {"id": "usr_9822014589", "name": "Sunita Patil", "role": "citizen"}}`

### `POST /auth/staff/login`
- **Role**: Municipal Staff (`field_officer`, `supervisor`, `corp_admin`, `helpdesk`, `platform_admin`)
- **Request**: `{"email": "officer.roads@smkmc.demo", "password": "Demo@123"}`
- **Response**: `{"access_token": "...", "token_type": "bearer", "user": {...}}`

### `GET /auth/me`
- **Role**: Authenticated
- **Response**: Current user profile object.

### `POST /auth/refresh`
- **Role**: Authenticated
- **Response**: `{"access_token": "...", "token_type": "bearer", "user": {...}}`

### `POST /auth/logout`
- **Role**: Authenticated
- **Response**: `{"success": true, "message": "Successfully logged out."}`

### `DELETE /auth/me`
- **Role**: `citizen` only (DPDP right to erasure)
- **Response**: `{"success": true, "message": "Account personal data successfully erased per DPDP policy."}`

---

## 2. Complaints Lifecycle (`/complaints`)

### `GET /complaints`
- **Role**: Authenticated
- **Query Params**: `status`, `ward_id`, `category_id`, `priority`, `danger_flag`, `assignee_id`, `supervisor_overdue`, `limit`, `offset`
- **Tenant Isolation**: Strictly scoped to current user's `corporation_id`. Citizens see only their own complaints; field officers see their assigned queue.

### `GET /complaints/public/{ref}`
- **Role**: Public (No auth required)
- **Response**: Status and SLA timings ONLY. Zero citizen personal details (no name, mobile, or citizen ID).

### `GET /complaints/{ref}`
- **Role**: Authenticated
- **Anonymity Rule**: If complaint is anonymous (`is_anonymous = true`), citizen name is masked as `"Anonymous citizen"` and mobile is `null` for all staff roles.

### `POST /complaints`
- **Role**: Authenticated citizen or Anonymous
- **Body**:
  ```json
  {
    "category_id": "cat_pothole",
    "description": "Deep asphalt trench near Vishrambag circle",
    "latitude": 16.8524,
    "longitude": 74.5815,
    "address": "Vishrambag Circle, Ward 12 (DEMO)",
    "ward_id": "ward_12",
    "is_anonymous": false
  }
  ```
- **Response**: Created Complaint object with generated ID (`NN-2026-NNNNNN`), SLA due dates, and initial routing.

### `POST /complaints/{ref}/status`
- **Role**: Enforces Strict Civic State Machine
- **Transitions Matrix**:
  - `SUBMITTED` -> `ASSIGNED` (`supervisor`, `corp_admin`, `helpdesk`)
  - `TO_CHECK` -> `ASSIGNED`, `REJECTED` (`supervisor`, `corp_admin`)
  - `ASSIGNED` -> `IN_PROGRESS`, `WORK_SCHEDULED`, `RESOLVED` (`field_officer`, `supervisor`, `corp_admin`)
  - `IN_PROGRESS` -> `WORK_SCHEDULED`, `RESOLVED` (`field_officer`, `supervisor`, `corp_admin`)
  - `WORK_SCHEDULED` -> `IN_PROGRESS`, `RESOLVED` (`field_officer`, `supervisor`, `corp_admin`)
  - `RESOLVED` -> `REOPENED` (`citizen`, `helpdesk`), `CLOSED` (`citizen`, `corp_admin`)
  - Illegal status jump returns **HTTP 409 Conflict**.
  - Unauthorized role returns **HTTP 403 Forbidden**.

### `POST /complaints/{ref}/resolve`
- **Role**: `field_officer`, `supervisor`, `corp_admin`
- **Body**: `{"resolution_notes": "...", "after_photo_path": "...", "photo_latitude": 16.8524, "photo_longitude": 74.5815}`
- **Photo Verification**: Verifies after-photo within 200m radius of complaint location.

### `POST /complaints/{ref}/reopen`
- **Role**: `citizen`, `helpdesk`
- **Rules**: Allowed within 7 days of `RESOLVED`. Direct reopen up to 2 times. 3rd reopen creates a supervisor approval request.

### `GET /complaints/{ref}/duplicate-candidates`
- **Role**: Authenticated
- **Logic**: Returns candidates with identical category within 100 meters and 7 days.

### `POST /complaints/{ref}/link-duplicate`
- **Role**: `field_officer`, `supervisor`, `corp_admin`
- **Rule**: Parent is strictly the older complaint. Never auto-merged.

### `POST /complaints/{ref}/verify-danger`
- **Role**: `field_officer`, `supervisor`, `corp_admin`
- **Action**: Sets `danger_flag = True` and `danger_verified = True`.

### `GET /complaints/{ref}/timeline`
- **Role**: Authenticated
- **Response**: Complete chronological event log with actors and status transitions.

---

## 3. Supervisor Workflows (`/supervisor`)

### `GET /supervisor/to-check`
- **Role**: `supervisor`, `corp_admin`
- **Response**: List of complaints requiring human verification (low AI confidence, unconfirmed categories).

### `GET /supervisor/escalations`
- **Role**: `supervisor`, `corp_admin`
- **Response**: List of complaints with active L1/L2 escalation flags.

### `POST /supervisor/escalations/{ref}/instruct`
- **Role**: `supervisor`, `corp_admin`
- **Body**: `{"instruction": "..."}`
- **Action**: Issues binding instruction to field officer.

### `POST /supervisor/escalations/{ref}/reassign`
- **Role**: `supervisor`, `corp_admin`
- **Body**: `{"new_assignee_id": "usr_fo_swm", "reason": "..."}`

### `GET /supervisor/performance`
- **Role**: `supervisor`, `corp_admin`
- **Response**: Real computed SLA metrics for division officers (total, resolved, compliance %).

---

## 4. Admin Management (`/admin`)

### `GET /admin/dashboard`
- **Role**: `corp_admin`, `platform_admin`
- **Response**: Live computed metrics (zero hardcoded counts), department and category breakdowns.

### `GET /admin/supervisor-overdue`
- **Role**: `corp_admin`, `platform_admin`
- **Response**: View-only queue for complaints where supervisor took no action for >72h after escalation.

### `GET /admin/reports`
- **Role**: `corp_admin`, `platform_admin`
- **Response**: Ward and channel distribution analytics.

### `GET /admin/audit-log/export.csv`
- **Role**: `corp_admin`, `platform_admin`
- **Response**: CSV file download containing complete immutable civic audit trail.

### `POST /admin/users/invite`
- **Role**: `corp_admin`
- **Restriction**: Roles `supervisor` or `helpdesk` ONLY. Inviting `field_officer` returns **HTTP 403 Forbidden**.

### `GET /admin/settings` & `PUT /admin/settings`
- **Role**: `corp_admin`, `platform_admin`
- **Settings**: `enable_l2` (default false), `ai_confidence_threshold` (0.70).

---

## 5. Platform Administration (`/platform`)

### `GET /platform/corporations` & `POST /platform/corporations`
- **Role**: `platform_admin`

### `POST /platform/corporations/from-template`
- **Role**: `platform_admin`
- **Action**: Bootstraps new corporation from Maharashtra municipal standard template.

### `GET /platform/ai-models`
- **Role**: `platform_admin`
- **Response**: Exactly 3 models (Vision-Text Fusion, Audio Transcription, Geo Dedup). Strictly no accuracy or F1 figures.

---

## 6. AI Image Classification (`/ai`)

### `POST /ai/classify-image`
- **Role**: Public / any (optional bearer token selects the corporation; default `SMKMC`)
- **Body**: `multipart/form-data`
  - `images`: 1–3 files (JPEG / PNG / WEBP, ≤ 8 MB each; the format is detected from the file content)
  - optional, reserved for multimodal models: `description`, `voice_transcript`, `latitude`, `longitude`
  - optional `top_k` (default 3, max 5)
- **Pipeline**: the image model returns a probability for each issue code. Photos are combined with a mean of probabilities to give the Top-K issues. Each issue maps to a category (`backend/app/rules/civic_issue_taxonomy.json`), and the category supplies the department and SLA from the DB.
- **Response 200**:
  ```json
  {
    "status": "success",            // success | low_confidence | no_civic_issue | no_prediction
    "message": "Civic issue identified from the photo(s).",
    "recommended_issue_code": "ROAD_POTHOLE",
    "top_confidence": 0.94,
    "meets_routing_threshold": true,
    "predictions": [
      {"rank": 1, "issue_code": "ROAD_POTHOLE", "issue_name": "Road Potholes", "issue_name_mr": "रस्त्यावरील खड्डे",
       "confidence": 0.94, "confidence_band": "strong", "recommended": true, "mapping_status": "mapped",
       "category_id": "cat_pothole", "app_category_id": "roads_potholes",
       "department_id": "dept_roads", "department_code": "RD", "department_name": "Roads & Traffic Works",
       "department_name_mr": "रस्ते व वाहतूक", "sla_hours": 72, "response_sla_hours": 48,
       "priority": "HIGH", "is_urgent": false, "redirect_target": null}
    ],
    "images": [{"index": 0, "status": "analyzed", "top_issue_code": "ROAD_POTHOLE", "top_confidence": 0.95}],
    "aggregation": {"method": "mean_probability", "images_received": 1, "images_analyzed": 1, "top_issue_agreement": 1},
    "thresholds": {"strong": 0.8, "suggestion": 0.6, "minimum": 0.4, "routing": 0.7},
    "model": {"provider": "clip_zero_shot", "model_id": "open_clip/ViT-B-16/laion400m_e32", "version": "2026.10.0-int8", "taxonomy_version": "2026.10.0"},
    "modalities_used": ["image"], "context_received": {"description": false, "voice_transcript": false, "location": false},
    "latency_ms": 180
  }
  ```
- **Confidence** is the model's probability, not accuracy. Bands: ≥ 0.80 `strong`, ≥ 0.60 `suggestion`, ≥ 0.40 `low`, below that `insufficient`, in which case `status` is `low_confidence` and nothing is recommended. Thresholds are set with the `AI_CONFIDENCE_*` env vars.
- **Errors**: `{"detail": {"code": "...", "message": "..."}}`. 400 `NO_IMAGE` / `TOO_MANY_IMAGES` / `INVALID_IMAGE` / `UNSUPPORTED_FORMAT`; 413 `IMAGE_TOO_LARGE` / `PAYLOAD_TOO_LARGE`; 503 `MODEL_UNAVAILABLE` / `AI_BUSY`; 504 `INFERENCE_TIMEOUT`; 500 `INFERENCE_FAILED`. If at least one photo is valid, the invalid ones are reported in `images[]` with `status: "rejected"` and the request still succeeds.

### `GET /ai/model-status`
- Shows whether the image model is loaded, plus the provider, model id and labels.

---

## 7. Citizen Voice Complaints (`/voice-notes`)

### `POST /voice-notes`
- **Role**: Public / citizen (optional bearer token selects the corporation)
- **Body**: `multipart/form-data` with `audio` (WebM/Opus from the browser MediaRecorder, or OGG / M4A / WAV / MP3, ≤ 10 MB, ≤ 120 s) and `language` (`mr` | `hi` | `en`; leave it out to auto-detect)
- **Action**: Validates the audio by its content, not its filename. Stores the original file **unchanged**, plus a 16 kHz WAV playback copy, under `UPLOAD_DIR/voice_notes/`. Runs speech-to-text (offline Whisper) and keeps the transcript in the language spoken; it is never translated.
- **Response 201**: `{"id": "vn_…", "audio_url": "/api/v1/uploads/voice_notes/vn_….wav", "original_audio_url": "….webm", "duration_seconds": 8.9, "language": "mr", "transcript": "…", "transcript_original": "…", "transcription_status": "completed|failed|unavailable", …}`. If transcription fails, the recording is still saved and `transcription_status` is not `completed`.
- **Errors**: 400 `NO_AUDIO` / `INVALID_AUDIO` / `UNSUPPORTED_AUDIO_FORMAT` / `EMPTY_RECORDING`; 413 `AUDIO_TOO_LARGE` / `AUDIO_TOO_LONG`; 507 `STORAGE_FAILED`.

### `PATCH /voice-notes/{id}/transcript`
- Saves the citizen-edited transcript as `transcript`; `transcript_original` keeps the speech-to-text output. Returns 409 after the note is attached to a complaint.

### `POST /voice-notes/{id}/transcribe`
- Retries speech-to-text, for example after the model has been installed.

### `GET /voice-notes/{id}`
- Returns the voice note's metadata.

### `POST /complaints/with-media`
- **Body**: `multipart/form-data` with `payload` (the `POST /complaints` JSON, plus `voice_note_id`, `app_category_id` and `accepted_ai_issue_code`) and `photos` (0–3 images).
- **Action**: Creates the complaint and resolves its category, department and SLA on the server (client values are not trusted). Re-encodes the photos to `UPLOAD_DIR/complaints/<ref>/` with EXIF stripped, attaches the voice note, sets `audio_url` and `audio_transcript`, and re-runs the image classifier on the stored photos, saving the result to `ai_scores.image_classification`.
- **Response 201**: The complaint, including `photo_urls`, `voice_note` and `ai_scores`. `GET /complaints` and `GET /complaints/{ref}` also include these fields.

---

## 8. Development & Time Travel (`/dev`)

Enabled only when `DEV_MODE=true` (returns 404 in production).

### `POST /dev/time-travel`
- **Body**: `{"hours": 170}`
- **Action**: Advances simulated clock and triggers SLA evaluations.

### `POST /dev/reset-seed`
- **Action**: Resets time travel and cleanly reseeds database.

### `POST /dev/run-scheduler`
- **Action**: Runs SLA check tick immediately.
