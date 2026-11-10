import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  AppLanguage, 
  UserRole, 
  UserProfile, 
  Complaint, 
  NotificationItem, 
  ComplaintStatus,
  EscalationLevel,
  EscalationReason,
  OfficerJoinRequest,
  ComplaintTimelineStep,
  ComplaintCategory,
  OrgUnit,
  RoutingRule,
  SystemRules,
  AuditLogEntry,
  HelpdeskRedirectLog,
  PlatformCorporation,
  AIModelRegistryItem,
  DraftAIClassification,
  ComplaintVoiceNote,
  ComplaintAIAnalysis
} from '../types';
import { 
  MOCK_COMPLAINTS, 
  MOCK_NOTIFICATIONS, 
  MOCK_CATEGORIES, 
  MOCK_USERS, 
  MOCK_OFFICER_JOIN_REQUESTS,
  INITIAL_SIMULATED_TIME,
  MOCK_ORG_UNITS,
  MOCK_ROUTING_RULES,
  INITIAL_SYSTEM_RULES,
  MOCK_AUDIT_LOGS,
  MOCK_PLATFORM_CORPORATIONS,
  MOCK_AI_MODELS,
  MOCK_HELPDESK_REDIRECTS
} from '../data/mockData';
import { ApiClient } from '../services/api';
import { backendTicketToComplaint, mergeBackendTickets } from '../services/ticketSync';

export type ScreenId = 
  // Batch 1 Screens
  | 'M1_LANGUAGE'
  | 'M2_CITIZEN_LOGIN'
  | 'M3_OFFICER_LOGIN'
  | 'M4_NOTIFICATIONS'
  | 'M5_PROFILE'
  | 'C1_HOME'
  | 'C2_MEDIA'
  | 'C3_AI_CLASSIFY'
  | 'C4_LOCATION'
  | 'C5_REVIEW'
  | 'C6_SUCCESS'
  | 'C7_COMPLAINTS'
  | 'C8_DETAIL'
  | 'C9_RATE'
  | 'C10_MAP'
  | 'C11_DIRECTORY'
  | 'OFFICER_DASHBOARD'
  // Batch 2 Citizen Screens
  | 'C12_MY_COMPLAINTS'
  | 'C13_COMPLAINT_DETAIL'
  | 'C14_RESOLVED_FEEDBACK'
  // Batch 2 Field Officer Screens
  | 'F1_WORK_QUEUE'
  | 'F2_OFFICER_DETAIL'
  | 'F3_POST_UPDATE'
  | 'F4_REQUEST_DATE'
  | 'F5_TRANSFER'
  | 'F6_DUPLICATES'
  | 'F7_RESOLVE'
  | 'F8_REJECT'
  // Batch 2/3 Supervisor Screens (Web)
  | 'S1_SUPERVISOR_OVERVIEW'
  | 'S2_TO_CHECK'
  | 'S3_ESCALATIONS'
  | 'S4_APPROVALS'
  | 'S5_OFFICERS_LEAVE'
  | 'S6_PERFORMANCE'
  // Batch 3 Corporation Admin Screens
  | 'A1_CITY_DASHBOARD'
  | 'A2_ORGANISATION'
  | 'A3_CATEGORIES_DEADLINES'
  | 'A_ROUTING'
  | 'A4_USERS'
  | 'A6_RULES'
  | 'A_REPORTS'
  | 'A_AUDIT'
  // Batch 3 Helpdesk Screens
  | 'H1_NEW_COMPLAINT'
  | 'H2_SEARCH_STATUS'
  | 'H_TODAYS_LOG'
  // Batch 3 Platform Admin Screens
  | 'P1_CORPORATIONS'
  | 'P_AI_MODELS'
  | 'P_TEMPLATES'
  // Platform Admin: AI & Model Management
  | 'P_AI_OVERVIEW'
  | 'P_AI_HISTORY'
  | 'P_AI_PARAMETERS'
  | 'P_AI_RETRAINING';

interface DraftComplaint {
  photoUrls: string[];
  categoryId: string;
  categoryNameMr: string;
  categoryNameEn: string;
  departmentMr: string;
  departmentEn: string;
  departmentId: string;
  latitude: number;
  longitude: number;
  address: string;
  wardNumber: number;
  wardName: string;
  landmark: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  voiceNoteUrl?: string;
  voiceTranscript?: string;
  voiceDurationSeconds?: number;
  /** Voice note stored by the backend (audio + transcript); linked to the complaint on submit. */
  voiceNote?: ComplaintVoiceNote;
  routeChannel: 'AI' | 'citizen choice' | 'helpdesk';
  isAnonymous?: boolean;
  /** Result of the Step 2 image analysis and whether the citizen accepted an AI suggestion. */
  aiClassification?: DraftAIClassification;
}

/** Values confirmed by the backend when the complaint was persisted there (same ticket id everywhere). */
export interface SubmitOverrides {
  id?: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  voiceNote?: ComplaintVoiceNote;
  photoUrls?: string[];
  aiAnalysis?: ComplaintAIAnalysis;
}

interface AppContextType {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  currentScreen: ScreenId;
  navigateTo: (screen: ScreenId) => void;
  currentUser: UserProfile;
  users: UserProfile[];
  userRole: UserRole;
  switchUser: (userId: string) => void;
  complaints: Complaint[];
  notifications: NotificationItem[];
  unreadNotifCount: number;
  selectedComplaintId: string | null;
  selectedComplaint: Complaint | undefined;
  draftComplaint: DraftComplaint;
  updateDraft: (updates: Partial<DraftComplaint>) => void;
  resetDraft: () => void;
  selectComplaint: (id: string, targetScreen?: ScreenId) => void;
  loginAsCitizen: (mobile: string, name?: string) => void;
  loginWithEmail: (email: string, pass: string) => boolean;
  /** Pull tickets from the backend (same tickets citizens submitted) into the dashboard; needs a staff session. */
  syncBackendTickets: () => Promise<number>;
  logout: () => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  submitDraftComplaint: (overrides?: SubmitOverrides) => Complaint;

  // Complaint lifecycle operations
  acceptComplaint: (id: string) => void;
  postUpdate: (id: string, milestone: string, note: string, photoUrl?: string) => void;
  requestTargetDate: (id: string, newDate: string, reason: 'Monsoon' | 'Needs tender or work order' | 'Material awaited' | 'Other', note: string) => void;
  approveTargetDate: (id: string, supervisorComment?: string) => void;
  declineTargetDate: (id: string, note?: string) => void;
  transferComplaint: (id: string, targetDept: string, reason: string) => void;
  approveTransfer: (id: string, targetDept: string) => void;
  declineTransfer: (id: string) => void;
  linkDuplicates: (parentId: string, childIds: string[]) => void;
  resolveWithPhoto: (id: string, afterPhotoUrl: string, distanceMeters: number, whatWasDone: string[], note: string) => void;
  requestRejection: (id: string, reason: 'Not a civic issue' | 'Outside corporation area' | 'Fake or invalid' | 'Duplicate' | 'Other', note: string) => void;
  approveRejection: (id: string, supervisorComment?: string) => void;
  declineRejection: (id: string, supervisorComment?: string) => void;
  reopenComplaint: (id: string, reason: string) => void;
  escalateToSupervisorDirect: (id: string, note: string) => void;
  submitComplaintRating: (id: string, stars: number, comment?: string) => void;
  supervisorInstruct: (id: string, message: string, deadline: string) => void;
  supervisorConfirmDepartment: (id: string, confirmedDeptId: string) => void;
  flaggedPhotoDecision: (id: string, accept: boolean) => void;
  verifyDangerFlag: (id: string, isDangerous: boolean) => void;

  // Supervisor officers & leave
  officerJoinRequests: OfficerJoinRequest[];
  inviteOfficer: (name: string, emailOrMobile: string, department: string, roleTitle: string) => string;
  approveOfficerJoin: (reqId: string) => void;
  declineOfficerJoin: (reqId: string) => void;
  toggleOfficerLeave: (officerId: string, onLeave: boolean, untilDate?: string, backupId?: string) => void;

  // Corporation Admin: Categories & SLA
  categories: ComplaintCategory[];
  updateCategoryDeadline: (catId: string, newDays: number) => void;
  toggleCategoryActive: (catId: string) => void;
  addCategory: (cat: Omit<ComplaintCategory, 'id'>) => void;
  editCategory: (id: string, updates: Partial<ComplaintCategory>) => void;

  // Corporation Admin: Organisation
  orgUnits: OrgUnit[];
  addOrgUnit: (unit: Omit<OrgUnit, 'id'>) => void;
  updateOrgUnit: (id: string, updates: Partial<OrgUnit>) => void;
  deleteOrgUnit: (id: string) => { success: boolean; error?: string };
  loadMaharashtraTemplateUnits: () => void;

  // Corporation Admin: Routing
  routingRules: RoutingRule[];
  addRoutingRule: (rule: Omit<RoutingRule, 'id'>) => { success: boolean; error?: string };
  deleteRoutingRule: (id: string) => void;
  testRoute: (categoryId: string, wardNumber: number, lat?: number, lng?: number) => { 
    unit: OrgUnit | undefined; 
    officerName: string; 
    officerRoleTitle: string; 
    responseHours: number; 
    fixDays: number; 
    isVacant: boolean; 
    isSupervisorToCheck: boolean; 
  };

  // Corporation Admin: Users
  adminInviteUser: (name: string, emailOrMobile: string, unitId: string, roleTitle: string, role: 'supervisor' | 'helpdesk') => string;
  regenerateUserInvite: (userId: string) => string;
  resetUserPassword: (userId: string) => void;
  toggleUserDisabled: (userId: string) => { success: boolean; error?: string };

  // Corporation Admin: Rules
  systemRules: SystemRules;
  updateSystemRules: (updates: Partial<SystemRules>) => void;
  resetSystemRulesToTemplate: () => void;

  // Audit Log
  auditLogs: AuditLogEntry[];
  addAuditLog: (action: string, refEntity: string, details: string, actorName?: string, actorRole?: string) => void;

