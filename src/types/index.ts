export type AppLanguage = 'mr' | 'hi' | 'en';

export type UserRole = 'citizen' | 'officer' | 'supervisor' | 'admin' | 'helpdesk' | 'platform';

export interface UserProfile {
  id: string;
  name: string;
  mobile: string;
  email?: string;
  role: UserRole;
  department?: string;
  departmentId?: string;
  supervisorUnit?: string;
  zone?: string;
  wardId?: number;
  wardName?: string;
  avatar?: string;
  isOnLeave?: boolean;
  leaveUntil?: string;
  backupOfficerId?: string;
  backupOfficerName?: string;
  roleTitle?: string;
}

export type ComplaintStatus = 
  | 'SUBMITTED' 
  | 'TO_CHECK' 
  | 'ASSIGNED' 
  | 'IN_PROGRESS' 
  | 'WORK_SCHEDULED' 
  | 'RESOLVED' 
  | 'REOPENED' 
  | 'CLOSED' 
  | 'REJECTION_REQUESTED' 
  | 'REJECTED';

export type EscalationLevel = 'L1' | 'L2' | null;
export type EscalationReason = 'response missed' | 'deadline missed' | null;

export type ComplaintPriority = 'low' | 'medium' | 'high' | 'urgent';

export type PhotoVerificationStatus = 'VERIFIED' | 'UNVERIFIED' | 'FLAGGED';

export interface ComplaintCategory {
  id: string;
  nameMr: string;
  nameEn: string;
  nameHi?: string;
  groupNameEn?: string;
  groupNameMr?: string;
  department: string;
  departmentId: string;
  departmentMr: string;
  slaHours: number;
  resolutionDays?: number;
  priority?: ComplaintPriority;
  iconName: string;
  descriptionMr: string;
  descriptionEn: string;
  isActive?: boolean;
  isRedirectOnly?: boolean;
  redirectAgency?: string;
  redirectPhone?: string;
}

export interface ComplaintTimelineStep {
  id: string;
  status: ComplaintStatus;
  titleMr: string;
  titleEn: string;
  timestamp: string;
  actorName: string;
  actorRole: string; // e.g. "Field officer", "Citizen", "Supervisor (DMC 1)"
  comment?: string;
  photoUrl?: string;
  isInstruction?: boolean;
}

export interface TargetDateExtensionRequest {
  requestedDate: string;
  reason: 'Monsoon' | 'Needs tender or work order' | 'Material awaited' | 'Other';
  note: string;
  requestedAt: string;
  status: 'PENDING' | 'APPROVED' | 'DECLINED';
  supervisorComment?: string;
}

export interface RejectionRequest {
  reason: 'Not a civic issue' | 'Outside corporation area' | 'Fake or invalid' | 'Duplicate' | 'Other';
  note: string;
  requestedAt: string;
  status: 'PENDING' | 'APPROVED' | 'DECLINED';
  supervisorComment?: string;
}

export interface TransferRequest {
  fromDepartment: string;
  toDepartment: string;
  reason: string;
  requestedAt: string;
  transferCount: number; // 1 = direct, 2+ = requires supervisor approval
  status: 'DIRECT_COMPLETED' | 'PENDING_SUPERVISOR' | 'APPROVED' | 'DECLINED';
}

export interface OfficerJoinRequest {
  id: string;
  name: string;
  emailOrMobile: string;
  department: string;
  roleTitle: string;
  inviteCodeUsed: string;
  requestedAt: string;
  status: 'PENDING' | 'APPROVED' | 'DECLINED';
}

export interface OrgUnit {
  id: string;
  nameEn: string;
  nameMr: string;
  levelType: string; // free-text per corporation
  parentId: string | null;
  supervisorId?: string;
  acceptsComplaints: boolean;
  activeOfficerId?: string;
  backupOfficerId?: string;
}

export interface RoutingRule {
  id: string;
  categoryId: string;
  categoryNameEn: string;
  wardNumbers?: number[]; // optional ward filter
  unitId: string;
  unitNameEn: string;
  isOverride: boolean;
}

