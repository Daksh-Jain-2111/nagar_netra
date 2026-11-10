/**
 * NagarNetra Backend API Client
 * Interfaces with FastAPI /api/v1 endpoints with transparent mock store fallback support.
 */

import type { CivicIssueClassificationResult, ComplaintVoiceNote, VoiceNoteApi } from '../types';

export const DATA_SOURCE: 'api' | 'mock' = (import.meta.env.VITE_DATA_SOURCE as any) || 'api';
export const API_BASE: string = import.meta.env.VITE_API_BASE_URL || '/api/v1';
export const AI_CLASSIFY_TIMEOUT_MS: number = Number(import.meta.env.VITE_AI_CLASSIFY_TIMEOUT_MS) || 30000;

/** Error with HTTP status and the backend's machine-readable code (detail.code), when present. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Absolute/relative URL for media served by the backend (e.g. "/api/v1/uploads/voice_notes/x.wav"). */
export function mediaUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (/^(https?:|blob:|data:)/.test(path)) return path;
  if (/^https?:/.test(API_BASE) && path.startsWith('/')) return new URL(API_BASE).origin + path;
  return path;
}

export function toComplaintVoiceNote(v: VoiceNoteApi): ComplaintVoiceNote {
  return {
    id: v.id,
    audioUrl: mediaUrl(v.audio_url),
    originalAudioUrl: mediaUrl(v.original_audio_url),
    mimeType: v.mime_type,
    originalMimeType: v.original_mime_type,
    durationSeconds: v.duration_seconds,
    language: v.language,
    transcript: v.transcript,
    transcriptOriginal: v.transcript_original,
    transcriptionStatus: v.transcription_status,
    createdAt: v.created_at,
  };
}

function errorFromResponseBody(status: number, statusText: string, body: any): ApiError {
  const detail = body?.detail;
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    return new ApiError(detail.message || `HTTP Error ${status}`, status, detail.code, detail);
  }
  return new ApiError(typeof detail === 'string' ? detail : `HTTP Error ${status}: ${statusText}`, status, undefined, detail);
}

export class ApiClient {
  private static token: string | null = localStorage.getItem('nagarnetra_token');
  /** In-flight staff sign-in; other requests wait for it so they never go out with the previous user's token. */
  private static pendingAuth: Promise<unknown> | null = null;
  /** Backend role of the current token (as returned by the last sign-in), for diagnostics. */
  public static sessionRole: string | null = localStorage.getItem('nagarnetra_token_role');