  // Helpdesk Operations
  helpdeskRedirectLogs: HelpdeskRedirectLog[];
  logHelpdeskRedirect: (categoryName: string, agency: string, phone: string, callerMobile?: string, notes?: string) => void;
  helpdeskCreateComplaint: (input: { 
    channel: 'Phone' | 'Walk-in' | 'WhatsApp' | 'Aaple Sarkar'; 
    citizenMobile?: string; 
    citizenName?: string; 
    isAnonymous?: boolean; 
    description: string; 
    categoryId: string; 
    address: string; 
    wardNumber: number; 
    photoUrl?: string; 
    isDangerToLife?: boolean; 
  }) => Complaint;
  helpdeskReopenComplaint: (id: string, reason: string) => { success: boolean; error?: string };
  helpdeskAddNote: (id: string, note: string) => void;

  // Platform Admin
  platformCorporations: PlatformCorporation[];
  createPlatformCorporation: (nameEn: string, nameMr: string, code: string) => string;
  toggleCorporationStatus: (id: string, newStatus: 'Live' | 'Draft' | 'Suspended') => void;
  regenerateCorporationInvite: (id: string) => string;
  aiModelRegistry: AIModelRegistryItem[];
  setAIModelForCorporation: (modelId: string, corpCode: string) => void;

  // Supervisor-overdue list helper
  supervisorOverdueComplaints: Complaint[];

  // Dev Time-Travel
  simulatedNow: Date;
  advanceSimulatedTime: (hours: number) => void;
  resetSimulatedTime: () => void;
  isDevPanelOpen: boolean;
  setIsDevPanelOpen: (open: boolean) => void;

  // View frame
  isMobileDeviceFrame: boolean;
  setIsMobileDeviceFrame: (val: boolean) => void;
}

