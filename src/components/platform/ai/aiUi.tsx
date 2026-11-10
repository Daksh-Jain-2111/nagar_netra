import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Copy, Info, Loader2, LogIn, ShieldOff, X,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { ApiClient, ApiError } from '../../../services/api';
import type { EnvironmentInfo } from '../../../services/aiAdminApi';

/* Palette: matches the existing admin portal (navy #0B3D66, text #16212E, border #D6DFE8, panel #F4F7FA)
   plus royal blue + teal accents for this module. */
export const C = {
  navy: '#0B3D66',
  heading: '#0B2545',
  text: '#16212E',
  muted: '#566475',
  border: '#D6DFE8',
  panel: '#F4F7FA',
  royal: '#1D4ED8',
  teal: '#0F8A84',
  amber: '#A86A0C',
  red: '#B42318',
  green: '#1D7A45',
};

export const MODEL_LABEL: Record<string, string> = {
  image_issue_classifier: 'Image classifier',
  text_keyword_rules: 'Keyword rules',
  speech_recognition: 'Speech-to-text',
};
export const MODEL_COLOR: Record<string, string> = {
  image_issue_classifier: C.teal,
  text_keyword_rules: C.royal,
  speech_recognition: '#7C3AED',
};

/* ------------------------------------------------------------------ data hook */
export function useApiData<T>(loader: () => Promise<T>, deps: React.DependencyList) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const load = useCallback(() => {
    const id = ++seq.current;
    setLoading(true);
    setError(null);
    loader()
      .then(d => { if (id === seq.current) setData(d); })
      .catch(e => { if (id === seq.current) setError(e); })
      .finally(() => { if (id === seq.current) setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { load(); }, [load]);
  return { data, error, loading, reload: load, setData };
}

/* ------------------------------------------------------------------ formatting */
export const fmtDateTime = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
export const fmtPct = (v?: number | null, digits = 1) => (v === null || v === undefined ? '—' : `${(v * 100).toFixed(digits)}%`);
export const fmtBytes = (n?: number | null) => {
  if (n === null || n === undefined) return '—';
  if (n > 1e9) return `${(n / 1e9).toFixed(2)} GB`;
  if (n > 1e6) return `${(n / 1e6).toFixed(1)} MB`;
  if (n > 1e3) return `${(n / 1e3).toFixed(1)} KB`;
  return `${n} B`;
};
export const humanize = (s?: string | null) => (s ? s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase()) : '—');

/* ------------------------------------------------------------------ access */
export const AdminAccessGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, navigateTo } = useApp();
  if (currentUser.role === 'platform' || currentUser.role === 'admin') return <>{children}</>;
  return (
    <div className="bg-white rounded-2xl border border-[#D6DFE8] p-10 text-center max-w-xl mx-auto mt-10">
      <ShieldOff className="w-10 h-10 mx-auto text-[#B42318]" />
      <h2 className="mt-3 text-lg font-bold text-[#0B2545]">Administrator access required</h2>
      <p className="mt-1 text-sm text-[#566475]">
        AI & Model Management is available only to NagarNetra platform administrators.
      </p>
      <button onClick={() => navigateTo('M3_OFFICER_LOGIN')}
        className="mt-5 px-4 py-2 rounded-lg bg-[#0B3D66] text-white text-xs font-bold inline-flex items-center gap-2">
        <LogIn className="w-4 h-4" /> Sign in as administrator
      </button>
    </div>
  );
};

/* ------------------------------------------------------------------ states */
export const LoadingState: React.FC<{ label?: string; rows?: number }> = ({ label = 'Loading…', rows = 0 }) => (
  <div className="bg-white rounded-xl border border-[#D6DFE8] p-6" role="status" aria-live="polite">
    <div className="flex items-center gap-2 text-xs text-[#566475]"><Loader2 className="w-4 h-4 animate-spin text-[#1D4ED8]" />{label}</div>
    {rows > 0 && (
      <div className="mt-4 space-y-2">
        {Array.from({ length: rows }).map((_, i) => <div key={i} className="h-7 rounded bg-slate-100 animate-pulse" />)}
      </div>
    )}
  </div>
);