  public static setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('nagarnetra_token', token);
    } else {
      localStorage.removeItem('nagarnetra_token');
      localStorage.removeItem('nagarnetra_token_role');
      this.sessionRole = null;
    }
  }

  public static getToken(): string | null {
    return this.token || localStorage.getItem('nagarnetra_token');
  }

  public static async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    if (this.pendingAuth && !endpoint.startsWith('/auth/')) {
      await this.pendingAuth.catch(() => undefined);
    }
    const headers = new Headers(options.headers || {});
    
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    const token = this.getToken();
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw errorFromResponseBody(response.status, response.statusText, errorData);
      }

      return (await response.json()) as T;
    } catch (err: any) {
      console.warn(`[NagarNetra API] Call to ${url} failed:`, err.message);
      throw err;
    }
  }

  // --- Auth endpoints ---
  public static async requestOtp(mobile: string, corporationId = 'SMKMC') {
    return this.request('/auth/otp/request', {
      method: 'POST',
      body: JSON.stringify({ mobile, corporation_id: corporationId }),
    });
  }

  public static async verifyOtp(mobile: string, otp: string, name?: string, corporationId = 'SMKMC') {
    const res = await this.request('/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ mobile, otp, name, corporation_id: corporationId }),
    });
    if (res.access_token) {
      this.setToken(res.access_token);
    }
    return res;
  }

  public static async staffLogin(email: string, password = 'Demo@123', corporationId = 'SMKMC') {
    const attempt = (async () => {
      const res = await this.request('/auth/staff/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, corporation_id: corporationId }),
      });
      if (res.access_token) {
        this.setToken(res.access_token);
        this.sessionRole = res.user?.role ?? null;
        if (this.sessionRole) localStorage.setItem('nagarnetra_token_role', this.sessionRole);
      }
      return res;
    })();
    this.pendingAuth = attempt;
    try {
      return await attempt;
    } finally {
      if (this.pendingAuth === attempt) this.pendingAuth = null;
    }
  }

  public static async refreshToken() {
    const res = await this.request('/auth/refresh', { method: 'POST' });
    if (res.access_token) {
      this.setToken(res.access_token);
    }
    return res;
  }

  public static async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.setToken(null);
    }
  }

  public static async getProfile() {
    return this.request('/auth/me');
  }

  public static async anonymizeAccount() {
    return this.request('/auth/me', { method: 'DELETE' });
  }

  // --- Complaints ---
  public static async getComplaints(params?: Record<string, any>) {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return this.request(`/complaints${query}`);
  }

  public static async getComplaint(ref: string) {
    return this.request(`/complaints/${ref}`);
  }

  public static async getPublicComplaint(ref: string) {
    return this.request(`/complaints/public/${ref}`);
  }

  public static async createComplaint(data: any) {
    return this.request('/complaints', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public static async assignComplaint(ref: string, assigneeId: string, comment?: string) {
    return this.request(`/complaints/${ref}/assign`, {
      method: 'POST',
      body: JSON.stringify({ assignee_id: assigneeId, comment }),
    });
  }

  public static async updateStatus(ref: string, status: string, comment?: string) {
    return this.request(`/complaints/${ref}/status`, {
      method: 'POST',
      body: JSON.stringify({ status, comment }),
    });
  }

  public static async transferComplaint(ref: string, targetUnitId: string, reason: string) {
    return this.request(`/complaints/${ref}/transfer`, {
      method: 'POST',
      body: JSON.stringify({ target_unit_id: targetUnitId, reason }),
    });
  }

  public static async requestRejection(ref: string, reason: string) {
    return this.request(`/complaints/${ref}/request-rejection`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  public static async requestExtension(ref: string, newDueDate: string, reason: string) {
    return this.request(`/complaints/${ref}/request-extension`, {
      method: 'POST',
      body: JSON.stringify({ new_due_date: newDueDate, reason }),
    });
  }

  public static async resolveComplaint(ref: string, resolutionNotes: string, afterPhotoPath?: string) {
    return this.request(`/complaints/${ref}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ resolution_notes: resolutionNotes, after_photo_path: afterPhotoPath }),
    });
  }

  public static async reopenComplaint(ref: string, reason: string) {
    return this.request(`/complaints/${ref}/reopen`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  public static async linkDuplicate(ref: string, parentComplaintId: string, notes?: string) {
    return this.request(`/complaints/${ref}/link-duplicate`, {
      method: 'POST',
      body: JSON.stringify({ parent_complaint_id: parentComplaintId, notes }),
    });
  }

  public static async getDuplicateCandidates(ref: string) {
    return this.request(`/complaints/${ref}/duplicate-candidates`);
  }

  public static async verifyDanger(ref: string) {
    return this.request(`/complaints/${ref}/verify-danger`, { method: 'POST' });
  }

  public static async getTimeline(ref: string) {
    return this.request(`/complaints/${ref}/timeline`);
  }

  // --- AI Classification ---
  public static async classifyAi(text?: string, hasImage?: boolean) {
    return this.request('/ai/classify', {
      method: 'POST',
      body: JSON.stringify({ text, has_image: !!hasImage }),
    });
  }

  /**
   * Image-based civic issue classification (Top-K issues with department & SLA).
   * Optional context fields are accepted by the API for future multimodal models.
   */
  public static async classifyComplaintImages(
    images: Blob[],
    context: { description?: string; voiceTranscript?: string; latitude?: number; longitude?: number } = {},
    options: { signal?: AbortSignal; timeoutMs?: number; topK?: number } = {},
  ): Promise<CivicIssueClassificationResult> {
    const form = new FormData();
    images.forEach((blob, idx) => form.append('images', blob, `photo_${idx + 1}.jpg`));
    form.append('top_k', String(options.topK ?? 3));
    if (context.description) form.append('description', context.description);
    if (context.voiceTranscript) form.append('voice_transcript', context.voiceTranscript);
    if (context.latitude != null && context.longitude != null) {
      form.append('latitude', String(context.latitude));
      form.append('longitude', String(context.longitude));
    }

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, options.timeoutMs ?? AI_CLASSIFY_TIMEOUT_MS);
    const onExternalAbort = () => controller.abort();
    options.signal?.addEventListener('abort', onExternalAbort);
    try {
      return await this.request<CivicIssueClassificationResult>('/ai/classify-image', {
        method: 'POST',
        body: form,
        signal: controller.signal,
      });
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        if (timedOut) throw new ApiError('AI analysis timed out', 504, 'CLIENT_TIMEOUT');
        throw err;
      }
      if (err instanceof ApiError) throw err;
      throw new ApiError(err?.message || 'Network error', 0, 'NETWORK_ERROR');
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onExternalAbort);
    }
  }

  // --- Citizen voice notes ---
  /** Upload a recording; the backend stores it and runs speech-to-text (may take several seconds). */
  public static async uploadVoiceNote(audio: Blob, language: string | null, signal?: AbortSignal): Promise<VoiceNoteApi> {
    const ext = audio.type.includes('mp4') ? 'm4a' : audio.type.includes('ogg') ? 'ogg' : 'webm';
    const form = new FormData();
    form.append('audio', audio, `voice_note.${ext}`);
    if (language) form.append('language', language);
    return this.wrapNetwork(() => this.request<VoiceNoteApi>('/voice-notes', { method: 'POST', body: form, signal }));
  }

  public static async updateVoiceTranscript(id: string, transcript: string): Promise<VoiceNoteApi> {
    return this.wrapNetwork(() => this.request<VoiceNoteApi>(`/voice-notes/${encodeURIComponent(id)}/transcript`, {
      method: 'PATCH',
      body: JSON.stringify({ transcript }),
    }));
  }

  public static async retryVoiceTranscription(id: string, language: string | null): Promise<VoiceNoteApi> {
    const form = new FormData();
    if (language) form.append('language', language);
    return this.wrapNetwork(() => this.request<VoiceNoteApi>(`/voice-notes/${encodeURIComponent(id)}/transcribe`, { method: 'POST', body: form }));
  }

  public static async getVoiceNote(id: string): Promise<VoiceNoteApi> {
    return this.wrapNetwork(() => this.request<VoiceNoteApi>(`/voice-notes/${encodeURIComponent(id)}`));
  }

  /** Create a complaint with photos + a previously uploaded voice note (department/SLA decided server-side). */
  public static async createComplaintWithMedia(payload: Record<string, unknown>, photos: Blob[]): Promise<any> {
    const form = new FormData();
    form.append('payload', JSON.stringify(payload));
    photos.forEach((p, i) => form.append('photos', p, `photo_${i + 1}.jpg`));
    return this.wrapNetwork(() => this.request('/complaints/with-media', { method: 'POST', body: form }));
  }

  private static async wrapNetwork<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err: any) {
      if (err instanceof ApiError || err?.name === 'AbortError') throw err;
      throw new ApiError(err?.message || 'Network error', 0, 'NETWORK_ERROR');
    }
  }

  // --- Supervisor ---
  public static async getSupervisorToCheck() {
    return this.request('/supervisor/to-check');
  }

  public static async getSupervisorEscalations() {
    return this.request('/supervisor/escalations');
  }

  public static async instructEscalation(ref: string, instruction: string) {
    return this.request(`/supervisor/escalations/${ref}/instruct`, {
      method: 'POST',
      body: JSON.stringify({ instruction }),
    });
  }

  public static async reassignEscalation(ref: string, newAssigneeId: string, reason: string) {
    return this.request(`/supervisor/escalations/${ref}/reassign`, {
      method: 'POST',
      body: JSON.stringify({ new_assignee_id: newAssigneeId, reason }),
    });
  }

  public static async getSupervisorPerformance() {
    return this.request('/supervisor/performance');
  }

  // --- Admin ---
  public static async getAdminDashboard() {
    return this.request('/admin/dashboard');
  }

  public static async getSupervisorOverdue() {
    return this.request('/admin/supervisor-overdue');
  }

  public static async getAdminReports() {
    return this.request('/admin/reports');
  }

  public static async inviteUser(data: { name: string; email: string; role: string; unit_id?: string; mobile?: string }) {
    return this.request('/admin/users/invite', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public static async getAdminSettings() {
    return this.request('/admin/settings');
  }

  public static async updateAdminSetting(key: string, value: any) {
    return this.request('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({ key, value }),
    });
  }

  // --- Platform Admin ---
  public static async getPlatformCorporations() {
    return this.request('/platform/corporations');
  }

  public static async toggleCorporationStatus(id: string) {
    return this.request(`/platform/corporations/${id}/toggle-status`, { method: 'POST' });
  }

  public static async createCorporationFromTemplate(data: { name?: string; corporation_id?: string }) {
    return this.request('/platform/corporations/from-template', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public static async getPlatformAiModels() {
    return this.request('/platform/ai-models');
  }

  // --- Notifications ---
  public static async getNotifications() {
    return this.request('/notifications');
  }

  public static async markNotificationRead(id: string) {
    return this.request(`/notifications/${id}/read`, { method: 'POST' });
  }

  // --- Approvals ---
  public static async getApprovals(status?: string) {
    const query = status ? `?status=${status}` : '';
    return this.request(`/approvals${query}`);
  }

  public static async decideApproval(id: string, decision: 'APPROVED' | 'REJECTED', notes?: string) {
    return this.request(`/approvals/${id}/decide`, {
      method: 'POST',
      body: JSON.stringify({ decision, notes }),
    });
  }

  // --- Routing & Officers ---
  public static async simulateRouting(payload: any) {
    return this.request('/routing/simulate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public static async getRoutingRules() {
    return this.request('/routing/rules');
  }

  public static async getOfficers() {
    return this.request('/officers');
  }

  // --- Helpdesk ---
  public static async logHelpdeskCall(data: any) {
    return this.request('/helpdesk/log', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public static async getHelpdeskLogs(todayOnly = false) {
    return this.request(`/helpdesk/logs?today_only=${todayOnly}`);
  }

  // --- Audit Logs ---
  public static async getAuditLogs(params?: Record<string, any>) {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return this.request(`/audit/logs${query}`);
  }

  // --- Master Data ---
  public static async getMasterCategories() {
    return this.request('/master/categories');
  }

  public static async getMasterWards() {
    return this.request('/master/wards');
  }

  public static async getMasterOrgUnits() {
    return this.request('/master/org-units');
  }

  // --- Dev & Time Travel ---
  public static async devTimeTravel(hours: number) {
    return this.request('/dev/time-travel', {
      method: 'POST',
      body: JSON.stringify({ hours }),
    });
  }

  public static async devResetSeed() {
    return this.request('/dev/reset-seed', { method: 'POST' });
  }

  public static async devRunScheduler() {
    return this.request('/dev/run-scheduler', { method: 'POST' });
  }
}