const defaultDraft: DraftComplaint = {
  photoUrls: [],
  categoryId: 'roads_potholes',
  categoryNameMr: 'रस्ते आणि खड्डे',
  categoryNameEn: 'Roads & Footpaths',
  departmentMr: 'सार्वजनिक बांधकाम (रस्ते)',
  departmentEn: 'Public Works (Roads)',
  departmentId: 'roads',
  latitude: 16.8524,
  longitude: 74.5815,
  address: 'Opposite Walchand College Gate, Vishrambag, Sangli',
  wardNumber: 12,
  wardName: 'Vishrambag Ward 12',
  landmark: 'Walchand College Gate',
  description: '',
  priority: 'high',
  routeChannel: 'AI',
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const savedLang = localStorage.getItem('nagarnetra_lang') as AppLanguage | null;
  const [language, setLanguageState] = useState<AppLanguage>(savedLang || 'mr');

  // Simulated Time
  const [simulatedNow, setSimulatedNow] = useState<Date>(new Date(INITIAL_SIMULATED_TIME));
  const [isDevPanelOpen, setIsDevPanelOpen] = useState<boolean>(false);

  const [users, setUsers] = useState<UserProfile[]>(MOCK_USERS);
  const [currentUser, setCurrentUser] = useState<UserProfile>(MOCK_USERS[0]); // default Sunita Patil
  const [complaints, setComplaints] = useState<Complaint[]>(MOCK_COMPLAINTS);
  const [notifications, setNotifications] = useState<NotificationItem[]>(MOCK_NOTIFICATIONS);
  const [officerJoinRequests, setOfficerJoinRequests] = useState<OfficerJoinRequest[]>(MOCK_OFFICER_JOIN_REQUESTS);
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>('NN-2026-000101');
  const [draftComplaint, setDraftComplaint] = useState<DraftComplaint>(defaultDraft);
  const [isMobileDeviceFrame, setIsMobileDeviceFrame] = useState<boolean>(false);

  // Web State
  const [categories, setCategories] = useState<ComplaintCategory[]>(MOCK_CATEGORIES);
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>(MOCK_ORG_UNITS);
  const [routingRules, setRoutingRules] = useState<RoutingRule[]>(MOCK_ROUTING_RULES);
  const [systemRules, setSystemRules] = useState<SystemRules>(INITIAL_SYSTEM_RULES);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(MOCK_AUDIT_LOGS);
  const [helpdeskRedirectLogs, setHelpdeskRedirectLogs] = useState<HelpdeskRedirectLog[]>(MOCK_HELPDESK_REDIRECTS);
  const [platformCorporations, setPlatformCorporations] = useState<PlatformCorporation[]>(MOCK_PLATFORM_CORPORATIONS);
  const [aiModelRegistry, setAiModelRegistry] = useState<AIModelRegistryItem[]>(MOCK_AI_MODELS);

  const [currentScreen, setCurrentScreen] = useState<ScreenId>('C12_MY_COMPLAINTS');

  const setLanguage = (lang: AppLanguage) => {
    setLanguageState(lang);
    localStorage.setItem('nagarnetra_lang', lang);
  };

  const navigateTo = (screen: ScreenId) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setCurrentScreen(screen);
  };

  const selectComplaint = (id: string, targetScreen: ScreenId = 'C13_COMPLAINT_DETAIL') => {
    setSelectedComplaintId(id);
    navigateTo(targetScreen);
  };

  const switchUser = (userId: string) => {
    const found = users.find(u => u.id === userId);
    if (found) {
      setCurrentUser(found);
      // Keep the backend session in step with the switched user. Without this, admin-only pages
      // would be called with the previous user's token and get 403.
      if (found.role !== 'citizen' && found.email) {
        ApiClient.staffLogin(found.email.trim().toLowerCase())
          .then(() => syncBackendTickets())
          .catch(() => ApiClient.setToken(null));
      } else {
        ApiClient.setToken(null);
      }
      if (found.role === 'citizen') {
        navigateTo('C12_MY_COMPLAINTS');
      } else if (found.role === 'officer') {
        navigateTo('F1_WORK_QUEUE');
      } else if (found.role === 'supervisor') {
        navigateTo('S1_SUPERVISOR_OVERVIEW');
      } else if (found.role === 'admin') {
        navigateTo('A1_CITY_DASHBOARD');
      } else if (found.role === 'helpdesk') {
        navigateTo('H1_NEW_COMPLAINT');
      } else if (found.role === 'platform') {
        navigateTo('P1_CORPORATIONS');
      }
    }
  };

  const loginAsCitizen = (mobile: string, name?: string) => {
    const found = users.find(u => u.mobile === mobile && u.role === 'citizen');
    if (found) {
      setCurrentUser(found);
    } else {
      const newCit: UserProfile = {
        id: `usr_${Date.now()}`,
        name: name || 'Citizen',
        mobile,
        role: 'citizen',
        wardId: 12,
        wardName: 'Vishrambag Ward 12',
      };
      setUsers(prev => [newCit, ...prev]);
      setCurrentUser(newCit);
    }
    navigateTo('C12_MY_COMPLAINTS');
  };

  const syncBackendTickets = async (): Promise<number> => {
    if (!ApiClient.getToken()) return 0;
    try {
      const rows: any[] = await ApiClient.getComplaints({ limit: '200' });
      const mapped = rows.map(r => backendTicketToComplaint(r, categories));
      setComplaints(prev => mergeBackendTickets(prev, mapped));
      return mapped.length;
    } catch (err) {
      console.warn('[NagarNetra] backend ticket sync failed', err);
      return 0;
    }
  };

  const loginWithEmail = (email: string, pass: string): boolean => {
    const cleanEmail = email.trim().toLowerCase();
    const found = users.find(u => u.email?.toLowerCase() === cleanEmail);
    if (found) {
      setCurrentUser(found);
      if (found.role !== 'citizen') {
        // Real backend session (same credentials) so the dashboard can load backend tickets.
        ApiClient.staffLogin(cleanEmail, pass)
          .then(() => syncBackendTickets())
          .catch(() => ApiClient.setToken(null));
      }
      if (found.role === 'officer') {
        navigateTo('F1_WORK_QUEUE');
      } else if (found.role === 'supervisor') {
        navigateTo('S1_SUPERVISOR_OVERVIEW');
      } else if (found.role === 'admin') {
        navigateTo('A1_CITY_DASHBOARD');
      } else if (found.role === 'helpdesk') {
        navigateTo('H1_NEW_COMPLAINT');
      } else if (found.role === 'platform') {
        navigateTo('P1_CORPORATIONS');
      } else {
        navigateTo('C12_MY_COMPLAINTS');
      }
      return true;
    }
    return false;
  };

  const logout = () => {
    ApiClient.setToken(null);
    navigateTo('M2_CITIZEN_LOGIN');
  };

  const markNotificationRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const markAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const updateDraft = (updates: Partial<DraftComplaint>) => {
    setDraftComplaint(prev => ({ ...prev, ...updates }));
  };

  const resetDraft = () => {
    setDraftComplaint(defaultDraft);
  };

  // Helper to add timeline entry & in-app notification
  const addTimelineEvent = (
    complaintId: string, 
    step: Omit<ComplaintTimelineStep, 'id' | 'timestamp'>,
    notification?: { role: UserRole | 'all'; titleEn: string; titleMr: string; messageEn: string; messageMr: string }
  ) => {
    const timeStr = simulatedNow.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const fullStep: ComplaintTimelineStep = {
      ...step,
      id: `step_${Date.now()}_${Math.random()}`,
      timestamp: timeStr,
    };

    setComplaints(prev => prev.map(c => {
      if (c.id !== complaintId) return c;
      return {
        ...c,
        timeline: [fullStep, ...c.timeline],
        updatedAt: simulatedNow.toISOString(),
      };
    }));

    if (notification) {
      const newNotif: NotificationItem = {
        id: `notif_${Date.now()}_${Math.random()}`,
        recipientRole: notification.role,
        titleEn: notification.titleEn,
        titleMr: notification.titleMr,
        messageEn: notification.messageEn,
        messageMr: notification.messageMr,
        complaintId,
        type: 'status_update',
        isRead: false,
        createdAt: 'Just now',
      };
      setNotifications(prev => [newNotif, ...prev]);
    }
  };

  // DEV TIME-TRAVEL ENGINE
  const advanceSimulatedTime = (hours: number) => {
    const nextTime = new Date(simulatedNow.getTime() + hours * 60 * 60 * 1000);
    setSimulatedNow(nextTime);

    // Run scheduled jobs over complaints:
    setComplaints(prev => prev.map(c => {
      let updated = { ...c };

      // 1. Response clock check (48h or 24h if urgent)
      if ((updated.status === 'ASSIGNED' || updated.status === 'SUBMITTED') && !updated.responseMet) {
        const respDeadline = new Date(updated.responseDeadline);
        if (nextTime > respDeadline && !updated.escalationLevel) {
          updated.escalationLevel = 'L1';
          updated.escalationReason = 'response missed';
          updated.escalatedAt = nextTime.toISOString();
          // Add timeline entry
          updated.timeline = [
            {
              id: `esc_${Date.now()}_resp`,
              status: updated.status,
              titleMr: 'स्तर १ उल्लंघन: प्रतिसाद मुदत उलटली',
              titleEn: 'Escalated L1 – response missed',
              timestamp: nextTime.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
              actorName: 'System Watchdog',
              actorRole: 'System',
              comment: 'No officer response action inside statutory response clock.',
            },
            ...updated.timeline,
          ];
        }
      }

      // 2. Resolution deadline check
      if ((updated.status === 'IN_PROGRESS' || updated.status === 'WORK_SCHEDULED') && updated.resolutionDeadline) {
        const resDeadline = new Date(updated.resolutionDeadline);
        if (nextTime > resDeadline && !updated.escalationLevel) {
          updated.escalationLevel = 'L1';
          updated.escalationReason = 'deadline missed';
          updated.escalatedAt = nextTime.toISOString();
          updated.timeline = [
            {
              id: `esc_${Date.now()}_res`,
              status: updated.status,
              titleMr: 'स्तर १ उल्लंघन: निवारण मुदत उलटली',
              titleEn: 'Escalated L1 – deadline missed',
              timestamp: nextTime.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
              actorName: 'System Watchdog',
              actorRole: 'System',
              comment: 'Target completion deadline expired without resolution.',
            },
            ...updated.timeline,
          ];
        }
      }

      // 3. Auto-close 7 days after RESOLVED if not reopened
      if (updated.status === 'RESOLVED' && updated.reopenDeadline) {
        const reopenEnd = new Date(updated.reopenDeadline);
        if (nextTime > reopenEnd) {
          updated.status = 'CLOSED';
          updated.timeline = [
            {
              id: `close_${Date.now()}`,
              status: 'CLOSED',
              titleMr: 'तक्रार आपोआप बंद (७ दिवसांत पुनःउघड नाही)',
              titleEn: 'Automatically Closed',
              timestamp: nextTime.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
              actorName: 'System Engine',
              actorRole: 'System',
              comment: '7 days elapsed after resolution with no citizen reopen request.',
            },
            ...updated.timeline,
          ];
        }
      }

      return updated;
    }));

    // 4. Return officers on leave if leave expired
    setUsers(prev => prev.map(u => {
      if (u.isOnLeave && u.leaveUntil) {
        if (nextTime > new Date(u.leaveUntil)) {
          return { ...u, isOnLeave: false, leaveUntil: undefined, backupOfficerId: undefined };
        }
      }
      return u;
    }));
  };

  const resetSimulatedTime = () => {
    setSimulatedNow(new Date(INITIAL_SIMULATED_TIME));
    setComplaints(MOCK_COMPLAINTS);
    setNotifications(MOCK_NOTIFICATIONS);
    setUsers(MOCK_USERS);
  };

  // 1. Citizen submits complaint (connects Batch 1 flow -> F1/S2)
  const submitDraftComplaint = (overrides: SubmitOverrides = {}): Complaint => {
    const tokenNum = overrides.id || `NN-2026-${Math.floor(100000 + Math.random() * 900000)}`;
    const voiceNote = overrides.voiceNote ?? draftComplaint.voiceNote;
    const finalDescription = overrides.description ?? draftComplaint.description;
    const clientAI = draftComplaint.aiClassification?.result;
    const aiAnalysis: ComplaintAIAnalysis | undefined = overrides.aiAnalysis ?? (clientAI && clientAI.predictions.length
      ? {
          source: 'client',
          acceptedIssueCode: draftComplaint.aiClassification?.acceptedIssueCode ?? null,
          predictions: clientAI.predictions.map(p => ({
            rank: p.rank, issue_code: p.issue_code, issue_name: p.issue_name, issue_name_mr: p.issue_name_mr,
            confidence: p.confidence, confidence_band: p.confidence_band, recommended: p.recommended,
            app_category_id: p.app_category_id,
          })),
        }
      : undefined);
    const cat = MOCK_CATEGORIES.find(c => c.id === draftComplaint.categoryId) || MOCK_CATEGORIES[0];
    const isUrgent = (overrides.priority ?? draftComplaint.priority) === 'urgent';
    const respHours = isUrgent ? 24 : 48;
    const respDeadline = new Date(simulatedNow.getTime() + respHours * 60 * 60 * 1000).toISOString();
    const fixDeadline = new Date(simulatedNow.getTime() + cat.slaHours * 60 * 60 * 1000).toISOString();
    const isToCheck = draftComplaint.routeChannel === 'citizen choice';

    const newComp: Complaint = {
      id: tokenNum,
      trackingNumber: tokenNum,
      categoryId: cat.id,
      categoryNameMr: cat.nameMr,
      categoryNameEn: cat.nameEn,
      department: cat.department,
      departmentId: cat.departmentId,
      departmentMr: cat.departmentMr,
      status: isToCheck ? 'TO_CHECK' : 'ASSIGNED',
      priority: overrides.priority ?? draftComplaint.priority,
      description: finalDescription || 'Pothole on roadway causing traffic hazard.',
      voiceNote,
      voiceNoteUrl: voiceNote?.audioUrl,
      voiceTranscript: voiceNote ? (voiceNote.transcript ?? undefined) : undefined,
      voiceDurationSeconds: voiceNote ? Math.round(voiceNote.durationSeconds) : undefined,
      aiAnalysis,
      photoUrls: overrides.photoUrls?.length ? overrides.photoUrls : draftComplaint.photoUrls.length > 0 ? draftComplaint.photoUrls : [
        'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=800&q=80'
      ],
      photoBadge: 'VERIFIED',
      latitude: draftComplaint.latitude,
      longitude: draftComplaint.longitude,
      address: draftComplaint.address,
      wardNumber: draftComplaint.wardNumber,
      wardName: draftComplaint.wardName,
      landmark: draftComplaint.landmark,
      citizenName: draftComplaint.isAnonymous ? 'Anonymous citizen' : currentUser.name,
      citizenMobile: draftComplaint.isAnonymous ? '' : currentUser.mobile,
      isAnonymous: draftComplaint.isAnonymous,
      routeChannel: draftComplaint.routeChannel,
      // Real model confidence of the accepted AI suggestion; undefined when the category was chosen manually.
      aiConfidence: draftComplaint.aiClassification?.acceptedConfidence != null
        ? Math.round(draftComplaint.aiClassification.acceptedConfidence * 100)
        : undefined,
      createdAt: simulatedNow.toISOString(),
      updatedAt: simulatedNow.toISOString(),
      responseDeadline: respDeadline,
      responseMet: false,
      resolutionDeadline: fixDeadline,
      escalationLevel: null,
      escalationReason: null,
      reopenCount: 0,
      reopenDeadline: new Date(simulatedNow.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      timeline: [
        {
          id: `t_sub_${Date.now()}`,
          status: 'SUBMITTED',
          titleMr: 'तक्रार यशस्वीरीत्या नोंदवली',
          titleEn: 'Complaint Registered',
          timestamp: simulatedNow.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
          actorName: draftComplaint.isAnonymous ? 'Anonymous citizen' : currentUser.name,
          actorRole: 'Citizen',
          comment: finalDescription,
        },
        {
          id: `t_asg_${Date.now()}`,
          status: isToCheck ? 'TO_CHECK' : 'ASSIGNED',
          titleMr: isToCheck ? 'अधीक्षक पडताळणी रांगेत वर्ग' : `${cat.departmentMr} कडे नियुक्त`,
          titleEn: isToCheck ? 'Queued for Supervisor Department Check' : `Assigned to ${cat.department}`,
          timestamp: simulatedNow.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
          actorName: 'NagarNetra Router',
          actorRole: 'System',
        }
      ]
    };

    setComplaints(prev => [newComp, ...prev]);
    setSelectedComplaintId(newComp.id);
    resetDraft();
    return newComp;
  };

  // 2. Officer accepts complaint (ASSIGNED -> IN_PROGRESS, meets response clock)
  const acceptComplaint = (id: string) => {
    setComplaints(prev => prev.map(c => {
      if (c.id !== id) return c;
      return {
        ...c,
        status: 'IN_PROGRESS',
        responseMet: true,
        responseMetAt: simulatedNow.toISOString(),
        timeline: [
          {
            id: `step_${Date.now()}`,
            status: 'IN_PROGRESS',
            titleMr: 'अधिकाऱ्यांनी तक्रार स्वीकारली',
            titleEn: 'Officer Inspected & Accepted',
            timestamp: simulatedNow.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
            actorName: 'Field officer',
            actorRole: 'Field officer',
            comment: 'On-site inspection initiated. Response clock met.',
          },
          ...c.timeline,
        ]
      };
    }));

    // Notify citizen
    const newNotif: NotificationItem = {
      id: `notif_${Date.now()}`,
      recipientRole: 'citizen',
      titleEn: `Field officer accepted ${id}`,
      titleMr: `अधिकाऱ्यांनी काम सुरू केले (${id})`,
      messageEn: `The field officer has inspected and accepted your complaint. Work is in progress.`,
      messageMr: `क्षेत्रीय अधिकाऱ्यांनी जागेची पाहणी करून काम सुरू केले आहे.`,
      complaintId: id,
      type: 'status_update',
      isRead: false,
      createdAt: 'Just now',
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  // 3. Officer posts update (milestone + note + photo)
  const postUpdate = (id: string, milestone: string, note: string, photoUrl?: string) => {
    setComplaints(prev => prev.map(c => {
      if (c.id !== id) return c;
      const isFirst = !c.responseMet;
      return {
        ...c,
        status: c.status === 'ASSIGNED' ? 'IN_PROGRESS' : c.status,
        responseMet: true,
        responseMetAt: isFirst ? simulatedNow.toISOString() : c.responseMetAt,
        timeline: [
          {
            id: `step_${Date.now()}`,
            status: c.status === 'ASSIGNED' ? 'IN_PROGRESS' : c.status,
            titleMr: `अपडेट: ${milestone}`,
            titleEn: `Update: ${milestone}`,
            timestamp: simulatedNow.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
            actorName: 'Field officer',
            actorRole: 'Field officer',
            comment: note,
            photoUrl: photoUrl,
          },
          ...c.timeline,
        ]
      };
    }));

    const notif: NotificationItem = {
      id: `notif_${Date.now()}`,
      recipientRole: 'citizen',
      titleEn: `Progress update on ${id}`,
      titleMr: `कामाचा अपडेट: ${id}`,
      messageEn: `${milestone}: ${note}`,
      messageMr: `${milestone}: ${note}`,
      complaintId: id,
      type: 'status_update',
      isRead: false,
      createdAt: 'Just now',
    };
    setNotifications(prev => [notif, ...prev]);
  };

  // 4. Officer requests new target date (creates approval for supervisor)
  const requestTargetDate = (
    id: string, 
    newDate: string, 
    reason: 'Monsoon' | 'Needs tender or work order' | 'Material awaited' | 'Other', 
    note: string
  ) => {
    setComplaints(prev => prev.map(c => {
      if (c.id !== id) return c;
      return {
        ...c,
        extensionRequest: {
          requestedDate: newDate,
          reason,
          note,
          requestedAt: simulatedNow.toISOString(),
          status: 'PENDING',
        },
        timeline: [
          {
            id: `step_${Date.now()}`,
            status: c.status,
            titleMr: 'नवीन मुदतवाढ विनंती पाठवली',
            titleEn: 'Extension requested by officer',
            timestamp: simulatedNow.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
            actorName: 'Field officer',
            actorRole: 'Field officer',
            comment: `Requested target date: ${new Date(newDate).toLocaleDateString('en-GB')}. Reason: ${reason} - ${note}`,
          },
          ...c.timeline,
        ]
      };
    }));

    const notif: NotificationItem = {
      id: `notif_${Date.now()}`,
      recipientRole: 'supervisor',
      titleEn: `Extension Approval Request: ${id}`,
      titleMr: `मुदतवाढ मंजुरी विनंती: ${id}`,
      messageEn: `Officer requested new target date ${new Date(newDate).toLocaleDateString('en-GB')} for ${id}.`,
      messageMr: `${id} साठी नवीन मुदत तारीख मंजुरीची विनंती.`,
      complaintId: id,
      type: 'approval',
      isRead: false,
      createdAt: 'Just now',
    };
    setNotifications(prev => [notif, ...prev]);
  };

  // 5. Supervisor approves target date -> WORK_SCHEDULED
  const approveTargetDate = (id: string, supervisorComment?: string) => {
    setComplaints(prev => prev.map(c => {
      if (c.id !== id || !c.extensionRequest) return c;
      const targetDate = c.extensionRequest.requestedDate;
      return {
        ...c,
        status: 'WORK_SCHEDULED',
        scheduledTargetDate: targetDate,
        scheduledTargetApproved: true,
        resolutionDeadline: targetDate,
        extensionRequest: {
          ...c.extensionRequest,
          status: 'APPROVED',
          supervisorComment: supervisorComment || 'Approved schedule adjustment.',
        },
        timeline: [
          {
            id: `step_${Date.now()}`,
            status: 'WORK_SCHEDULED',
            titleMr: `कामाचे नियोजित उद्दिष्ट ${new Date(targetDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} मंजूर`,
            titleEn: `Work scheduled – new date ${new Date(targetDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
            timestamp: simulatedNow.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
            actorName: 'Supervisor (DMC 1)',
            actorRole: 'Supervisor',
            comment: supervisorComment || `Extension approved by supervisor. Target date re-baselined to ${new Date(targetDate).toLocaleDateString('en-GB')}.`,
          },
          ...c.timeline,
        ]
      };
    }));

    // Notify citizen & officer
    const notif: NotificationItem = {
      id: `notif_${Date.now()}`,
      recipientRole: 'citizen',
      titleEn: `Work scheduled – new date for ${id}`,
      titleMr: `कामाची नवीन तारीख निश्चित (${id})`,
      messageEn: `Supervisor approved work schedule target date for ${id}.`,
      messageMr: `पर्यवेक्षकांनी तक्रार ${id} साठी नवीन कामाची तारीख मंजूर केली आहे.`,
      complaintId: id,
      type: 'status_update',
      isRead: false,
      createdAt: 'Just now',
    };
    setNotifications(prev => [notif, ...prev]);
  };

  // 6. Supervisor declines target date
  const declineTargetDate = (id: string, note?: string) => {
    setComplaints(prev => prev.map(c => {
      if (c.id !== id || !c.extensionRequest) return c;
      return {
        ...c,
        extensionRequest: {
          ...c.extensionRequest,
          status: 'DECLINED',
          supervisorComment: note || 'Declined. Original target remains.',
        },
        timeline: [
          {
            id: `step_${Date.now()}`,
            status: c.status,
            titleMr: 'मुदतवाढ विनंती नाकारली',
            titleEn: 'Extension Declined by Supervisor',
            timestamp: simulatedNow.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
            actorName: 'Supervisor (DMC 1)',
            actorRole: 'Supervisor',
            comment: note || 'Original target date stays in effect.',
          },
          ...c.timeline,
        ]
      };
    }));
  };

  // 7. Officer transfers complaint
  const transferComplaint = (id: string, targetDept: string, reason: string) => {
    const comp = complaints.find(c => c.id === id);
    if (!comp) return;

    // Check if this is the first transfer or second transfer
    const isFirstTransfer = !comp.transferRequest || comp.transferRequest.transferCount === 0;

    if (isFirstTransfer) {
      // First transfer: routes directly to active officer (or backup if on leave), clocks restart, total age kept
      const cat = MOCK_CATEGORIES.find(cat => cat.department === targetDept || cat.departmentId === targetDept) || MOCK_CATEGORIES[0];
      const respHours = comp.priority === 'urgent' ? 24 : 48;
      const newRespDeadline = new Date(simulatedNow.getTime() + respHours * 60 * 60 * 1000).toISOString();
      const newFixDeadline = new Date(simulatedNow.getTime() + cat.slaHours * 60 * 60 * 1000).toISOString();

      setComplaints(prev => prev.map(c => {
        if (c.id !== id) return c;
        return {
          ...c,
          department: cat.department,
          departmentId: cat.departmentId,
          departmentMr: cat.departmentMr,
          status: 'ASSIGNED',
          responseMet: false,
          responseDeadline: newRespDeadline,
          resolutionDeadline: newFixDeadline,
          transferRequest: {
            fromDepartment: c.department,
            toDepartment: cat.department,
            reason,
            requestedAt: simulatedNow.toISOString(),
            transferCount: 1,
            status: 'DIRECT_COMPLETED',
          },
          timeline: [
            {
              id: `tr_${Date.now()}`,
              status: 'ASSIGNED',
              titleMr: `${cat.departmentMr} कडे थेट हस्तांतरित`,
              titleEn: `Transferred to ${cat.department}`,
              timestamp: simulatedNow.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
              actorName: 'Field officer',
              actorRole: 'Field officer',
              comment: `Reason: ${reason}. Response and resolution clocks restarted for recipient department.`,
            },
            ...c.timeline,
          ]
        };
      }));
    } else {
      // Second transfer: creates a "second transfer" approval for the supervisor; complaint stays with current officer until decided
      setComplaints(prev => prev.map(c => {
        if (c.id !== id) return c;
        return {
          ...c,
          transferRequest: {
            fromDepartment: c.department,
            toDepartment: targetDept,
            reason,
            requestedAt: simulatedNow.toISOString(),
            transferCount: 2,
            status: 'PENDING_SUPERVISOR',
          },
          timeline: [
            {
              id: `tr_${Date.now()}`,
              status: c.status,
              titleMr: 'दुसरे हस्तांतरण: अधीक्षक मंजुरीची प्रतीक्षा',
              titleEn: 'Second transfer requested – awaiting supervisor',
              timestamp: simulatedNow.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
              actorName: 'Field officer',
              actorRole: 'Field officer',
              comment: `Reason: ${reason}. Awaiting supervisor concurrence before re-routing.`,
            },
            ...c.timeline,
          ]
        };
      }));
    }
  };

  const approveTransfer = (id: string, targetDept: string) => {
    const cat = MOCK_CATEGORIES.find(c => c.department === targetDept || c.departmentId === targetDept) || MOCK_CATEGORIES[0];
    setComplaints(prev => prev.map(c => {
      if (c.id !== id) return c;
      const respHours = c.priority === 'urgent' ? 24 : 48;
      const newRespDeadline = new Date(simulatedNow.getTime() + respHours * 60 * 60 * 1000).toISOString();
      const newFixDeadline = new Date(simulatedNow.getTime() + cat.slaHours * 60 * 60 * 1000).toISOString();

      return {
        ...c,
        department: cat.department,
        departmentId: cat.departmentId,
        departmentMr: cat.departmentMr,
        status: 'ASSIGNED',
        responseMet: false,
        responseDeadline: newRespDeadline,
        resolutionDeadline: newFixDeadline,
        transferRequest: c.transferRequest ? { ...c.transferRequest, status: 'APPROVED', toDepartment: cat.department } : undefined,
        timeline: [
          {
            id: `tr_app_${Date.now()}`,
            status: 'ASSIGNED',
            titleMr: `दुसरे हस्तांतरण मंजूर: ${cat.departmentMr}`,
            titleEn: `Second transfer approved: assigned to ${cat.department}`,
            timestamp: simulatedNow.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
            actorName: 'Supervisor (DMC 1)',
            actorRole: 'Supervisor',
            comment: `Supervisor approved transfer to ${cat.department}. Clocks restarted.`,
          },
          ...c.timeline,
        ]
      };
    }));
  };

  const declineTransfer = (id: string) => {
    setComplaints(prev => prev.map(c => {
      if (c.id !== id) return c;
      return {
        ...c,
        transferRequest: c.transferRequest ? { ...c.transferRequest, status: 'DECLINED' } : undefined,
        timeline: [
          {
            id: `tr_dec_${Date.now()}`,
            status: c.status,
            titleMr: 'हस्तांतरण नाकारले - मूळ अधिकाऱ्याकडे कायम',
            titleEn: 'Transfer Declined by Supervisor',
            timestamp: simulatedNow.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
            actorName: 'Supervisor (DMC 1)',
            actorRole: 'Supervisor',
            comment: 'Remains with originating department.',
          },
          ...c.timeline,
        ]
      };
    }));
  };

  // 8. Officer links possible duplicates
  const linkDuplicates = (parentId: string, childIds: string[]) => {
    setComplaints(prev => prev.map(c => {
      if (c.id === parentId) {
        const updatedChildren = Array.from(new Set([...(c.linkedChildrenIds || []), ...childIds]));
        return {
          ...c,
          linkedChildrenIds: updatedChildren,
          timeline: [
            {
              id: `link_${Date.now()}`,
              status: c.status,
              titleMr: `दुबार तक्रारी जोडल्या: ${childIds.join(', ')}`,
              titleEn: `Linked duplicate tickets: ${childIds.join(', ')}`,
              timestamp: simulatedNow.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
              actorName: 'Field officer',
              actorRole: 'Field officer',
              comment: `Clustered nearby reports within spatial radius. All complainants will receive shared updates.`,
            },
            ...c.timeline,
          ]
        };
      } else if (childIds.includes(c.id)) {
        return {
          ...c,
          linkedParentId: parentId,
          timeline: [
            {
              id: `link_ch_${Date.now()}`,
              status: c.status,
              titleMr: `मुख्य तक्रारीशी जोडले (${parentId})`,
              titleEn: `Linked with ${parentId}`,
              timestamp: simulatedNow.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
              actorName: 'Field officer',
              actorRole: 'Field officer',
              comment: `Linked to parent ${parentId}. This complaint follows parent resolution.`,
            },
            ...c.timeline,
          ]
        };
      }
      return c;
    }));
  };

  // 9. Officer resolves with after-photo
  const resolveWithPhoto = (
    id: string, 
    afterPhotoUrl: string, 
    distanceMeters: number, 
    whatWasDone: string[], 
    note: string
  ) => {
    // If distance > 200m -> FLAGGED, else VERIFIED
    const isFlagged = distanceMeters > 200;
    const photoBadge = isFlagged ? 'FLAGGED' : 'VERIFIED';
    const reopenDeadline = new Date(simulatedNow.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    setComplaints(prev => prev.map(c => {
      if (c.id !== id && c.linkedParentId !== id) return c;
      const isTarget = c.id === id;
      return {
        ...c,
        status: 'RESOLVED',
        resolvedPhotoUrl: afterPhotoUrl,
        resolvedPhotoBadge: photoBadge,
        resolvedPhotoDistanceMeters: distanceMeters,
        resolvedWhatWasDoneChips: whatWasDone,
        resolvedAt: simulatedNow.toISOString(),
        reopenDeadline: reopenDeadline,
        timeline: [
          {
            id: `res_${Date.now()}`,
            status: 'RESOLVED',
            titleMr: isFlagged ? 'निवारण नोंदवले (फोटो तपासणी प्रलंबित)' : 'काम पूर्ण व तक्रार निवारण संपन्न',
            titleEn: isFlagged ? 'Resolved (Photo flagged for supervisor check)' : 'Resolved with Verified After-Photo',
            timestamp: simulatedNow.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
            actorName: 'Field officer',
            actorRole: 'Field officer',
            comment: `${whatWasDone.join(', ')} · ${note} ${isFlagged ? `(Taken ${distanceMeters}m away - flagged to supervisor)` : `(Within ${distanceMeters}m)`}`,
            photoUrl: afterPhotoUrl,
          },
          ...c.timeline,
        ]
      };
    }));

    // In-app notification for citizen
    const notif: NotificationItem = {
      id: `notif_${Date.now()}`,
      recipientRole: 'citizen',
      titleEn: `Complaint ${id} Resolved`,
      titleMr: `तक्रार निवारण संपन्न (${id})`,
      messageEn: `The field officer has marked this issue resolved. Click View & rate or reopen within 7 days.`,
      messageMr: `काम पूर्ण झाले आहे. कृपया पहा व मूल्यमापन करा किंवा ७ दिवसांत पुनःउघडा.`,
      complaintId: id,
      type: 'resolved',
      isRead: false,
      createdAt: 'Just now',
    };
    setNotifications(prev => [notif, ...prev]);
  };

  // 10. Officer requests rejection
  const requestRejection = (
    id: string, 
    reason: 'Not a civic issue' | 'Outside corporation area' | 'Fake or invalid' | 'Duplicate' | 'Other', 
    note: string
  ) => {
    setComplaints(prev => prev.map(c => {
      if (c.id !== id) return c;
      return {
        ...c,
        status: 'REJECTION_REQUESTED',
        rejectionRequest: {
          reason,
          note,
          requestedAt: simulatedNow.toISOString(),
          status: 'PENDING',
        },
        timeline: [
          {
            id: `rej_req_${Date.now()}`,
            status: 'REJECTION_REQUESTED',
            titleMr: `तक्रार नाकारण्याची विनंती: ${reason}`,
            titleEn: `Rejection Requested: ${reason}`,
            timestamp: simulatedNow.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
            actorName: 'Field officer',
            actorRole: 'Field officer',
            comment: note,
          },
          ...c.timeline,
        ]
      };
    }));

    const notif: NotificationItem = {
      id: `notif_${Date.now()}`,
      recipientRole: 'supervisor',
      titleEn: `Rejection Request: ${id}`,
      titleMr: `नाकारण्याची विनंती: ${id}`,
      messageEn: `Officer requested rejection of ${id}. Reason: ${reason}`,
      messageMr: `तक्रार ${id} नाकारण्याची विनंती. कारण: ${reason}`,
      complaintId: id,
      type: 'approval',
      isRead: false,
      createdAt: 'Just now',
    };
    setNotifications(prev => [notif, ...prev]);
  };

  const approveRejection = (id: string, supervisorComment?: string) => {
    setComplaints(prev => prev.map(c => {
      if (c.id !== id || !c.rejectionRequest) return c;
      return {
        ...c,
        status: 'REJECTED',
        rejectedReason: c.rejectionRequest.reason,
        rejectedNote: supervisorComment || c.rejectionRequest.note,
        rejectionRequest: {
          ...c.rejectionRequest,
          status: 'APPROVED',
          supervisorComment,
        },
        timeline: [
          {
            id: `rej_app_${Date.now()}`,
            status: 'REJECTED',
            titleMr: `तक्रार नाकारली: ${c.rejectionRequest.reason}`,
            titleEn: `Complaint Rejected: ${c.rejectionRequest.reason}`,
            timestamp: simulatedNow.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
            actorName: 'Supervisor (DMC 1)',
            actorRole: 'Supervisor',
            comment: supervisorComment || c.rejectionRequest.note,
          },
          ...c.timeline,
        ]
      };
    }));

    // Notify citizen
    const notif: NotificationItem = {
      id: `notif_${Date.now()}`,
      recipientRole: 'citizen',
      titleEn: `Complaint ${id} Rejected`,
      titleMr: `तक्रार नाकारली (${id})`,
      messageEn: `Reason: ${complaints.find(c => c.id === id)?.rejectionRequest?.reason || 'Not a municipal issue'}.`,
      messageMr: `तक्रार मनपा हद्दीबाहेर किंवा अयोग्य असल्याने नाकारण्यात आली.`,
      complaintId: id,
      type: 'status_update',
      isRead: false,
      createdAt: 'Just now',
    };
    setNotifications(prev => [notif, ...prev]);
  };

  const declineRejection = (id: string, supervisorComment?: string) => {
    setComplaints(prev => prev.map(c => {
      if (c.id !== id || !c.rejectionRequest) return c;
      return {
        ...c,
        status: 'IN_PROGRESS',
        rejectionRequest: {
          ...c.rejectionRequest,
          status: 'DECLINED',
          supervisorComment,
        },
        timeline: [
          {
            id: `rej_dec_${Date.now()}`,
            status: 'IN_PROGRESS',
            titleMr: 'नाकारण्याची विनंती अमान्य - काम सुरू ठेवा',
            titleEn: 'Rejection Declined by Supervisor',
            timestamp: simulatedNow.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
            actorName: 'Supervisor (DMC 1)',
            actorRole: 'Supervisor',
            comment: supervisorComment || 'Supervisor instructed to service complaint within corporation scope.',
          },
          ...c.timeline,
        ]
      };
    }));
  };

  // 11. Citizen reopens resolved complaint (max 2 reopens, within 7 days)
  const reopenComplaint = (id: string, reason: string) => {
    setComplaints(prev => prev.map(c => {
      if (c.id !== id) return c;
      const newReopenCount = (c.reopenCount || 0) + 1;
      return {
        ...c,
        status: 'REOPENED',
        reopenCount: newReopenCount,
        timeline: [
          {
            id: `reop_${Date.now()}`,
            status: 'REOPENED',
            titleMr: `तक्रार पुन्हा उघडली (${newReopenCount}/२ वापरले)`,
            titleEn: `Reopened by Citizen (${newReopenCount}/2 used)`,
            timestamp: simulatedNow.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
            actorName: c.isAnonymous ? 'Anonymous citizen' : c.citizenName,
            actorRole: 'Citizen',
            comment: reason,
          },
          ...c.timeline,
        ]
      };
    }));

    // Notify field officer
    const notif: NotificationItem = {
      id: `notif_${Date.now()}`,
      recipientRole: 'officer',
      titleEn: `Complaint ${id} Reopened`,
      titleMr: `तक्रार पुन्हा उघडली (${id})`,
      messageEn: `Citizen reopened issue: ${reason}. Please inspect and rectify.`,
      messageMr: `नागरिकांनी तक्रार पुन्हा उघडली: ${reason}.`,
      complaintId: id,
      type: 'alert',
      isRead: false,
      createdAt: 'Just now',
    };
    setNotifications(prev => [notif, ...prev]);
  };

  // 12. After 2 reopens used: "Still not fixed – send to supervisor"
  const escalateToSupervisorDirect = (id: string, note: string) => {
    setComplaints(prev => prev.map(c => {
      if (c.id !== id) return c;
      return {
        ...c,
        escalationLevel: 'L1',
        escalationReason: 'deadline missed',
        escalatedAt: simulatedNow.toISOString(),
        timeline: [
          {
            id: `esc_cit_${Date.now()}`,
            status: c.status,
            titleMr: 'नागरिकांकडून थेट उपायुक्तांकडे वर्ग',
            titleEn: 'Still not fixed – escalated to supervisor',
            timestamp: simulatedNow.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
            actorName: c.isAnonymous ? 'Anonymous citizen' : c.citizenName,
            actorRole: 'Citizen',
            comment: `Citizen exhausted 2 reopens: ${note}`,
          },
          ...c.timeline,
        ]
      };
    }));

    // Notify supervisor
    const notif: NotificationItem = {
      id: `notif_${Date.now()}`,
      recipientRole: 'supervisor',
      titleEn: `Citizen Escalation (2 reopens exhausted): ${id}`,
      titleMr: `नागरिक थेट तक्रार वर्ग: ${id}`,
      messageEn: `Issue ${id} remains unresolved after 2 officer attempts. Citizen requested supervisor escalation.`,
      messageMr: `दोन वेळा दुरुस्तीनंतरही समस्या कायम असल्याने उपायुक्तांकडे वर्ग.`,
      complaintId: id,
      type: 'escalation',
      isRead: false,
      createdAt: 'Just now',
    };
    setNotifications(prev => [notif, ...prev]);
  };

  // 13. Citizen rates
  const submitComplaintRating = (id: string, stars: number, comment?: string) => {
    setComplaints(prev => prev.map(c => {
      if (c.id !== id) return c;
      return {
        ...c,
        rating: {
          stars,
          comment,
          submittedAt: simulatedNow.toISOString(),
        }
      };
    }));
  };

  // 14. Supervisor sends instruction to officer
  const supervisorInstruct = (id: string, message: string, deadline: string) => {
    setComplaints(prev => prev.map(c => {
      if (c.id !== id) return c;
      return {
        ...c,
        supervisorInstruction: {
          message,
          deadline,
          instructedAt: simulatedNow.toISOString(),
          supervisorName: currentUser.name || 'DMC 1',
        },
        timeline: [
          {
            id: `inst_${Date.now()}`,
            status: c.status,
            titleMr: `अधीक्षक सूचना: ${message}`,
            titleEn: `Supervisory Instruction Added`,
            timestamp: simulatedNow.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
            actorName: 'Supervisor (DMC 1)',
            actorRole: 'Supervisor',
            comment: `Instruction: "${message}". Deadline: ${new Date(deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            isInstruction: true,
          },
          ...c.timeline,
        ]
      };
    }));

    // Notify officer
    const notif: NotificationItem = {
      id: `notif_${Date.now()}`,
      recipientRole: 'officer',
      titleEn: `Supervisory Directive: ${id}`,
      titleMr: `अधीक्षक निर्देश: ${id}`,
      messageEn: `${message} (Deadline: ${new Date(deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
      messageMr: `${message}`,
      complaintId: id,
      type: 'escalation',
      isRead: false,
      createdAt: 'Just now',
    };
    setNotifications(prev => [notif, ...prev]);
  };

  // 15. S2 To Check: confirm department -> ASSIGNED to that department's active officer
  const supervisorConfirmDepartment = (id: string, confirmedDeptId: string) => {
    const cat = MOCK_CATEGORIES.find(c => c.departmentId === confirmedDeptId || c.department === confirmedDeptId) || MOCK_CATEGORIES[0];
    const respHours = 48;
    const respDeadline = new Date(simulatedNow.getTime() + respHours * 60 * 60 * 1000).toISOString();
    const fixDeadline = new Date(simulatedNow.getTime() + cat.slaHours * 60 * 60 * 1000).toISOString();

    setComplaints(prev => prev.map(c => {
      if (c.id !== id) return c;
      return {
        ...c,
        status: 'ASSIGNED',
        department: cat.department,
        departmentId: cat.departmentId,
        departmentMr: cat.departmentMr,
        responseDeadline: respDeadline,
        responseMet: false,
        resolutionDeadline: fixDeadline,
        timeline: [
          {
            id: `conf_dept_${Date.now()}`,
            status: 'ASSIGNED',
            titleMr: `विभागाची खात्री केली: ${cat.departmentMr}`,
            titleEn: `Department Confirmed as ${cat.department}`,
            timestamp: simulatedNow.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
            actorName: 'Supervisor (DMC 1)',
            actorRole: 'Supervisor',
            comment: `DMC confirmed department. Assigned to field officer; 48h response clock initiated.`,
          },
          ...c.timeline,
        ]
      };
    }));

    // Notify field officer of that department
    const notif: NotificationItem = {
      id: `notif_${Date.now()}`,
      recipientRole: 'officer',
      titleEn: `New Complaint Assigned: ${id}`,
      titleMr: `नवीन तक्रार नियुक्त: ${id}`,
      messageEn: `Supervisor verified department. Assigned to your queue (${cat.department}).`,
      messageMr: `अधीक्षकांनी विभागाची खात्री करून आपल्याकडे नियुक्त केले.`,
      complaintId: id,
      type: 'assignment',
      isRead: false,
      createdAt: 'Just now',
    };
    setNotifications(prev => [notif, ...prev]);
  };

  // 16. Flagged after-photo decision by supervisor (Accept resolution / Send back -> IN_PROGRESS)
  const flaggedPhotoDecision = (id: string, accept: boolean) => {
    setComplaints(prev => prev.map(c => {
      if (c.id !== id) return c;
      if (accept) {
        return {
          ...c,
          resolvedPhotoBadge: 'VERIFIED',
          timeline: [
            {
              id: `ph_acc_${Date.now()}`,
              status: 'RESOLVED',
              titleMr: 'अधीक्षकांनी निवारण फोटो मंजूर केला',
              titleEn: 'Supervisor Accepted Resolution Photo',
              timestamp: simulatedNow.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
              actorName: 'Supervisor (DMC 1)',
              actorRole: 'Supervisor',
              comment: 'Reviewed and confirmed resolution photo on site.',
            },
            ...c.timeline,
          ]
        };
      } else {
        return {
          ...c,
          status: 'IN_PROGRESS',
          resolvedPhotoBadge: undefined,
          timeline: [
            {
              id: `ph_rej_${Date.now()}`,
              status: 'IN_PROGRESS',
              titleMr: 'अधीक्षकांनी फोटो नाकारून पुन्हा कामाचे निर्देश दिले',
              titleEn: 'Photo Rejected – Sent back to In Progress',
              timestamp: simulatedNow.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
              actorName: 'Supervisor (DMC 1)',
              actorRole: 'Supervisor',
              comment: 'After-photo was captured beyond 200m or lacked clarity. Sent back for re-inspection.',
            },
            ...c.timeline,
          ]
        };
      }
    }));
  };

  // 17. Verify danger flag
  const verifyDangerFlag = (id: string, isDangerous: boolean) => {
    setComplaints(prev => prev.map(c => {
      if (c.id !== id) return c;
      return {
        ...c,
        dangerVerified: isDangerous,
        priority: isDangerous ? 'urgent' : 'medium',
      };
    }));
  };

  // 18. Officer Leave & Invite operations
  const inviteOfficer = (name: string, emailOrMobile: string, department: string, roleTitle: string): string => {
    const code = `SMKMC-${department.substring(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
    const newReq: OfficerJoinRequest = {
      id: `req_${Date.now()}`,
      name,
      emailOrMobile,
      department,
      roleTitle,
      inviteCodeUsed: code,
      requestedAt: simulatedNow.toISOString(),
      status: 'PENDING',
    };
    setOfficerJoinRequests(prev => [newReq, ...prev]);
    return code;
  };

  const approveOfficerJoin = (reqId: string) => {
    const req = officerJoinRequests.find(r => r.id === reqId);
    if (!req) return;
    setOfficerJoinRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: 'APPROVED' } : r));

    const newOfficerUser: UserProfile = {
      id: `usr_${Date.now()}`,
      name: req.name,
      mobile: req.emailOrMobile.includes('@') ? '9822000000' : req.emailOrMobile,
      email: req.emailOrMobile.includes('@') ? req.emailOrMobile : undefined,
      role: 'officer',
      department: req.department,
      roleTitle: req.roleTitle,
      supervisorUnit: 'DMC 1 – Public Works & Infrastructure',
      isOnLeave: false,
    };
    setUsers(prev => [...prev, newOfficerUser]);
  };

  const declineOfficerJoin = (reqId: string) => {
    setOfficerJoinRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: 'DECLINED' } : r));
  };

  const toggleOfficerLeave = (officerId: string, onLeave: boolean, untilDate?: string, backupId?: string) => {
    const backupOfficer = users.find(u => u.id === backupId);
    setUsers(prev => prev.map(u => {
      if (u.id === officerId) {
        return {
          ...u,
          isOnLeave: onLeave,
          leaveUntil: onLeave ? untilDate : undefined,
          backupOfficerId: onLeave ? backupId : undefined,
          backupOfficerName: onLeave ? backupOfficer?.name : undefined,
        };
      }
      return u;
    }));
  };

  // Audit log helper
  const addAuditLog = (action: string, refEntity: string, details: string, actorName?: string, actorRole?: string) => {
    const newEntry: AuditLogEntry = {
      id: `aud_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      timestamp: simulatedNow.toISOString(),
      actorName: actorName || currentUser.name,
      actorRole: actorRole || currentUser.role,
      action,
      refEntity,
      details,
    };
    setAuditLogs(prev => [newEntry, ...prev]);
  };

  // Categories & SLA
  const updateCategoryDeadline = (catId: string, newDays: number) => {
    const cat = categories.find(c => c.id === catId);
    const oldDays = cat?.resolutionDays || 7;
    setCategories(prev => prev.map(c => c.id === catId ? { ...c, resolutionDays: newDays } : c));
    addAuditLog('SLA Deadline Update', cat?.nameEn || catId, `Changed resolution deadline from ${oldDays} d to ${newDays} d`);
  };

  const toggleCategoryActive = (catId: string) => {
    setCategories(prev => prev.map(c => {
      if (c.id === catId) {
        const next = !(c.isActive ?? true);
        addAuditLog('Category Active Toggle', c.nameEn, `Category ${next ? 'activated' : 'deactivated'}`);
        return { ...c, isActive: next };
      }
      return c;
    }));
  };

  const addCategory = (cat: Omit<ComplaintCategory, 'id'>) => {
    const id = `cat_${Date.now()}`;
    const newCat = { ...cat, id, isActive: true };
    setCategories(prev => [...prev, newCat]);
    addAuditLog('Add Category', newCat.nameEn, `Created category under department ${newCat.department}`);
  };

  const editCategory = (id: string, updates: Partial<ComplaintCategory>) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    addAuditLog('Edit Category', updates.nameEn || id, 'Updated category attributes');
  };

  // Organisation
  const addOrgUnit = (unit: Omit<OrgUnit, 'id'>) => {
    const id = `unit_${Date.now()}`;
    const newUnit = { ...unit, id };
    setOrgUnits(prev => [...prev, newUnit]);
    addAuditLog('Add Org Unit', newUnit.nameEn, `Added unit of level ${newUnit.levelType}`);
  };

  const updateOrgUnit = (id: string, updates: Partial<OrgUnit>) => {
    setOrgUnits(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
    addAuditLog('Update Org Unit', updates.nameEn || id, 'Updated unit configuration');
  };

  const deleteOrgUnit = (id: string): { success: boolean; error?: string } => {
    const unit = orgUnits.find(u => u.id === id);
    if (!unit) return { success: false, error: 'Unit not found' };

    // Block if open complaints
    const hasOpenComplaints = complaints.some(c => 
      (c.departmentId === id || c.department === unit.nameEn) && 
      c.status !== 'RESOLVED' && c.status !== 'CLOSED' && c.status !== 'REJECTED'
    );
    if (hasOpenComplaints) {
      return { success: false, error: 'Cannot delete unit with open complaints. Reassign complaints first.' };
    }

    // Block if active officers
    if (unit.activeOfficerId || users.some(u => u.departmentId === id && !u.isOnLeave)) {
      return { success: false, error: 'Cannot delete unit with active officers assigned. Reassign officers first.' };
    }

    // Block if child units
    const hasChildren = orgUnits.some(u => u.parentId === id);
    if (hasChildren) {
      return { success: false, error: 'Cannot delete unit with subordinate child units. Delete or reassign children first.' };
    }

    setOrgUnits(prev => prev.filter(u => u.id !== id));
    addAuditLog('Delete Org Unit', unit.nameEn, 'Removed unit from hierarchy');
    return { success: true };
  };

  const loadMaharashtraTemplateUnits = () => {
    setOrgUnits(MOCK_ORG_UNITS);
    addAuditLog('Load Template', 'Organisation Hierarchy', 'Re-applied standard Maharashtra Municipal Organogram template');
  };

  // Routing Rules
  const addRoutingRule = (rule: Omit<RoutingRule, 'id'>): { success: boolean; error?: string } => {
    if (rule.isOverride) {
      const conflict = routingRules.find(r => 
        r.isOverride && 
        r.categoryId === rule.categoryId && 
        r.wardNumbers?.some(w => rule.wardNumbers?.includes(w))
      );
      if (conflict) {
        return { success: false, error: 'Conflict: An area override rule for this category and ward already exists.' };
      }
    }
    const id = `route_${Date.now()}`;
    const newRule = { ...rule, id };
    setRoutingRules(prev => [...prev, newRule]);
    addAuditLog('Add Routing Rule', rule.categoryNameEn, `Mapped to unit ${rule.unitNameEn}`);
    return { success: true };
  };

  const deleteRoutingRule = (id: string) => {
    const found = routingRules.find(r => r.id === id);
    setRoutingRules(prev => prev.filter(r => r.id !== id));
    if (found) {
      addAuditLog('Delete Routing Rule', found.categoryNameEn, `Removed rule for ${found.unitNameEn}`);
    }
  };

  const testRoute = (categoryId: string, wardNumber: number, lat?: number, lng?: number) => {
    const cat = categories.find(c => c.id === categoryId) || categories[0];
    const override = routingRules.find(r => r.isOverride && r.categoryId === categoryId && r.wardNumbers?.includes(wardNumber));
    const defaultRule = routingRules.find(r => !r.isOverride && r.categoryId === categoryId);
    const targetUnitId = override?.unitId || defaultRule?.unitId || cat?.departmentId || 'dept_roads';
    
    const unit = orgUnits.find(u => u.id === targetUnitId || u.nameEn === cat?.department);
    let isVacant = false;
    let isSupervisorToCheck = false;
    let officerName = 'Unassigned';
    let officerRoleTitle = 'Field Officer';

    if (!unit || !unit.activeOfficerId) {
      isVacant = true;
      isSupervisorToCheck = true;
      officerName = 'Supervisor To check (Vacant department)';
      officerRoleTitle = 'DMC Triage Queue';
    } else {
      const activeOfficer = users.find(u => u.id === unit.activeOfficerId);
      if (activeOfficer?.isOnLeave) {
        const backupOfficer = users.find(u => u.id === unit.backupOfficerId);
        officerName = backupOfficer ? `${backupOfficer.name} (Backup)` : `${activeOfficer.name} (On Leave)`;
        officerRoleTitle = backupOfficer?.roleTitle || activeOfficer.roleTitle || 'Field Officer';
      } else if (activeOfficer) {
        officerName = activeOfficer.name;
        officerRoleTitle = activeOfficer.roleTitle || 'Field Officer';
      }
    }

    const responseHours = cat.priority === 'urgent' ? systemRules.responseClockUrgentHours : systemRules.responseClockNormalHours;
    const fixDays = cat.resolutionDays || 7;

    return {
      unit,
      officerName,
      officerRoleTitle,
      responseHours,
      fixDays,
      isVacant,
      isSupervisorToCheck,
    };
  };

  // Admin User operations
  const adminInviteUser = (name: string, emailOrMobile: string, unitId: string, roleTitle: string, role: 'supervisor' | 'helpdesk'): string => {
    const code = `SMKMC-${role.toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
    const unit = orgUnits.find(u => u.id === unitId);
    const newUser: UserProfile = {
      id: `usr_${Date.now()}`,
      name,
      email: emailOrMobile.includes('@') ? emailOrMobile : undefined,
      mobile: emailOrMobile.includes('@') ? '9822000000' : emailOrMobile,
      role,
      roleTitle,
      departmentId: unitId,
      department: unit?.nameEn,
      supervisorUnit: role === 'supervisor' ? unit?.nameEn : undefined,
    };
    setUsers(prev => [...prev, newUser]);
    addAuditLog('Invite User', name, `Issued invite code ${code} for role ${role}`);
    return code;
  };

  const regenerateUserInvite = (userId: string): string => {
    const user = users.find(u => u.id === userId);
    const code = `SMKMC-REGEN-${Math.floor(100 + Math.random() * 900)}`;
    addAuditLog('Regenerate User Invite', user?.name || userId, `Generated new code: ${code}`);
    return code;
  };

  const resetUserPassword = (userId: string) => {
    const user = users.find(u => u.id === userId);
    addAuditLog('Password Reset', user?.name || userId, 'Admin reset user password to Demo@123');
  };

  const toggleUserDisabled = (userId: string): { success: boolean; error?: string } => {
    const user = users.find(u => u.id === userId);
    if (!user) return { success: false, error: 'User not found' };

    if (user.role === 'supervisor') {
      const ownsUnits = orgUnits.some(u => u.supervisorId === userId);
      if (ownsUnits) {
        return { success: false, error: 'Cannot disable a supervisor who still owns active municipal units. Reassign unit supervisor first.' };
      }
    }

    setUsers(prev => prev.map(u => {
      if (u.id === userId) {
        const next = !u.isOnLeave;
        addAuditLog('User Status Toggle', u.name, `Changed user status for ${u.role}`);
        return { ...u, isOnLeave: next };
      }
      return u;
    }));
    return { success: true };
  };

  // System Rules
  const updateSystemRules = (updates: Partial<SystemRules>) => {
    const oldThreshold = systemRules.aiThreshold;
    setSystemRules(prev => ({ ...prev, ...updates }));
    if (updates.aiThreshold !== undefined && updates.aiThreshold !== oldThreshold) {
      addAuditLog('AI Threshold Update', 'System Rules', `Threshold changed from ${oldThreshold}% to ${updates.aiThreshold}%`);
    } else {
      addAuditLog('System Rules Update', 'System Rules', 'Updated operational policies');
    }
  };

  const resetSystemRulesToTemplate = () => {
    setSystemRules(INITIAL_SYSTEM_RULES);
    addAuditLog('Reset Rules', 'System Rules', 'Reset all system rules to Maharashtra ULB standard template');
  };

  // Helpdesk
  const logHelpdeskRedirect = (categoryName: string, agency: string, phone: string, callerMobile?: string, notes?: string) => {
    const newEntry: HelpdeskRedirectLog = {
      id: `redir_${Date.now()}`,
      timestamp: simulatedNow.toISOString(),
      operatorName: currentUser.name,
      callerMobile,
      categoryName,
      redirectAgency: agency,
      redirectPhone: phone,
      notes,
    };
    setHelpdeskRedirectLogs(prev => [newEntry, ...prev]);
    addAuditLog('Helpdesk Redirect', categoryName, `Redirected citizen to ${agency} (${phone})`);
  };

  const helpdeskCreateComplaint = (input: { 
    channel: 'Phone' | 'Walk-in' | 'WhatsApp' | 'Aaple Sarkar'; 
    citizenMobile?: string; 
    citizenName?: string; 
    isAnonymous?: boolean; 
    description: string; 
    categoryId: string; 
    address: string; 
    wardNumber: number; 
    photoUrl?: string; 
    isDangerToLife?: boolean; 
  }): Complaint => {
    const token = `NN-2026-${Math.floor(100000 + Math.random() * 900000)}`;
    const routeResult = testRoute(input.categoryId, input.wardNumber);
    const cat = categories.find(c => c.id === input.categoryId) || categories[0];
    const isUrgent = input.isDangerToLife || cat.priority === 'urgent';
    const respHours = isUrgent ? 24 : 48;
    const respDeadline = new Date(simulatedNow.getTime() + respHours * 60 * 60 * 1000).toISOString();
    const fixDeadline = new Date(simulatedNow.getTime() + (cat.resolutionDays || 7) * 24 * 60 * 60 * 1000).toISOString();

    const newComp: Complaint = {
      id: token,
      trackingNumber: token,
      categoryId: cat.id,
      categoryNameMr: cat.nameMr,
      categoryNameEn: cat.nameEn,
      department: routeResult.unit?.nameEn || cat.department,
      departmentId: routeResult.unit?.id || cat.departmentId,
      departmentMr: routeResult.unit?.nameMr || cat.departmentMr,
      status: routeResult.isSupervisorToCheck ? 'TO_CHECK' : 'ASSIGNED',
      priority: isUrgent ? 'urgent' : 'medium',
      description: input.description,
      photoUrls: input.photoUrl ? [input.photoUrl] : [],
      photoBadge: input.photoUrl ? 'VERIFIED' : 'UNVERIFIED',
      latitude: 16.8524,
      longitude: 74.5815,
      address: input.address,
      wardNumber: input.wardNumber,
      wardName: `Ward ${input.wardNumber}`,
      landmark: input.address,
      citizenName: input.isAnonymous ? 'Anonymous citizen' : (input.citizenName || 'Citizen'),
      citizenMobile: input.isAnonymous ? '' : (input.citizenMobile || ''),
      isAnonymous: input.isAnonymous,
      isDangerToLife: input.isDangerToLife,
      dangerVerified: false,
      routeChannel: input.channel as any,
      createdAt: simulatedNow.toISOString(),
      updatedAt: simulatedNow.toISOString(),
      responseDeadline: respDeadline,
      responseMet: false,
      resolutionDeadline: fixDeadline,
      escalationLevel: null,
      escalationReason: null,
      reopenCount: 0,
      reopenDeadline: new Date(simulatedNow.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      timeline: [
        {
          id: `t_${Date.now()}`,
          status: 'SUBMITTED',
          titleMr: `तक्रार नोंदणी (${input.channel})`,
          titleEn: `Registered via ${input.channel}`,
          timestamp: simulatedNow.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
          actorName: currentUser.name,
          actorRole: 'Helpdesk operator',
          comment: input.description,
        },
      ],
    };

    setComplaints(prev => [newComp, ...prev]);
    addAuditLog('Helpdesk Registration', token, `Registered via ${input.channel} for ${newComp.department}`);
    return newComp;
  };

  const helpdeskReopenComplaint = (id: string, reason: string): { success: boolean; error?: string } => {
    const c = complaints.find(item => item.id === id);
    if (!c) return { success: false, error: 'Complaint not found.' };

    if (c.status !== 'RESOLVED') {
      return { success: false, error: 'Only complaints in RESOLVED status can be reopened.' };
    }

    if (new Date(c.reopenDeadline) < simulatedNow) {
      return { success: false, error: 'Reopen window has expired (7 days past resolution).' };
    }

    if (c.reopenCount >= 2) {
      return { success: false, error: 'Maximum reopen attempts (2) already utilized. Escalated directly to supervisor.' };
    }

    const nextReopenCount = c.reopenCount + 1;
    setComplaints(prev => prev.map(item => {
      if (item.id !== id) return item;
      return {
        ...item,
        status: 'REOPENED',
        reopenCount: nextReopenCount,
        timeline: [
          {
            id: `reopen_${Date.now()}`,
            status: 'REOPENED',
            titleMr: `नागरिक विनंतीवरून मदत कक्षाने तक्रार पुन्हा उघडली (${nextReopenCount}/२)`,
            titleEn: `Reopened by Helpdesk on citizen request (${nextReopenCount}/2)`,
            timestamp: simulatedNow.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
            actorName: currentUser.name,
            actorRole: 'Helpdesk operator',
            comment: reason,
          },
          ...item.timeline,
        ],
      };
    }));

    addAuditLog('Helpdesk Reopen', c.trackingNumber, `Reopened complaint (${nextReopenCount}/2): ${reason}`);
    return { success: true };
  };

  const helpdeskAddNote = (id: string, note: string) => {
    setComplaints(prev => prev.map(item => {
      if (item.id !== id) return item;
      return {
        ...item,
        timeline: [
          {
            id: `note_${Date.now()}`,
            status: item.status,
            titleMr: 'मदत कक्ष अंतर्गत टिपण्णी',
            titleEn: 'Helpdesk Internal Note',
            timestamp: simulatedNow.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
            actorName: currentUser.name,
            actorRole: 'Helpdesk operator',
            comment: note,
          },
          ...item.timeline,
        ],
      };
    }));
    addAuditLog('Helpdesk Note', id, note);
  };

  // Platform Admin
  const createPlatformCorporation = (nameEn: string, nameMr: string, code: string): string => {
    const inviteCode = `ADMIN-${code}-2026`;
    const newCorp: PlatformCorporation = {
      id: `corp_${Date.now()}`,
      nameEn,
      nameMr,
      code,
      status: 'Draft',
      unitsCount: 4,
      officersCount: 8,
      complaintsThisMonth: 0,
      aiModelVersion: 'MobileNetV3 v1.2',
      adminInviteCode: inviteCode,
      createdAt: simulatedNow.toISOString(),
    };
    setPlatformCorporations(prev => [...prev, newCorp]);
    addAuditLog('Platform New Corporation', code, `Provisioned corporation ${nameEn} in Draft mode with admin invite ${inviteCode}`);
    return inviteCode;
  };

  const toggleCorporationStatus = (id: string, newStatus: 'Live' | 'Draft' | 'Suspended') => {
    setPlatformCorporations(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
    addAuditLog('Corporation Status Change', id, `Status updated to ${newStatus}`);
  };

  const regenerateCorporationInvite = (id: string): string => {
    const corp = platformCorporations.find(c => c.id === id);
    const newCode = `ADMIN-${corp?.code || 'CORP'}-${Math.floor(1000 + Math.random() * 9000)}`;
    setPlatformCorporations(prev => prev.map(c => c.id === id ? { ...c, adminInviteCode: newCode } : c));
    addAuditLog('Regenerate Admin Invite', corp?.code || id, `New invite generated: ${newCode}`);
    return newCode;
  };

  const setAIModelForCorporation = (modelId: string, corpCode: string) => {
    setAiModelRegistry(prev => prev.map(m => {
      if (m.id === modelId) {
        const nextUsed = Array.from(new Set([...m.usedByCorporations, corpCode]));
        return { ...m, usedByCorporations: nextUsed };
      }
      return m;
    }));
    addAuditLog('AI Model Assignment', corpCode, `Assigned model ${modelId} to corporation ${corpCode}`);
  };

  // Computed: Supervisor Overdue complaints (72h inactive after escalation)
  const supervisorOverdueComplaints = complaints.filter(c => {
    if (c.escalationLevel !== 'L1' || !c.escalatedAt) return false;
    if (c.supervisorInstruction || c.status === 'WORK_SCHEDULED' || c.status === 'RESOLVED' || c.status === 'CLOSED') return false;
    const escalatedTime = new Date(c.escalatedAt).getTime();
    const elapsedHours = (simulatedNow.getTime() - escalatedTime) / (1000 * 60 * 60);
    return elapsedHours >= 72;
  });

  const selectedComplaint = complaints.find(c => c.id === selectedComplaintId);
  const unreadNotifCount = notifications.filter(n => !n.isRead && (n.recipientRole === 'all' || n.recipientRole === currentUser.role)).length;

  return (
    <AppContext.Provider value={{
      language,
      setLanguage,
      currentScreen,
      navigateTo,
      currentUser,
      users,
      userRole: currentUser.role,
      switchUser,
      complaints,
      notifications,
      unreadNotifCount,
      selectedComplaintId,
      selectedComplaint,
      draftComplaint,
      updateDraft,
      resetDraft,
      selectComplaint,
      loginAsCitizen,
      loginWithEmail,
      syncBackendTickets,
      logout,
      markNotificationRead,
      markAllNotificationsRead,
      submitDraftComplaint,

      acceptComplaint,
      postUpdate,
      requestTargetDate,
      approveTargetDate,
      declineTargetDate,
      transferComplaint,
      approveTransfer,
      declineTransfer,
      linkDuplicates,
      resolveWithPhoto,
      requestRejection,
      approveRejection,
      declineRejection,
      reopenComplaint,
      escalateToSupervisorDirect,
      submitComplaintRating,
      supervisorInstruct,
      supervisorConfirmDepartment,
      flaggedPhotoDecision,
      verifyDangerFlag,

      officerJoinRequests,
      inviteOfficer,
      approveOfficerJoin,
      declineOfficerJoin,
      toggleOfficerLeave,

      // Corporation Admin: Categories & SLA
      categories,
      updateCategoryDeadline,
      toggleCategoryActive,
      addCategory,
      editCategory,

      // Corporation Admin: Organisation
      orgUnits,
      addOrgUnit,
      updateOrgUnit,
      deleteOrgUnit,
      loadMaharashtraTemplateUnits,

      // Corporation Admin: Routing
      routingRules,
      addRoutingRule,
      deleteRoutingRule,
      testRoute,

      // Corporation Admin: Users
      adminInviteUser,
      regenerateUserInvite,
      resetUserPassword,
      toggleUserDisabled,

      // Corporation Admin: Rules
      systemRules,
      updateSystemRules,
      resetSystemRulesToTemplate,

      // Audit Log
      auditLogs,
      addAuditLog,

      // Helpdesk Operations
      helpdeskRedirectLogs,
      logHelpdeskRedirect,
      helpdeskCreateComplaint,
      helpdeskReopenComplaint,
      helpdeskAddNote,

      // Platform Admin
      platformCorporations,
      createPlatformCorporation,
      toggleCorporationStatus,
      regenerateCorporationInvite,
      aiModelRegistry,
      setAIModelForCorporation,

      // Supervisor-overdue list helper
      supervisorOverdueComplaints,

      simulatedNow,
      advanceSimulatedTime,
      resetSimulatedTime,
      isDevPanelOpen,
      setIsDevPanelOpen,

      isMobileDeviceFrame,
      setIsMobileDeviceFrame,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