export const EmptyState: React.FC<{ icon?: React.ElementType; title: string; body?: React.ReactNode; action?: React.ReactNode }> =
  ({ icon: Icon = Info, title, body, action }) => (
    <div className="bg-white rounded-xl border border-dashed border-[#B9C7D6] p-8 text-center">
      <div className="w-11 h-11 rounded-full bg-[#EEF4FF] mx-auto flex items-center justify-center">
        <Icon className="w-5 h-5 text-[#1D4ED8]" />
      </div>
      <h3 className="mt-3 text-sm font-bold text-[#0B2545]">{title}</h3>
      {body && <div className="mt-1 text-xs text-[#566475] max-w-lg mx-auto leading-relaxed">{body}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );

export const ErrorState: React.FC<{ error: unknown; onRetry?: () => void }> = ({ error, onRetry }) => {
  const { navigateTo, currentUser } = useApp();
  const [reauth, setReauth] = useState<'idle' | 'busy' | 'failed'>('idle');
  const status = error instanceof ApiError ? error.status : undefined;
  const authProblem = status === 401 || status === 403;
  const message = authProblem
    ? status === 401
      ? 'There is no administrator session with the NagarNetra backend. Sign in again through Officer Login.'
      : `The backend session belongs to ${ApiClient.sessionRole ? `a "${ApiClient.sessionRole}" account` : 'another account'}, not a platform administrator. Sign in again as ${currentUser.name}.`
    : (error as any)?.message || 'The request failed.';
  return (
    <div className="bg-white rounded-xl border border-red-200 p-5 flex flex-col sm:flex-row sm:items-center gap-3" role="alert">
      <AlertTriangle className="w-5 h-5 text-[#B42318] shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-bold text-[#B42318]">{authProblem ? 'Access denied' : 'Could not load data'}</p>
        <p className="text-xs text-[#566475] mt-0.5">{message}{status && !authProblem ? ` (HTTP ${status})` : ''}</p>
      </div>
      {authProblem ? (
        <div className="flex gap-2 shrink-0">
          {currentUser.email && currentUser.role !== 'citizen' && (
            <button disabled={reauth === 'busy'}
              onClick={() => {
                setReauth('busy');
                ApiClient.staffLogin(currentUser.email!.trim().toLowerCase())
                  .then(() => { setReauth('idle'); onRetry?.(); })
                  .catch(() => setReauth('failed'));
              }}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-[#0B3D66] text-white disabled:opacity-60">
              {reauth === 'busy' ? 'Signing in…' : reauth === 'failed' ? 'Retry sign-in' : `Re-sign in as ${currentUser.email}`}
            </button>
          )}
          <button onClick={() => navigateTo('M3_OFFICER_LOGIN')} className="px-3 py-1.5 text-xs font-bold rounded-lg border border-[#D6DFE8] bg-white text-[#16212E]">Officer login</button>
        </div>
      ) : onRetry ? (
        <button onClick={onRetry} className="px-3 py-1.5 text-xs font-bold rounded-lg border border-[#D6DFE8] bg-white text-[#16212E] hover:bg-slate-50">Retry</button>
      ) : null}
    </div>
  );
};

/* ------------------------------------------------------------------ header + env */
export const EnvironmentBadge: React.FC<{ env?: EnvironmentInfo | null }> = ({ env }) => {
  if (!env) return null;
  const dev = env.mode !== 'production';
  return (
    <span title={dev ? 'Backend is running with DEV_MODE=true. Records here come from a development database.' : 'Production backend'}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
        dev ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dev ? 'bg-amber-500' : 'bg-emerald-500'}`} />
      {dev ? 'Development environment' : 'Production'}
    </span>
  );
};

export const PageHeader: React.FC<{ title: string; subtitle: string; env?: EnvironmentInfo | null; actions?: React.ReactNode }> =
  ({ title, subtitle, env, actions }) => (
    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 pb-3 border-b border-[#D6DFE8]">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#0F8A84]">AI & Model Management</div>
        <h2 className="text-xl font-bold text-[#0B2545] tracking-tight mt-0.5">{title}</h2>
        <p className="text-xs text-[#566475] mt-0.5 max-w-2xl">{subtitle}</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">{env !== undefined && <EnvironmentBadge env={env} />}{actions}</div>
    </div>
  );

/* ------------------------------------------------------------------ tooltip */
export const InfoTip: React.FC<{ text: string; className?: string }> = ({ text, className = '' }) => (
  <span className={`relative group inline-flex align-middle ${className}`}>
    <button type="button" aria-label={text} className="text-[#8A99AA] hover:text-[#1D4ED8] focus:text-[#1D4ED8] focus:outline-hidden">
      <Info className="w-3.5 h-3.5" />
    </button>
    <span role="tooltip"
      className="pointer-events-none absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 rounded-lg bg-[#0B2545] text-white text-[11px] font-normal normal-case tracking-normal leading-snug p-2.5 shadow-lg opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
      {text}
    </span>
  </span>
);

/* ------------------------------------------------------------------ cards */
export const StatCard: React.FC<{
  label: string; value: React.ReactNode; hint?: React.ReactNode; tip?: string; icon?: React.ElementType; accent?: string;
}> = ({ label, value, hint, tip, icon: Icon, accent = C.royal }) => (
  <div className="bg-white rounded-xl border border-[#D6DFE8] p-4 shadow-xs flex flex-col gap-2 min-w-0">
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] font-semibold text-[#566475] flex items-center gap-1">{label}{tip && <InfoTip text={tip} />}</span>
      {Icon && <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${accent}14`, color: accent }}><Icon className="w-4 h-4" /></span>}
    </div>
    <div className="text-xl font-bold text-[#0B2545] truncate">{value}</div>
    {hint && <div className="text-[11px] text-[#566475] leading-snug">{hint}</div>}
  </div>
);

