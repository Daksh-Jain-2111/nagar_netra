import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

from backend.app.schemas.voice import VoiceNoteOut

# --- AUTH SCHEMAS ---
class OTPRequest(BaseModel):
    mobile: str = Field(..., description="10-digit Indian mobile number")
    corporation_id: str = "SMKMC"

class OTPVerify(BaseModel):
    mobile: str
    otp: str
    name: Optional[str] = None
    corporation_id: str = "SMKMC"

class StaffLoginRequest(BaseModel):
    email: str
    password: str
    corporation_id: Optional[str] = "SMKMC"

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]

class UserProfileResponse(BaseModel):
    id: str
    name: str
    mobile: Optional[str] = None
    email: Optional[str] = None
    role: str
    corporation_id: Optional[str] = None
    unit_id: Optional[str] = None
    is_active: bool = True
    created_at: datetime.datetime

# --- COMPLAINT SCHEMAS ---
class ComplaintCreate(BaseModel):
    category_id: str
    description: Optional[str] = None
    audio_transcript: Optional[str] = None
    latitude: float
    longitude: float
    address: Optional[str] = None
    ward_id: Optional[str] = None
    is_anonymous: bool = False
    danger_flag: bool = False
    citizen_name: Optional[str] = None
    citizen_mobile: Optional[str] = None
    citizen_confirmed_category: bool = True
    channel: str = "app"  # app | phone | walkin | whatsapp | aaple_sarkar
    photo_metadata: Optional[Dict[str, Any]] = None
    # Category id from the citizen web app's list; resolved server-side via the civic issue taxonomy
    # when category_id is not a backend category. Department/SLA always come from the backend.
    app_category_id: Optional[str] = None
    # Voice note uploaded earlier via POST /voice-notes; linked to this complaint on creation.
    voice_note_id: Optional[str] = Field(None, max_length=50)
    # Issue code of the image-AI suggestion the citizen accepted (null = chosen manually).
    accepted_ai_issue_code: Optional[str] = Field(None, max_length=50)

class ComplaintAssignRequest(BaseModel):
    assignee_id: str
    comment: Optional[str] = None

class ComplaintStatusUpdateRequest(BaseModel):
    status: str
    comment: Optional[str] = None

class ComplaintTransferRequest(BaseModel):
    target_unit_id: str
    reason: str

class ComplaintRejectionRequest(BaseModel):
    reason: str

class ComplaintExtensionRequest(BaseModel):
    new_due_date: datetime.datetime
    reason: str

class ComplaintResolveRequest(BaseModel):
    after_photo_path: Optional[str] = None
    after_photo_metadata: Optional[Dict[str, Any]] = None
    resolution_notes: str

class ComplaintReopenRequest(BaseModel):
    reason: str

class LinkDuplicateRequest(BaseModel):
    parent_complaint_id: str
    notes: Optional[str] = None

class ComplaintEventResponse(BaseModel):
    id: int
    complaint_id: str
    actor_id: Optional[str] = None
    actor_name: str
    actor_role: str
    action: str
    from_status: Optional[str] = None
    to_status: Optional[str] = None
    comment: Optional[str] = None
    created_at: datetime.datetime

class ComplaintResponse(BaseModel):
    id: str
    corporation_id: str
    citizen_id: Optional[str] = None
    citizen_name: Optional[str] = None
    citizen_mobile: Optional[str] = None
    is_anonymous: bool = False
    category_id: str
    description: Optional[str] = None
    audio_transcript: Optional[str] = None
    latitude: float
    longitude: float
    address: Optional[str] = None
    ward_id: Optional[str] = None
    unit_id: Optional[str] = None
    assignee_id: Optional[str] = None
    status: str
    priority: str
    danger_flag: bool
    danger_verified: bool
    photo_verified: bool
    created_at: datetime.datetime
    response_due: datetime.datetime
    resolution_due: datetime.datetime
    resolved_at: Optional[datetime.datetime] = None
    closed_at: Optional[datetime.datetime] = None
    escalation_level: Optional[str] = None
    escalation_reason: Optional[str] = None
    escalated_at: Optional[datetime.datetime] = None
    supervisor_overdue: bool = False
    transfer_count: int = 0
    reopen_count: int = 0
    parent_id: Optional[str] = None
    channel: str = "app"
    events: List[ComplaintEventResponse] = []
    photo_urls: List[str] = []
    voice_note: Optional[VoiceNoteOut] = None
    ai_scores: Optional[Dict[str, Any]] = None

# --- APPROVAL SCHEMAS ---
class ApprovalDecisionRequest(BaseModel):
    decision: str  # "APPROVED" | "REJECTED"
    notes: Optional[str] = None

class ApprovalRequestResponse(BaseModel):
    id: str
    corporation_id: str
    complaint_id: Optional[str] = None
    request_type: str
    requester_id: str
    requester_name: str
    details: Dict[str, Any]
    status: str
    decided_by: Optional[str] = None
    decision_notes: Optional[str] = None
    created_at: datetime.datetime
    decided_at: Optional[datetime.datetime] = None

# --- OFFICER & JOIN SCHEMAS ---
class OfficerStatusUpdateRequest(BaseModel):
    is_on_leave: bool
    backup_user_id: Optional[str] = None
    leave_start: Optional[datetime.datetime] = None
    leave_end: Optional[datetime.datetime] = None

class JoinRequestCreate(BaseModel):
    name: str
    mobile: str
    email: str
    requested_role: str
    unit_id: Optional[str] = None
    invite_code: Optional[str] = None

# --- ROUTING SCHEMAS ---
class RoutingRuleCreate(BaseModel):
    category_id: str
    ward_id: Optional[str] = None
    unit_id: str
    is_active: bool = True

class RoutingSimulationRequest(BaseModel):
    category_id: str
    latitude: float
    longitude: float
    ward_id: Optional[str] = None
    ai_confidence: float = 0.85
    citizen_confirmed: bool = True

# --- HELPDESK SCHEMAS ---
class HelpdeskLogCreate(BaseModel):
    log_type: str  # COMPLAINT | REDIRECT | LOOKUP
    caller_mobile: Optional[str] = None
    caller_name: Optional[str] = None
    complaint_id: Optional[str] = None
    redirect_target: Optional[str] = None
    notes: Optional[str] = None

# --- AUDIT SCHEMAS ---
class AuditLogResponse(BaseModel):
    id: int
    corporation_id: str
    actor_id: str
    actor_name: str
    actor_role: str
    action: str
    entity_type: str
    entity_id: str
    details: Optional[Dict[str, Any]] = None
    created_at: datetime.datetime
