/**
 * Maps tickets stored by the backend (GET /api/v1/complaints) into the app's Complaint shape so the
 * Field Officer dashboard shows the same tickets citizens submitted (photos, voice note, transcript,
 * image-AI analysis) - also across devices/sessions.
 */
import { Complaint, ComplaintAIAnalysis, ComplaintCategory, ComplaintStatus, ComplaintPriority } from '../types';
import { mediaUrl, toComplaintVoiceNote } from './api';

const iso = (v?: string | null) => (v ? (/[zZ]|[+-]\d\d:\d\d$/.test(v) ? v : `${v}Z`) : undefined);

export function backendTicketToComplaint(raw: any, categories: ComplaintCategory[]): Complaint {
  const appCategoryId: string | undefined = raw.ai_scores?.app_category_id
    || raw.ai_scores?.image_classification?.predictions?.[0]?.app_category_id;
  const cat = categories.find(c => c.id === appCategoryId) || categories.find(c => c.id === 'other_general') || categories[0];
  const serverAI = raw.ai_scores?.image_classification;
  const aiAnalysis: ComplaintAIAnalysis | undefined = serverAI?.predictions?.length
    ? { source: serverAI.source === 'seed_sample' ? 'seed_sample' : 'server', acceptedIssueCode: raw.ai_scores?.citizen_accepted_issue_code ?? null, predictions: serverAI.predictions }
    : undefined;
  const accepted = aiAnalysis?.predictions.find(p => p.issue_code === aiAnalysis.acceptedIssueCode);
  const voiceNote = raw.voice_note ? toComplaintVoiceNote(raw.voice_note) : undefined;
  const wardNumber = Number(String(raw.ward_id || '').replace(/\D/g, '')) || 0;
  const created = iso(raw.created_at) || new Date().toISOString();

  return {
    id: raw.id,
    trackingNumber: raw.id,
    categoryId: cat.id,
    categoryNameMr: cat.nameMr,
    categoryNameEn: cat.nameEn,
    department: cat.department,
    departmentId: cat.departmentId,
    departmentMr: cat.departmentMr,
    status: raw.status as ComplaintStatus,
    priority: String(raw.priority || 'medium').toLowerCase() as ComplaintPriority,
    description: raw.description || voiceNote?.transcript || '',
    voiceNote,
    voiceNoteUrl: voiceNote?.audioUrl,
    voiceTranscript: voiceNote?.transcript ?? undefined,
    voiceDurationSeconds: voiceNote ? Math.round(voiceNote.durationSeconds) : undefined,
    aiAnalysis,
    photoUrls: (raw.photo_urls || []).map((u: string) => mediaUrl(u)),
    photoBadge: raw.photo_verified ? 'VERIFIED' : 'UNVERIFIED',
    latitude: raw.latitude,
    longitude: raw.longitude,
    address: raw.address || '',
    wardNumber,
    wardName: wardNumber ? `Ward ${wardNumber}` : '',
    landmark: raw.address || '',
    citizenName: raw.is_anonymous ? 'Anonymous citizen' : (raw.citizen_name || 'Citizen'),
    citizenMobile: raw.citizen_mobile || '',
    isAnonymous: raw.is_anonymous,
    isDangerToLife: raw.danger_flag,
    dangerVerified: raw.danger_verified,
    routeChannel: aiAnalysis?.acceptedIssueCode ? 'AI' : 'citizen choice',
    aiConfidence: accepted ? Math.round(accepted.confidence * 100) : undefined,
    createdAt: created,
    updatedAt: created,
    responseDeadline: iso(raw.response_due) || created,
    responseMet: raw.status !== 'ASSIGNED' && raw.status !== 'SUBMITTED' && raw.status !== 'TO_CHECK',
    resolutionDeadline: iso(raw.resolution_due) || created,
    escalationLevel: raw.escalation_level || null,
    escalationReason: raw.escalation_reason === 'response_missed' ? 'response missed'
      : raw.escalation_reason === 'deadline_missed' ? 'deadline missed' : null,
    reopenCount: raw.reopen_count || 0,
    reopenDeadline: iso(raw.resolved_at) || created,
    timeline: (raw.events || []).slice().reverse().map((e: any) => ({
      id: `be_${e.id}`,
      status: (e.to_status || raw.status) as ComplaintStatus,
      titleMr: e.action,
      titleEn: String(e.action || '').replace(/_/g, ' ').toLowerCase().replace(/^\w/, (m: string) => m.toUpperCase()),
      timestamp: new Date(iso(e.created_at) || created).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
      actorName: e.actor_name,
      actorRole: e.actor_role,
      comment: e.comment || undefined,
    })),
  };
}

/** Merge backend tickets into the local store: add new ones, refresh media/AI fields on existing ones. */
export function mergeBackendTickets(local: Complaint[], backend: Complaint[]): Complaint[] {
  const byId = new Map(backend.map(c => [c.id, c]));
  const merged = local.map(c => {
    const b = byId.get(c.id);
    if (!b) return c;
    byId.delete(c.id);
    return {
      ...c,
      voiceNote: b.voiceNote ?? c.voiceNote,
      voiceNoteUrl: b.voiceNoteUrl ?? c.voiceNoteUrl,
      voiceTranscript: b.voiceTranscript ?? c.voiceTranscript,
      voiceDurationSeconds: b.voiceDurationSeconds ?? c.voiceDurationSeconds,
      aiAnalysis: b.aiAnalysis ?? c.aiAnalysis,
      photoUrls: c.photoUrls.length ? c.photoUrls : b.photoUrls,
    };
  });
  return [...Array.from(byId.values()), ...merged];
}