export const Section: React.FC<{ title: string; tip?: string; right?: React.ReactNode; children: React.ReactNode; className?: string }> =
  ({ title, tip, right, children, className = '' }) => (
    <section className={`bg-white rounded-xl border border-[#D6DFE8] shadow-xs ${className}`}>
      <div className="px-4 py-3 border-b border-[#D6DFE8] flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold text-[#0B2545] uppercase tracking-wider flex items-center gap-1.5">{title}{tip && <InfoTip text={tip} />}</h3>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );

export const KV: React.FC<{ label: string; tip?: string; children: React.ReactNode; mono?: boolean }> = ({ label, tip, children, mono }) => (
  <div className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-3 py-1.5 border-b border-slate-100 last:border-0">
    <dt className="sm:w-44 shrink-0 text-[11px] font-semibold text-[#566475] flex items-center gap-1">{label}{tip && <InfoTip text={tip} />}</dt>
    <dd className={`text-xs text-[#16212E] min-w-0 break-words ${mono ? 'font-mono' : ''}`}>{children ?? '—'}</dd>
  </div>
);

export const CopyText: React.FC<{ value: string; display?: string }> = ({ value, display }) => {
  const [done, setDone] = useState(false);
  return (
    <span className="inline-flex items-center gap-1 font-mono">
      <span className="truncate" title={value}>{display ?? value}</span>
      <button type="button" aria-label="Copy"
        onClick={e => { e.stopPropagation(); navigator.clipboard?.writeText(value).then(() => { setDone(true); setTimeout(() => setDone(false), 1200); }).catch(() => {}); }}
        className="text-[#8A99AA] hover:text-[#1D4ED8]">
        {done ? <CheckCircle2 className="w-3.5 h-3.5 text-[#1D7A45]" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </span>
  );
};

/* ------------------------------------------------------------------ badges */
type Tone = 'blue' | 'teal' | 'green' | 'amber' | 'red' | 'slate' | 'violet' | 'navy';
const TONES: Record<Tone, string> = {
  blue: 'bg-blue-50 text-[#1D4ED8] border-blue-200',
  teal: 'bg-teal-50 text-[#0F766E] border-teal-200',
  green: 'bg-emerald-50 text-[#1D7A45] border-emerald-200',
  amber: 'bg-amber-50 text-amber-800 border-amber-200',
  red: 'bg-red-50 text-[#B42318] border-red-200',
  slate: 'bg-slate-50 text-[#566475] border-slate-200',
  violet: 'bg-violet-50 text-violet-700 border-violet-200',
  navy: 'bg-[#0B3D66] text-white border-[#0B3D66]',
};
export const Badge: React.FC<{ tone?: Tone; children: React.ReactNode; title?: string }> = ({ tone = 'slate', children, title }) => (
  <span title={title} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${TONES[tone]}`}>{children}</span>
);

const ROUTING: Record<string, [Tone, string, string]> = {
  AI_SUGGESTED: ['teal', 'AI suggested', 'The filed category followed this prediction.'],
  HUMAN_REVIEW_REQUIRED: ['amber', 'Human review required', 'The complaint was sent to TO_CHECK for a person to verify.'],
  MANUAL_SELECTION: ['blue', 'Manual selection', 'The citizen or operator chose the category instead of relying on this prediction.'],
  PREDICTION_FAILED: ['red', 'Prediction failed', 'The model was unavailable or failed; no prediction was produced.'],
};
const FEEDBACK: Record<string, [Tone, string]> = {
  NOT_REVIEWED: ['slate', 'Not reviewed'], ACCEPTED: ['green', 'Accepted'], CORRECTED: ['violet', 'Corrected'], DISPUTED: ['red', 'Disputed'],
};
const INPUT: Record<string, [Tone, string]> = {
  IMAGE: ['teal', 'Image'], TEXT: ['blue', 'Text'], VOICE: ['violet', 'Voice'], COMBINED: ['navy', 'Combined'],
};
const DEPLOY: Record<string, [Tone, string]> = {
  ACTIVE: ['green', 'Active'], NOT_DEPLOYED: ['slate', 'Not deployed'], SUPERSEDED: ['slate', 'Superseded'],
  ROLLED_BACK: ['amber', 'Rolled back'], STAGING: ['blue', 'Staging'],
};
const TRAIN: Record<string, [Tone, string]> = {
  QUEUED: ['slate', 'Queued'], RUNNING: ['blue', 'Running'], COMPLETED: ['green', 'Completed'], FAILED: ['red', 'Failed'], CANCELLED: ['slate', 'Cancelled'],
};
const EVAL: Record<string, [Tone, string]> = {
  NOT_EVALUATED: ['slate', 'Not evaluated'], AWAITING_REVIEW: ['amber', 'Awaiting review'], PASSED: ['green', 'Passed'], FAILED: ['red', 'Failed'],
};
const ELIG: Record<string, [Tone, string]> = {
  NOT_ELIGIBLE: ['slate', 'Not eligible'], NEEDS_REVIEW: ['amber', 'Needs review'], PENDING_VALIDATION: ['blue', 'Pending 2nd approval'],
  APPROVED: ['green', 'In curated dataset'], REJECTED: ['red', 'Rejected for training'],
};
export const RoutingBadge = ({ v }: { v: string }) => { const [t, l, d] = ROUTING[v] || ['slate', humanize(v), '']; return <Badge tone={t} title={d}>{l}</Badge>; };
export const FeedbackBadge = ({ v }: { v: string }) => { const [t, l] = FEEDBACK[v] || ['slate', humanize(v)]; return <Badge tone={t}>{l}</Badge>; };
export const InputBadge = ({ v }: { v: string }) => { const [t, l] = INPUT[v] || ['slate', humanize(v)]; return <Badge tone={t}>{l}</Badge>; };
export const DeployBadge = ({ v }: { v: string }) => { const [t, l] = DEPLOY[v] || ['slate', humanize(v)]; return <Badge tone={t}>{l}</Badge>; };
export const TrainBadge = ({ v }: { v: string }) => { const [t, l] = TRAIN[v] || ['slate', humanize(v)]; return <Badge tone={t}>{l}</Badge>; };
export const EvalBadge = ({ v }: { v: string }) => { const [t, l] = EVAL[v] || ['slate', humanize(v)]; return <Badge tone={t}>{l}</Badge>; };
export const EligibilityBadge = ({ v }: { v: string }) => { const [t, l] = ELIG[v] || ['slate', humanize(v)]; return <Badge tone={t}>{l}</Badge>; };
export const OriginBadge = ({ origin, demo }: { origin: string; demo?: boolean }) => {
  if (demo || origin === 'SEED_SAMPLE') return <Badge tone="amber" title="Written by the demo seed script; not produced by a model.">Demo seed</Badge>;
  if (origin === 'BACKFILL') return <Badge tone="slate" title="Reconstructed from complaint records created before prediction logging existed.">Backfilled</Badge>;
  return null;
};
export const ROUTING_OPTIONS = Object.entries(ROUTING).map(([k, v]) => ({ value: k, label: v[1] }));
export const FEEDBACK_OPTIONS = Object.entries(FEEDBACK).map(([k, v]) => ({ value: k, label: v[1] }));
export const INPUT_OPTIONS = Object.entries(INPUT).map(([k, v]) => ({ value: k, label: v[1] }));
export const TRAIN_OPTIONS = Object.entries(TRAIN).map(([k, v]) => ({ value: k, label: v[1] }));

export const ConfidenceBar: React.FC<{ value: number | null; color?: string }> = ({ value, color = C.royal }) => {
  if (value === null || value === undefined) return <span className="text-[#8A99AA]">—</span>;
  return (
    <div className="flex items-center gap-2 min-w-[96px]" title={`${(value * 100).toFixed(2)}% model probability (not accuracy)`}>
      <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.max(2, value * 100)}%`, background: color }} />
      </div>
      <span className="font-mono text-[11px] text-[#16212E] w-11 text-right">{(value * 100).toFixed(1)}%</span>
    </div>
  );
};

