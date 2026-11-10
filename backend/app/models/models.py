import datetime
from sqlalchemy import (
    Column, Integer, String, Boolean, Float, DateTime, ForeignKey, Text, JSON, Enum
)
from sqlalchemy.orm import relationship
from backend.app.database import Base

class Corporation(Base):
    __tablename__ = "corporations"

    id = Column(String(50), primary_key=True)  # e.g. "SMKMC"
    name = Column(String(150), nullable=False)
    name_mr = Column(String(150), nullable=True)
    status = Column(String(20), default="ACTIVE")  # ACTIVE, DRAFT, SUSPENDED
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # relationships
    departments = relationship("Department", back_populates="corporation", cascade="all, delete-orphan")
    org_units = relationship("OrgUnit", back_populates="corporation", cascade="all, delete-orphan")
    wards = relationship("Ward", back_populates="corporation", cascade="all, delete-orphan")
    users = relationship("User", back_populates="corporation", cascade="all, delete-orphan")
    complaints = relationship("Complaint", back_populates="corporation", cascade="all, delete-orphan")


class OrgUnit(Base):
    __tablename__ = "org_units"

    id = Column(String(50), primary_key=True)
    corporation_id = Column(String(50), ForeignKey("corporations.id"), nullable=False)
    name = Column(String(100), nullable=False)
    name_mr = Column(String(100), nullable=True)
    level_type = Column(String(50), nullable=False)  # "Prabhag", "Zone", "Division", "Department Unit"
    parent_id = Column(String(50), ForeignKey("org_units.id"), nullable=True)
    supervisor_id = Column(String(50), nullable=True)
    accepts_complaints = Column(Boolean, default=True)

    corporation = relationship("Corporation", back_populates="org_units")
    children = relationship("OrgUnit", backref="parent", remote_side=[id])


class Ward(Base):
    __tablename__ = "wards"

    id = Column(String(50), primary_key=True)  # e.g. "ward_12"
    corporation_id = Column(String(50), ForeignKey("corporations.id"), nullable=False)
    ward_number = Column(Integer, nullable=False)
    name = Column(String(100), nullable=False)
    name_mr = Column(String(100), nullable=True)
    polygon_geojson = Column(JSON, nullable=True)  # GeoJSON polygon or multipolygon

    corporation = relationship("Corporation", back_populates="wards")


class Department(Base):
    __tablename__ = "departments"

    id = Column(String(50), primary_key=True)  # e.g. "dept_roads"
    corporation_id = Column(String(50), ForeignKey("corporations.id"), nullable=False)
    name = Column(String(100), nullable=False)
    name_mr = Column(String(100), nullable=True)
    code = Column(String(20), nullable=False)
    color = Column(String(20), default="#0B3D66")

    corporation = relationship("Corporation", back_populates="departments")
    categories = relationship("Category", back_populates="department", cascade="all, delete-orphan")


class Category(Base):
    __tablename__ = "categories"

    id = Column(String(50), primary_key=True)  # e.g. "cat_pothole"
    corporation_id = Column(String(50), ForeignKey("corporations.id"), nullable=False)
    department_id = Column(String(50), ForeignKey("departments.id"), nullable=False)
    name = Column(String(100), nullable=False)
    name_mr = Column(String(100), nullable=True)
    priority = Column(String(20), default="MEDIUM")  # LOW, MEDIUM, HIGH, URGENT
    resolution_hours = Column(Integer, default=72)
    is_urgent = Column(Boolean, default=False)
    redirect_target = Column(String(100), nullable=True)  # e.g. "MSEDCL:1912" or "PWD"
    is_active = Column(Boolean, default=True)

    department = relationship("Department", back_populates="categories")


class RoutingRule(Base):
    __tablename__ = "routing_rules"

    id = Column(String(50), primary_key=True)
    corporation_id = Column(String(50), ForeignKey("corporations.id"), nullable=False)
    category_id = Column(String(50), ForeignKey("categories.id"), nullable=False)
    ward_id = Column(String(50), ForeignKey("wards.id"), nullable=True)  # null means all wards
    unit_id = Column(String(50), ForeignKey("org_units.id"), nullable=False)
    is_active = Column(Boolean, default=True)


class User(Base):
    __tablename__ = "users"

    id = Column(String(50), primary_key=True)
    corporation_id = Column(String(50), ForeignKey("corporations.id"), nullable=True)
    unit_id = Column(String(50), ForeignKey("org_units.id"), nullable=True)
    name = Column(String(100), nullable=False)
    mobile = Column(String(15), nullable=True, index=True)
    email = Column(String(100), nullable=True, index=True)
    hashed_password = Column(String(200), nullable=True)
    role = Column(String(30), nullable=False)  # platform_admin | corp_admin | supervisor | field_officer | helpdesk | citizen
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    anonymized = Column(Boolean, default=False)  # DPDP flag

    corporation = relationship("Corporation", back_populates="users")
    officer_status = relationship("OfficerStatus", back_populates="officer", uselist=False, foreign_keys="OfficerStatus.user_id")


