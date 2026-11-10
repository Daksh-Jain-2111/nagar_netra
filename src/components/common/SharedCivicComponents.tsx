import React from 'react';
import { ComplaintStatus, EscalationLevel, EscalationReason, PhotoVerificationStatus } from '../../types';
import { CheckCircle2, Clock, AlertTriangle, AlertCircle, Calendar, ShieldCheck, Check } from 'lucide-react';

interface StatusChipProps {
  status: ComplaintStatus;
  scheduledDate?: string;
  className?: string;
}

export const StatusChip: React.FC<StatusChipProps> = ({ status, scheduledDate, className = '' }) => {
  switch (status) {
    case 'WORK_SCHEDULED':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-900 border border-purple-200 ${className}`}>
          <Calendar className="w-3.5 h-3.5 text-purple-700" />
          <span>Work scheduled{scheduledDate ? ` – new date ${new Date(scheduledDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}</span>
        </span>
      );
    case 'IN_PROGRESS':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-300 ${className}`}>
          <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
          <span>In progress · काम सुरू</span>
        </span>
      );
    case 'ASSIGNED':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-900 border border-blue-200 ${className}`}>
          <Clock className="w-3.5 h-3.5 text-blue-700" />
          <span>Assigned · नियुक्त</span>
        </span>
      );
    case 'TO_CHECK':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-950 border border-amber-300 ${className}`}>
          <AlertCircle className="w-3.5 h-3.5 text-amber-800" />
          <span>To check · तपासणी रांग</span>
        </span>
      );
    case 'SUBMITTED':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-300 ${className}`}>
          <Clock className="w-3.5 h-3.5 text-slate-600" />
          <span>Submitted · दाखल</span>
        </span>
      );
    case 'RESOLVED':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-900 border border-emerald-300 ${className}`}>
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
          <span>Resolved · निवारण</span>
        </span>
      );
    case 'REOPENED':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-900 border border-rose-300 ${className}`}>
          <AlertTriangle className="w-3.5 h-3.5 text-rose-700" />
          <span>Reopened · पुन्हा उघडली</span>
        </span>
      );
    case 'CLOSED':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 ${className}`}>
          <Check className="w-3.5 h-3.5 text-slate-500" />
          <span>Closed · बंद</span>
        </span>
      );
    case 'REJECTION_REQUESTED':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-950 border border-orange-300 ${className}`}>
          <AlertCircle className="w-3.5 h-3.5 text-orange-800" />
          <span>Rejection requested</span>
        </span>
      );
    case 'REJECTED':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-900 border border-red-300 ${className}`}>
          <AlertTriangle className="w-3.5 h-3.5 text-red-700" />
          <span>Rejected · नाकारली</span>
        </span>
      );
    default:
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200 ${className}`}>
          <span>{status}</span>
        </span>
      );
  }
};

interface EscalationBadgeProps {
  level: EscalationLevel;
  reason: EscalationReason;
  className?: string;
}

export const EscalationBadge: React.FC<EscalationBadgeProps> = ({ level, reason, className = '' }) => {
  if (!level) return null;

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-red-600 text-white shadow-xs ${className}`}>
      <AlertTriangle className="w-3.5 h-3.5 text-white" />
      <span>Escalated {level}{reason ? ` – ${reason}` : ''}</span>
    </span>
  );
};

interface CountdownPillProps {
  deadline: string; // ISO string
  label?: string;
  isMet?: boolean;
  isCompleted?: boolean;
  className?: string;
  currentSimulatedNow?: Date;
}

export const CountdownPill: React.FC<CountdownPillProps> = ({ 
  deadline, 
  label = 'Deadline', 
  isMet = false, 
  isCompleted = false,
  className = '',
  currentSimulatedNow = new Date() 
}) => {
  if (isMet || isCompleted) {
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-900 border border-emerald-300 ${className}`}>
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
        <span>{label} ✓ Done</span>
      </span>
    );
  }

  const deadlineDate = new Date(deadline);
  const diffMs = deadlineDate.getTime() - currentSimulatedNow.getTime();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffMs <= 0) {
    const overdueHours = Math.abs(diffHours);
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-600 text-white shadow-xs ${className}`}>
        <AlertTriangle className="w-3.5 h-3.5" />
        <span>Overdue: -{overdueHours}h</span>
      </span>
    );
  }

  // Color mapping: green >24 h, amber 8–24 h, red <8 h
  if (diffHours < 8) {
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-900 border border-red-400 ${className}`}>
        <Clock className="w-3.5 h-3.5 text-red-700 animate-pulse" />
        <span>{label}: {diffHours} h left</span>
      </span>
    );
  }

  if (diffHours <= 24) {
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-950 border border-amber-300 ${className}`}>
        <Clock className="w-3.5 h-3.5 text-amber-800" />
        <span>{label}: {diffHours} h left</span>
      </span>
    );
  }

  // > 24 hours
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-900 border border-emerald-300 ${className}`}>
      <Clock className="w-3.5 h-3.5 text-emerald-700" />
      <span>{label}: {diffDays} days left</span>
    </span>
  );
};

interface PhotoBadgeProps {
  status?: PhotoVerificationStatus;
  distanceMeters?: number;
  className?: string;
}

export const PhotoBadge: React.FC<PhotoBadgeProps> = ({ 
  status = 'VERIFIED', 
  distanceMeters, 
  className = '' 
}) => {
  switch (status) {
    case 'VERIFIED':
      return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-700 text-white text-[11px] font-bold shadow-xs ${className}`}>
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-200" />
          <span>✓ VERIFIED{distanceMeters !== undefined ? ` · ${distanceMeters}m` : ''}</span>
        </span>
      );
    case 'FLAGGED':
      return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-600 text-white text-[11px] font-bold shadow-xs ${className}`}>
          <AlertTriangle className="w-3.5 h-3.5 text-amber-100" />
          <span>FLAGGED{distanceMeters !== undefined ? ` · ${distanceMeters}m (>200m)` : ''}</span>
        </span>
      );
    case 'UNVERIFIED':
    default:
      return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-600 text-white text-[11px] font-semibold ${className}`}>
          <Clock className="w-3.5 h-3.5 text-slate-300" />
          <span>UNVERIFIED</span>
        </span>
      );
  }
};