/* ------------------------------------------------------------------ pagination */
export const Pagination: React.FC<{ page: number; pageSize: number; total: number; onPage: (p: number) => void }> =
  ({ page, pageSize, total, onPage }) => {
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const to = Math.min(total, page * pageSize);
    return (
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-[#D6DFE8] text-xs text-[#566475]">
        <span>{from}–{to} of {total}</span>
        <div className="flex items-center gap-1">
          <button disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"
            className="p-1.5 rounded-lg border border-[#D6DFE8] bg-white disabled:opacity-40 hover:bg-slate-50"><ChevronLeft className="w-4 h-4" /></button>
          <span className="px-2 font-semibold text-[#16212E]">Page {page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page"
            className="p-1.5 rounded-lg border border-[#D6DFE8] bg-white disabled:opacity-40 hover:bg-slate-50"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>
    );
  };

/* ------------------------------------------------------------------ dialogs */
export const ConfirmDialog: React.FC<{
  open: boolean; title: string; body: React.ReactNode; confirmLabel: string; tone?: 'primary' | 'danger';
  busy?: boolean; error?: string | null; onConfirm: () => void; onCancel: () => void; children?: React.ReactNode;
}> = ({ open, title, body, confirmLabel, tone = 'primary', busy, error, onConfirm, onCancel, children }) => {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onCancel(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, busy, onCancel]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-[#0B2545]/40" role="dialog" aria-modal="true" aria-label={title}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-[#D6DFE8]">
        <div className="px-5 pt-5">
          <h3 className="text-sm font-bold text-[#0B2545]">{title}</h3>
          <div className="mt-2 text-xs text-[#566475] leading-relaxed">{body}</div>
          {children && <div className="mt-3">{children}</div>}
          {error && <p className="mt-3 text-xs text-[#B42318] bg-red-50 border border-red-200 rounded-lg p-2">{error}</p>}
        </div>
        <div className="px-5 py-4 mt-4 border-t border-[#D6DFE8] flex justify-end gap-2">
          <button onClick={onCancel} disabled={busy} className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-[#D6DFE8] bg-white hover:bg-slate-50">Cancel</button>
          <button onClick={onConfirm} disabled={busy}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg text-white inline-flex items-center gap-1.5 disabled:opacity-60 ${tone === 'danger' ? 'bg-[#B42318] hover:bg-[#912018]' : 'bg-[#0B3D66] hover:bg-[#093254]'}`}>
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export const Drawer: React.FC<{ open: boolean; title: React.ReactNode; subtitle?: React.ReactNode; onClose: () => void; children: React.ReactNode }> =
  ({ open, title, subtitle, onClose, children }) => {
    useEffect(() => {
      if (!open) return;
      const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
      window.addEventListener('keydown', h);
      return () => window.removeEventListener('keydown', h);
    }, [open, onClose]);
    if (!open) return null;
    return (
      <div className="fixed inset-0 z-[60] flex justify-end bg-[#0B2545]/30" onClick={onClose}>
        <aside role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}
          className="h-full w-full max-w-3xl bg-[#F4F7FA] shadow-2xl flex flex-col">
          <div className="px-5 py-4 bg-white border-b border-[#D6DFE8] flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-bold text-[#0B2545] truncate">{title}</div>
              {subtitle && <div className="text-[11px] text-[#566475] mt-0.5">{subtitle}</div>}
            </div>
            <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">{children}</div>
        </aside>
      </div>
    );
  };

/* ------------------------------------------------------------------ charts (dependency-free) */
export const StackedDailyBars: React.FC<{ data: ({ date: string } & Record<string, any>)[]; series: string[] }> = ({ data, series }) => {
  const totals = data.map(d => series.reduce((s, k) => s + (Number(d[k]) || 0), 0));
  const max = Math.max(1, ...totals);
  return (
    <div>
      <div className="flex items-end gap-[3px] h-36" role="img" aria-label="Predictions per day, last 30 days">
        {data.map((d, i) => (
          <div key={d.date} className="flex-1 h-full flex flex-col justify-end group relative">
            {series.map(k => {
              const v = Number(d[k]) || 0;
              return v ? <div key={k} style={{ height: `${(v / max) * 100}%`, background: MODEL_COLOR[k] || C.navy }} className="w-full first:rounded-t-sm" /> : null;
            })}
            {totals[i] === 0 && <div className="w-full h-[2px] bg-slate-100" />}
            <div className="pointer-events-none absolute bottom-full mb-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-[#0B2545] text-white text-[10px] px-2 py-1 opacity-0 group-hover:opacity-100 z-10">
              {new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}: {totals[i]}
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-[#8A99AA] mt-1.5">
        <span>{data[0] && new Date(data[0].date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
        <span>Today</span>
      </div>
      <Legend items={series.map(k => ({ label: MODEL_LABEL[k] || k, color: MODEL_COLOR[k] || C.navy }))} />
    </div>
  );
};

export const Legend: React.FC<{ items: { label: string; color: string }[] }> = ({ items }) => (
  <div className="flex flex-wrap gap-3 mt-2">
    {items.map(i => (
      <span key={i.label} className="inline-flex items-center gap-1.5 text-[11px] text-[#566475]">
        <span className="w-2.5 h-2.5 rounded-sm" style={{ background: i.color }} />{i.label}
      </span>
    ))}
  </div>
);

export const HBars: React.FC<{ rows: { label: string; value: number; color?: string; render?: React.ReactNode }[]; valueSuffix?: string; labelWidth?: string }> =
  ({ rows, valueSuffix = '', labelWidth = '9rem' }) => {
    const max = Math.max(1, ...rows.map(r => r.value));
    return (
      <div className="space-y-2">
        {rows.map(r => (
          <div key={r.label} className="grid items-center gap-2 text-xs" style={{ gridTemplateColumns: `minmax(0,${labelWidth}) 1fr auto` }}>
            <span className="truncate text-[#16212E]" title={r.label}>{r.render ?? r.label}</span>
            <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: r.color || C.royal }} />
            </div>
            <span className="font-mono text-[11px] text-[#16212E] w-12 text-right">{r.value}{valueSuffix}</span>
          </div>
        ))}
      </div>
    );
  };

export const Histogram: React.FC<{ bins: number[]; color: string; label: string }> = ({ bins, color, label }) => {
  const max = Math.max(1, ...bins);
  return (
    <div>
      <div className="text-[11px] font-semibold text-[#566475] mb-1.5">{label}</div>
      <div className="flex items-end gap-1 h-20" role="img" aria-label={`${label} confidence distribution`}>
        {bins.map((b, i) => (
          <div key={i} className="flex-1 flex flex-col justify-end h-full group relative">
            <div style={{ height: `${(b / max) * 100}%`, background: color, opacity: 0.35 + 0.65 * (i / 9) }} className="w-full rounded-t-sm min-h-[1px]" />
            <div className="pointer-events-none absolute bottom-full mb-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-[#0B2545] text-white text-[10px] px-2 py-1 opacity-0 group-hover:opacity-100 z-10">
              {i * 10}–{i * 10 + 10}%: {b}
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-[#8A99AA] mt-1"><span>0%</span><span>50%</span><span>100%</span></div>
    </div>
  );
};

/* ------------------------------------------------------------------ lifecycle timeline */
export const Timeline: React.FC<{ steps: { label: string; detail?: React.ReactNode; state: 'done' | 'current' | 'pending' | 'failed' }[]; horizontal?: boolean }> =
  ({ steps, horizontal }) => (
    <ol className={horizontal ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3' : 'space-y-0'}>
      {steps.map((s, i) => {
        const dot = s.state === 'done' ? 'bg-[#0F8A84] border-[#0F8A84]' : s.state === 'current' ? 'bg-white border-[#1D4ED8]'
          : s.state === 'failed' ? 'bg-[#B42318] border-[#B42318]' : 'bg-white border-[#C5D0DC]';
        return horizontal ? (
          <li key={i} className={`rounded-xl border p-3 ${s.state === 'pending' ? 'border-dashed border-[#C5D0DC] bg-white' : 'border-[#D6DFE8] bg-white'}`}>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full border-2 ${dot}`} />
              <span className="text-[10px] font-bold text-[#8A99AA]">STEP {i + 1}</span>
            </div>
            <div className={`mt-1.5 text-xs font-bold ${s.state === 'pending' ? 'text-[#8A99AA]' : 'text-[#0B2545]'}`}>{s.label}</div>
            {s.detail && <div className="text-[11px] text-[#566475] mt-0.5">{s.detail}</div>}
          </li>
        ) : (
          <li key={i} className="relative pl-6 pb-4 last:pb-0">
            {i < steps.length - 1 && <span className="absolute left-[5px] top-3 bottom-0 w-[2px] bg-[#E2E8F0]" />}
            <span className={`absolute left-0 top-1 w-3 h-3 rounded-full border-2 ${dot}`} />
            <div className={`text-xs font-bold ${s.state === 'pending' ? 'text-[#8A99AA]' : 'text-[#0B2545]'}`}>{s.label}</div>
            {s.detail && <div className="text-[11px] text-[#566475] mt-0.5">{s.detail}</div>}
          </li>
        );
      })}
    </ol>
  );