class OfficerStatus(Base):
    __tablename__ = "officer_statuses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(50), ForeignKey("users.id"), nullable=False, unique=True)
    is_on_leave = Column(Boolean, default=False)
    leave_start = Column(DateTime, nullable=True)
    leave_end = Column(DateTime, nullable=True)
    backup_user_id = Column(String(50), ForeignKey("users.id"), nullable=True)

    officer = relationship("User", foreign_keys=[user_id], back_populates="officer_status")
    backup = relationship("User", foreign_keys=[backup_user_id])


class InviteCode(Base):
    __tablename__ = "invite_codes"

    id = Column(String(50), primary_key=True)
    corporation_id = Column(String(50), ForeignKey("corporations.id"), nullable=False)
    code = Column(String(30), unique=True, nullable=False)  # e.g. "SMKMC-W7-984"
    role = Column(String(30), default="field_officer")
    unit_id = Column(String(50), ForeignKey("org_units.id"), nullable=True)
    used_by = Column(String(50), nullable=True)
    is_used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class JoinRequest(Base):
    __tablename__ = "join_requests"

    id = Column(String(50), primary_key=True)
    corporation_id = Column(String(50), ForeignKey("corporations.id"), nullable=False)
    name = Column(String(100), nullable=False)
    mobile = Column(String(15), nullable=False)
    email = Column(String(100), nullable=False)
    requested_role = Column(String(30), nullable=False)
    unit_id = Column(String(50), nullable=True)
    status = Column(String(20), default="PENDING")  # PENDING, APPROVED, REJECTED
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class Complaint(Base):
    __tablename__ = "complaints"

    id = Column(String(50), primary_key=True)  # tracking ref: NN-YYYY-NNNNNN
    corporation_id = Column(String(50), ForeignKey("corporations.id"), nullable=False)
    citizen_id = Column(String(50), ForeignKey("users.id"), nullable=True)  # null = anonymous
    citizen_name = Column(String(100), nullable=True)
    citizen_mobile = Column(String(15), nullable=True)
    is_anonymous = Column(Boolean, default=False)

    category_id = Column(String(50), ForeignKey("categories.id"), nullable=False)
    description = Column(Text, nullable=True)
    audio_url = Column(String(255), nullable=True)
    audio_transcript = Column(Text, nullable=True)

    # AI scores & classification
    ai_scores = Column(JSON, nullable=True)  # {"best_guess": "cat_pothole", "confidence": 0.88, "top_3": [...]}

    # Location & Ward
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    address = Column(String(255), nullable=True)
    ward_id = Column(String(50), ForeignKey("wards.id"), nullable=True)
    unit_id = Column(String(50), ForeignKey("org_units.id"), nullable=True)
    assignee_id = Column(String(50), ForeignKey("users.id"), nullable=True)

    # Status & Priority
    # Statuses: SUBMITTED, TO_CHECK, ASSIGNED, IN_PROGRESS, WORK_SCHEDULED, RESOLVED, REOPENED, CLOSED, REJECTION_REQUESTED, REJECTED
    status = Column(String(30), default="SUBMITTED")
    priority = Column(String(20), default="MEDIUM")
    danger_flag = Column(Boolean, default=False)
    danger_verified = Column(Boolean, default=False)
    photo_verified = Column(Boolean, default=False)

    # Clocks
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    response_due = Column(DateTime, nullable=False)  # 48h (24h if Urgent)
    resolution_due = Column(DateTime, nullable=False) # per category SLA
    resolved_at = Column(DateTime, nullable=True)
    closed_at = Column(DateTime, nullable=True)

    # Escalations (level + reason)
    escalation_level = Column(String(10), nullable=True)  # L1, L2
    escalation_reason = Column(String(50), nullable=True) # "response_missed" | "deadline_missed"
    escalated_at = Column(DateTime, nullable=True)
    supervisor_overdue = Column(Boolean, default=False)    # 72h after escalation with no supervisor action

    # Counts & Duplicates
    transfer_count = Column(Integer, default=0)
    reopen_count = Column(Integer, default=0)
    parent_id = Column(String(50), ForeignKey("complaints.id"), nullable=True)

    # Channel
    channel = Column(String(30), default="app")  # app | phone | walkin | whatsapp | aaple_sarkar

    corporation = relationship("Corporation", back_populates="complaints")
    events = relationship("ComplaintEvent", back_populates="complaint", cascade="all, delete-orphan", order_by="ComplaintEvent.created_at.desc()")
    attachments = relationship("Attachment", back_populates="complaint", cascade="all, delete-orphan")
    voice_notes = relationship("VoiceNote", back_populates="complaint", order_by="VoiceNote.created_at.desc()")
    category = relationship("Category")  # used by admin dashboard & public lookup (was missing)

    @property
    def voice_note(self):
        """Citizen voice note attached to this complaint (latest), or None."""
        return self.voice_notes[0] if self.voice_notes else None

    @property
    def photo_urls(self):
        return [a.url for a in self.attachments if a.attachment_type == "before"]