export interface SystemRules {
  aiThreshold: number; // default 70
  aiVisionWeight: number; // default 60
  aiTextWeight: number; // default 40
  responseClockNormalHours: number; // 48
  responseClockUrgentHours: number; // 24
  l2EscalateIfInactive: boolean; // default false
  l2InactiveHours: number; // 72
  reopenMaxDays: number; // 7
  reopenMaxCount: number; // 2
  autoCloseAfterResolvedDays: number; // 7
  duplicateRadiusMeters: number; // 100
  duplicateWindowDays: number; // 7
  citizenPhotoMaxDays: number; // 7
  citizenPhotoMaxDistanceMeters: number; // 500
  afterPhotoMaxDistanceMeters: number; // 200
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: string;
  action: string;
  refEntity: string;
  details: string;
}

export interface HelpdeskRedirectLog {
  id: string;
  timestamp: string;
  operatorName: string;
  callerMobile?: string;
  categoryName: string;
  redirectAgency: string;
  redirectPhone: string;
  notes?: string;
}

export interface PlatformCorporation {
  id: string;
  nameEn: string;
  nameMr: string;
  code: string;
  status: 'Live' | 'Draft' | 'Suspended';
  unitsCount: number;
  officersCount: number;
  complaintsThisMonth: number;
  aiModelVersion: string;
  adminInviteCode?: string;
  createdAt: string;
}

export interface AIModelRegistryItem {
  id: string;
  name: string;
  type: 'on_device_image' | 'server_vision' | 'speech_text_nlp';
  version: string;
  status: 'Active' | 'Evaluation pending';
  usedByCorporations: string[];
}


export interface Complaint {
  id: string; // e.g. NN-2026-000101
  trackingNumber: string;
  categoryId: string;
  categoryNameMr: string;
  categoryNameEn: string;
  department: string;
  departmentId: string;
  departmentMr: string;
  status: ComplaintStatus;
  priority: ComplaintPriority;
  description: string;
  voiceNoteUrl?: string;
  voiceTranscript?: string;
  voiceDurationSeconds?: number;
  photoUrls: string[];
  photoBadge?: PhotoVerificationStatus;
  resolvedPhotoUrl?: string;
  resolvedPhotoBadge?: PhotoVerificationStatus;
  resolvedPhotoDistanceMeters?: number;
  resolvedWhatWasDoneChips?: string[];
  resolvedAt?: string;
  latitude: number;
  longitude: number;
  address: string;
  wardNumber: number;
  wardName: string;
  landmark: string;
  citizenName: string;
  citizenMobile: string;
  isAnonymous?: boolean;
  isDangerToLife?: boolean;
  dangerVerified?: boolean;
  routeChannel: 'AI' | 'citizen choice' | 'helpdesk';
  aiConfidence?: number;
  createdAt: string;
  updatedAt: string;
  // Two statutory clocks
  responseDeadline: string; // 48h (24h if urgent)
  responseMet: boolean;
  responseMetAt?: string;
  resolutionDeadline: string; // target date per category or scheduled date
  scheduledTargetDate?: string;
  scheduledTargetApproved?: boolean;
  // Escalation (not a status)
  escalationLevel: EscalationLevel;
  escalationReason: EscalationReason;
  escalatedAt?: string;
  // Supervisor instruction
  supervisorInstruction?: {
    message: string;
    deadline: string;
    instructedAt: string;
    supervisorName: string;
  };
  // Pending requests for supervisor approvals
  extensionRequest?: TargetDateExtensionRequest;
  rejectionRequest?: RejectionRequest;
  transferRequest?: TransferRequest;
  // Rejection outcome
  rejectedReason?: string;
  rejectedNote?: string;
  // Linking / Duplicates
  linkedParentId?: string; // e.g. "NN-2026-000108"
  linkedChildrenIds?: string[];
  // Reopen tracking
  reopenCount: number; // max 2
  reopenDeadline: string; // 7 days after RESOLVED
  timeline: ComplaintTimelineStep[];
  rating?: {
    stars: number;
    comment?: string;
    submittedAt: string;
  };
  /** Citizen voice recording + transcript (stored by the backend). */
  voiceNote?: ComplaintVoiceNote;
  /** Top-3 image classification attached to the ticket. */
  aiAnalysis?: ComplaintAIAnalysis;
}

export interface NotificationItem {
  id: string;
  recipientRole: UserRole | 'all';
  recipientId?: string;
  titleMr: string;
  titleEn: string;
  messageMr: string;
  messageEn: string;
  complaintId?: string;
  type: 'status_update' | 'resolved' | 'assignment' | 'alert' | 'escalation' | 'approval';
  isRead: boolean;
  createdAt: string;
}