/* ------------------------------------------------------------------ generic param renderer */
export const ParamValue: React.FC<{ value: any }> = ({ value }) => {
  if (value === null || value === undefined || value === '') return <span className="text-[#8A99AA]">—</span>;
  if (Array.isArray(value)) {
    if (value.every(v => typeof v !== 'object')) return <span className="font-mono">[{value.map(v => (typeof v === 'number' ? Number(v.toFixed?.(6) ?? v) : v)).join(', ')}]</span>;
    return <pre className="text-[11px] bg-slate-50 rounded p-2 overflow-x-auto">{JSON.stringify(value, null, 2)}</pre>;
  }
  if (typeof value === 'object') {
    return (
      <dl className="space-y-0.5">
        {Object.entries(value).map(([k, v]) => (
          <div key={k} className="flex gap-2"><dt className="text-[#566475] shrink-0">{humanize(k)}:</dt><dd className="min-w-0 break-words"><ParamValue value={v} /></dd></div>
        ))}
      </dl>
    );
  }
  if (typeof value === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>;
  return <span className={typeof value === 'number' ? 'font-mono' : ''}>{String(value)}</span>;
};

export const SelectBox: React.FC<{ label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; all?: string }> =
  ({ label, value, onChange, options, all = 'All' }) => (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="text-[10px] font-bold uppercase tracking-wider text-[#566475]">{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="text-xs border border-[#D6DFE8] rounded-lg px-2.5 py-2 bg-white text-[#16212E] focus:outline-hidden focus:ring-2 focus:ring-[#1D4ED8]/40 min-w-0">
        <option value="">{all}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