class ComplaintEvent(Base):
    __tablename__ = "complaint_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    complaint_id = Column(String(50), ForeignKey("complaints.id"), nullable=False)
    actor_id = Column(String(50), nullable=True)
    actor_name = Column(String(100), nullable=False)
    actor_role = Column(String(30), nullable=False)
    action = Column(String(50), nullable=False)
    from_status = Column(String(30), nullable=True)
    to_status = Column(String(30), nullable=True)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    complaint = relationship("Complaint", back_populates="events")


class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(String(50), primary_key=True)
    complaint_id = Column(String(50), ForeignKey("complaints.id"), nullable=False)
    attachment_type = Column(String(20), default="before")  # "before" | "after"
    file_path = Column(String(255), nullable=False)
    exif_time = Column(DateTime, nullable=True)
    exif_latitude = Column(Float, nullable=True)
    exif_longitude = Column(Float, nullable=True)
    is_verified = Column(Boolean, default=False)
    flags = Column(JSON, nullable=True)  # {"distance_meters": 120, "time_diff_hours": 2, "flagged": false}
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    complaint = relationship("Complaint", back_populates="attachments")

    @property
    def url(self) -> str:
        path = self.file_path or ""
        return path if path.startswith(("http://", "https://", "/")) else f"/api/v1/uploads/{path}"


class VoiceNote(Base):
    """
    Citizen voice recording + speech-to-text transcript. Uploaded before the complaint exists
    (so the citizen can review/edit the transcript) and linked to the complaint on submission.
    Files live in the existing UPLOAD_DIR (served at /api/v1/uploads) under voice_notes/.
    """
    __tablename__ = "voice_notes"

    id = Column(String(50), primary_key=True)                       # vn_<uuid hex>
    corporation_id = Column(String(50), ForeignKey("corporations.id"), nullable=False)
    complaint_id = Column(String(50), ForeignKey("complaints.id"), nullable=True, index=True)
    uploaded_by = Column(String(50), nullable=True)                  # user id; null = anonymous
    original_path = Column(String(255), nullable=False)              # as recorded (e.g. audio/webm)
    original_mime_type = Column(String(50), nullable=False)
    playback_path = Column(String(255), nullable=True)               # 16 kHz mono WAV rendition
    size_bytes = Column(Integer, nullable=False)
    duration_seconds = Column(Float, nullable=False)                 # measured server-side
    language = Column(String(10), nullable=True)                     # mr | hi | en
    transcript_original = Column(Text, nullable=True)                # speech-to-text output, unedited
    transcript_final = Column(Text, nullable=True)                   # citizen-confirmed/edited text
    transcription_status = Column(String(20), default="pending")    # completed | failed | unavailable | pending
    transcription_provider = Column(String(50), nullable=True)
    transcription_error = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    complaint = relationship("Complaint", back_populates="voice_notes")

    @property
    def audio_url(self) -> str:
        return f"/api/v1/uploads/{self.playback_path or self.original_path}"

    @property
    def original_audio_url(self) -> str:
        return f"/api/v1/uploads/{self.original_path}"

    @property
    def mime_type(self) -> str:
        return "audio/wav" if self.playback_path else self.original_mime_type

    @property
    def transcript(self):
        return self.transcript_final if self.transcript_final is not None else self.transcript_original


class ApprovalRequest(Base):
    __tablename__ = "approval_requests"

    id = Column(String(50), primary_key=True)
    corporation_id = Column(String(50), ForeignKey("corporations.id"), nullable=False)
    complaint_id = Column(String(50), ForeignKey("complaints.id"), nullable=True)
    request_type = Column(String(30), nullable=False) # rejection | extension | second_transfer | third_reopen | officer_join
    requester_id = Column(String(50), nullable=False)
    requester_name = Column(String(100), nullable=False)
    details = Column(JSON, nullable=False)  # reason, new_due_date, target_unit, etc.
    status = Column(String(20), default="PENDING")  # PENDING | APPROVED | REJECTED
    decided_by = Column(String(50), nullable=True)
    decision_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    decided_at = Column(DateTime, nullable=True)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    corporation_id = Column(String(50), ForeignKey("corporations.id"), nullable=False)
    user_id = Column(String(50), ForeignKey("users.id"), nullable=False)
    title = Column(String(150), nullable=False)
    body = Column(Text, nullable=False)
    complaint_id = Column(String(50), nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class HelpdeskLog(Base):
    __tablename__ = "helpdesk_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    corporation_id = Column(String(50), ForeignKey("corporations.id"), nullable=False)
    operator_id = Column(String(50), nullable=False)
    operator_name = Column(String(100), nullable=False)
    log_type = Column(String(30), nullable=False)  # COMPLAINT | REDIRECT | LOOKUP
    caller_mobile = Column(String(15), nullable=True)
    caller_name = Column(String(100), nullable=True)
    complaint_id = Column(String(50), nullable=True)
    redirect_target = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    corporation_id = Column(String(50), ForeignKey("corporations.id"), nullable=False)
    actor_id = Column(String(50), nullable=False)
    actor_name = Column(String(100), nullable=False)
    actor_role = Column(String(30), nullable=False)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(String(50), nullable=False)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class Setting(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    corporation_id = Column(String(50), ForeignKey("corporations.id"), nullable=False)
    key = Column(String(50), nullable=False)
    value = Column(JSON, nullable=False)