// --- AI image classification (POST /api/v1/ai/classify-image) ---
export type AIConfidenceBand = 'strong' | 'suggestion' | 'low' | 'insufficient';
export type AIClassificationStatus = 'success' | 'low_confidence' | 'no_civic_issue' | 'no_prediction';

export interface CivicIssuePrediction {
  rank: number;
  issue_code: string;
  issue_name: string;
  issue_name_mr: string;
  /** Model probability in [0, 1]. This is prediction confidence, NOT model accuracy. */
  confidence: number;
  confidence_band: AIConfidenceBand;
  recommended: boolean;
  mapping_status: 'mapped' | 'unmapped';
  category_id: string | null;
  category_name: string | null;
  category_name_mr: string | null;
  /** Matching id in the citizen app's category list (ComplaintCategory.id). */
  app_category_id: string | null;
  department_id: string | null;
  department_code: string | null;
  department_name: string | null;
  department_name_mr: string | null;
  sla_hours: number | null;
  response_sla_hours: number | null;
  priority: string | null;
  is_urgent: boolean | null;
  redirect_target: string | null;
}

export interface AIImageAnalysis {
  index: number;
  filename: string | null;
  status: 'analyzed' | 'rejected';
  error_code: string | null;
  error_message: string | null;
  top_issue_code: string | null;
  top_confidence: number | null;
}

export interface CivicIssueClassificationResult {
  status: AIClassificationStatus;
  message: string;
  recommended_issue_code: string | null;
  top_confidence: number;
  meets_routing_threshold: boolean;
  predictions: CivicIssuePrediction[];
  images: AIImageAnalysis[];
  aggregation: { method: string; images_received: number; images_analyzed: number; top_issue_agreement: number };
  thresholds: { strong: number; suggestion: number; minimum: number; routing: number };
  model: { provider: string; model_id: string; version: string; taxonomy_version: string };
  modalities_used: string[];
  context_received: Record<string, boolean>;
  latency_ms: number;
}

/** What the citizen decided on the AI step; stored with the complaint draft. */
export interface DraftAIClassification {
  photoKey: string;
  result: CivicIssueClassificationResult | null;
  errorCode?: string;
  /** Rank of the AI suggestion the citizen accepted, or null when they picked a category manually. */
  acceptedRank: number | null;
  acceptedIssueCode: string | null;
  acceptedConfidence: number | null;
}

// --- Citizen voice notes (POST /api/v1/voice-notes) ---
export type TranscriptionStatus = 'completed' | 'failed' | 'unavailable' | 'pending';

/** Voice note as returned by the backend (snake_case API shape). */
export interface VoiceNoteApi {
  id: string;
  complaint_id: string | null;
  audio_url: string;
  original_audio_url: string;
  mime_type: string;
  original_mime_type: string;
  duration_seconds: number;
  size_bytes: number;
  language: string | null;
  transcript: string | null;
  transcript_original: string | null;
  transcription_status: TranscriptionStatus;
  transcription_provider: string | null;
  transcription_error: string | null;
  created_at: string;
}

/** Voice note attached to a complaint ticket (app shape). */
export interface ComplaintVoiceNote {
  id: string;
  audioUrl: string;
  originalAudioUrl?: string;
  mimeType: string;
  originalMimeType?: string;
  durationSeconds: number;
  language: string | null;
  /** Final transcript (citizen-edited if they edited it). */
  transcript: string | null;
  /** Unedited speech-to-text output. */
  transcriptOriginal?: string | null;
  transcriptionStatus: TranscriptionStatus;
  createdAt: string;
}

/** Image-AI analysis snapshot stored on a ticket. */
export interface ComplaintAIAnalysis {
  /** 'server' = re-computed by the backend on the stored photos; 'client' = from the citizen's Step 2; 'seed_sample' = demo data. */
  source: 'server' | 'client' | 'seed_sample';
  acceptedIssueCode?: string | null;
  predictions: Array<{
    rank: number;
    issue_code: string;
    issue_name: string;
    issue_name_mr: string;
    confidence: number;
    confidence_band: AIConfidenceBand;
    recommended: boolean;
    app_category_id?: string | null;
  }>;
}
