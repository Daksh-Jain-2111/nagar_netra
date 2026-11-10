import React, { useEffect, useMemo, useState } from 'react';
import { Activity, AlertCircle, Clock3, Cpu, FilterX, Gauge, History, RefreshCw, Search, Workflow } from 'lucide-react';
import { AiAdminApi, Overview } from '../../../services/aiAdminApi';
import {
  AdminAccessGuard, C, ConfidenceBar, EmptyState, ErrorState, FEEDBACK_OPTIONS, FeedbackBadge, INPUT_OPTIONS, InputBadge,
  LoadingState, MODEL_COLOR, MODEL_LABEL, OriginBadge, PageHeader, Pagination, ROUTING_OPTIONS, RoutingBadge, SelectBox,
  StatCard, fmtDateTime, fmtPct, useApiData,
} from './aiUi';
import { PredictionDetailDrawer } from './PredictionDetailDrawer';

const PAGE_SIZE = 25;
const EMPTY_FILTERS = {
  q: '', date_from: '', date_to: '', model_version: '', input_type: '', category: '',
  min_confidence: '', max_confidence: '', feedback_status: '', routing_decision: '', requires_review: false, include_demo: true,
};
type Filters = typeof EMPTY_FILTERS;

export const SummaryCards: React.FC<{ ov: Overview }> = ({ ov }) => {
  const s = ov.summary;
  const image = s.active_models.find(m => m.model_key === 'image_issue_classifier');
  const avgImg = s.average_confidence['image_issue_classifier'];
  const avgKw = s.average_confidence['text_keyword_rules'];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-3">
      <StatCard label="Total AI predictions" icon={Activity} accent={C.royal}
        value={s.total_predictions.toLocaleString('en-IN')}
        tip="Prediction events logged at complaint submission (one per model that ran). Demo seed records are excluded."
        hint={s.demo_predictions_excluded ? `${s.demo_predictions_excluded} demo record(s) excluded` : 'From stored prediction events'} />
      <StatCard label="Active model version" icon={Cpu} accent={C.teal}
        value={image ? <span className="font-mono text-base">{image.version}</span> : <span className="text-sm text-[#566475]">None active</span>}
        tip="Version the running backend is configured to serve (from the model manifest), not a documented or trained version."
        hint={image ? `Image classifier · +${s.active_models.length - 1} other active model(s)` : 'Run a registry sync on Model Parameters'} />
      <StatCard label="Predictions requiring review" icon={AlertCircle} accent={C.amber}
        value={s.predictions_requiring_review.toLocaleString('en-IN')}
        tip="Not yet reviewed AND either routed to human review (TO_CHECK) or an image prediction that was low-confidence / found no civic issue."
        hint="Unreviewed, flagged by routing or low image confidence" />
      <StatCard label="Average prediction confidence" icon={Gauge} accent={C.teal}
        value={avgImg ? fmtPct(avgImg.average) : '—'}
        tip="Mean model probability of the top prediction. This is confidence, not accuracy. Keyword-rule scores use a different scale and are shown separately."
        hint={avgImg ? `Image classifier, n=${avgImg.count}${avgKw ? ` · keyword rules ${fmtPct(avgKw.average)} (n=${avgKw.count})` : ''}`
          : avgKw ? `No image predictions · keyword rules ${fmtPct(avgKw.average)} (n=${avgKw.count})` : 'No predictions yet'} />
      <StatCard label="Total training runs" icon={Workflow} accent={C.royal}
        value={s.total_training_runs}
        tip="Training jobs reported by a training pipeline. Complaint submission never triggers training."
        hint={s.total_training_runs ? 'Reported by the training pipeline' : 'No training pipeline has reported a run'} />
      <StatCard label="Last successful retraining" icon={Clock3} accent={C.navy}
        value={s.last_successful_retraining ? <span className="text-sm">{fmtDateTime(s.last_successful_retraining.completed_at)}</span> : <span className="text-sm text-[#566475]">None recorded</span>}
        tip="Most recent training run that completed. Completion does not mean the model was approved or deployed."
        hint={s.last_successful_retraining ? <span className="font-mono">{s.last_successful_retraining.candidate_model_version}</span> : 'No completed training run'} />
    </div>
  );
};

export const AIModelHistoryScreen: React.FC = () => (
  <AdminAccessGuard><HistoryInner /></AdminAccessGuard>
);

const HistoryInner: React.FC = () => {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [qInput, setQInput] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('newest');
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setFilters(f => ({ ...f, q: qInput.trim() })); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [qInput]);

  const overview = useApiData(() => AiAdminApi.overview(), []);
  const list = useApiData(() => {
    const [mk, mv] = filters.model_version ? filters.model_version.split('|') : ['', ''];
    return AiAdminApi.predictions({
      ...filters, model_key: mk, model_version: mv, page, page_size: PAGE_SIZE, sort,
      min_confidence: filters.min_confidence ? Number(filters.min_confidence) / 100 : '',
      max_confidence: filters.max_confidence ? Number(filters.max_confidence) / 100 : '',
      include_demo: filters.include_demo ? 'true' : 'false',
    });
  }, [JSON.stringify(filters), page, sort]);

  const set = (k: keyof Filters, v: any) => { setFilters(f => ({ ...f, [k]: v })); setPage(1); };
  const facets = list.data?.facets;
  const versionOptions = useMemo(() => (facets?.model_versions || []).map(v => ({
    value: `${v.model_key}|${v.version}`, label: `${MODEL_LABEL[v.model_key] || v.model_key} · ${v.version} (${v.count})`,
  })), [facets]);
  const categoryOptions = useMemo(() => {
    const seen = new Map<string, string>();
    (facets?.labels || []).forEach(l => seen.set(l.id, `${l.name || l.id} (${l.count})`));
    (facets?.categories || []).forEach(c => { if (!seen.has(c.id)) seen.set(c.id, `${c.name || c.id} (${c.count})`); });
    return Array.from(seen.entries()).map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [facets]);
  const filtersActive = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);
  const refresh = () => { overview.reload(); list.reload(); };

  return (
    <div className="space-y-5">
      <PageHeader
        title="AI Model History"
        subtitle="Monitor AI predictions, inspect model configurations, and track the evolution of NagarNetra's intelligence."
        env={overview.data?.environment ?? list.data?.environment ?? null}
        actions={<button onClick={refresh} className="px-3 py-1.5 bg-white border border-[#D6DFE8] rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-50"><RefreshCw className="w-3.5 h-3.5" />Refresh</button>}
      />

      {overview.loading && !overview.data ? <LoadingState label="Loading summary…" /> :
        overview.error ? <ErrorState error={overview.error} onRetry={overview.reload} /> :
          overview.data && <SummaryCards ov={overview.data} />}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-[#D6DFE8] shadow-xs p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3 md:items-end">
          <label className="flex-1 flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#566475]">Search</span>
            <span className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={qInput} onChange={e => setQInput(e.target.value)} placeholder="Prediction ID, complaint reference (NN-2026-…), category…"
                className="w-full pl-9 pr-3 py-2 text-xs border border-[#D6DFE8] rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#1D4ED8]/40" />
            </span>
          </label>
          <div className="grid grid-cols-2 gap-2 md:w-72">
            <label className="flex flex-col gap-1"><span className="text-[10px] font-bold uppercase tracking-wider text-[#566475]">From</span>
              <input type="date" value={filters.date_from} onChange={e => set('date_from', e.target.value)} className="text-xs border border-[#D6DFE8] rounded-lg px-2 py-2" /></label>
            <label className="flex flex-col gap-1"><span className="text-[10px] font-bold uppercase tracking-wider text-[#566475]">To</span>
              <input type="date" value={filters.date_to} onChange={e => set('date_to', e.target.value)} className="text-xs border border-[#D6DFE8] rounded-lg px-2 py-2" /></label>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
          <SelectBox label="Model version" value={filters.model_version} onChange={v => set('model_version', v)} options={versionOptions} />
          <SelectBox label="Input type" value={filters.input_type} onChange={v => set('input_type', v)} options={INPUT_OPTIONS} />
          <SelectBox label="Issue category" value={filters.category} onChange={v => set('category', v)} options={categoryOptions} />
          <SelectBox label="Feedback status" value={filters.feedback_status} onChange={v => set('feedback_status', v)} options={FEEDBACK_OPTIONS} />
          <SelectBox label="Routing decision" value={filters.routing_decision} onChange={v => set('routing_decision', v)} options={ROUTING_OPTIONS} />
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#566475]">Confidence %</span>
            <span className="flex items-center gap-1">
              <input type="number" min={0} max={100} value={filters.min_confidence} onChange={e => set('min_confidence', e.target.value)} placeholder="min" aria-label="Minimum confidence %"
                className="w-full text-xs border border-[#D6DFE8] rounded-lg px-2 py-2" />
              <span className="text-[#8A99AA]">–</span>
              <input type="number" min={0} max={100} value={filters.max_confidence} onChange={e => set('max_confidence', e.target.value)} placeholder="max" aria-label="Maximum confidence %"
                className="w-full text-xs border border-[#D6DFE8] rounded-lg px-2 py-2" />
            </span>
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-4 text-xs text-[#16212E]">
            <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={filters.requires_review} onChange={e => set('requires_review', e.target.checked)} className="accent-[#1D4ED8]" />Requires review only</label>
            <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={filters.include_demo} onChange={e => set('include_demo', e.target.checked)} className="accent-[#1D4ED8]" />Show demo seed records</label>
          </div>
          <div className="flex items-center gap-2">
            <select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }} aria-label="Sort" className="text-xs border border-[#D6DFE8] rounded-lg px-2.5 py-1.5 bg-white">
              <option value="newest">Newest first</option><option value="oldest">Oldest first</option>
              <option value="confidence_desc">Highest confidence</option><option value="confidence_asc">Lowest confidence</option>
            </select>
            {filtersActive && (
              <button onClick={() => { setFilters(EMPTY_FILTERS); setQInput(''); setPage(1); }} className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-[#D6DFE8] flex items-center gap-1 hover:bg-slate-50">
                <FilterX className="w-3.5 h-3.5" />Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      {list.error ? <ErrorState error={list.error} onRetry={list.reload} /> :
        list.loading && !list.data ? <LoadingState label="Loading prediction history…" rows={8} /> :
          list.data && list.data.total === 0 ? (
            filtersActive
              ? <EmptyState icon={FilterX} title="No predictions match these filters" body="Try widening the date range or clearing filters." />
              : <EmptyState icon={History} title="No AI predictions recorded yet"
                  body="Prediction events are written automatically when a citizen submits a complaint through the app. Nothing has been logged in this environment yet." />
          ) : list.data && (
            <div className={`bg-white rounded-xl border border-[#D6DFE8] shadow-xs overflow-hidden transition-opacity ${list.loading ? 'opacity-60' : ''}`}>
              <div className="px-4 py-3 border-b border-[#D6DFE8] bg-[#F4F7FA] flex items-center justify-between">
                <h3 className="text-xs font-bold text-[#0B2545] uppercase tracking-wider">Prediction history ({list.data.total})</h3>
                <span className="text-[11px] text-[#566475] hidden sm:inline">Click a row to inspect · scores are model probabilities, not accuracy</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[980px] [&_th]:px-2.5 [&_td]:px-2.5">
                  <thead>
                    <tr className="border-b border-[#D6DFE8] bg-slate-50 text-[#566475] font-semibold">
                      <th className="px-3 py-2.5">Prediction ID</th><th className="px-3 py-2.5">Complaint ref.</th><th className="px-3 py-2.5">Input</th>
                      <th className="px-3 py-2.5">Predicted issue category<span className="block font-normal text-[10px]">Predicted department</span></th>
                      <th className="px-3 py-2.5">Model name<span className="block font-normal text-[10px]">Model version</span></th><th className="px-3 py-2.5">Confidence</th>
                      <th className="px-3 py-2.5">Routing decision</th><th className="px-3 py-2.5">Feedback</th><th className="px-3 py-2.5">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {list.data.items.map(r => (
                      <tr key={r.id} tabIndex={0} onClick={() => setSelected(r.id)} onKeyDown={e => { if (e.key === 'Enter') setSelected(r.id); }}
                        className="hover:bg-[#F0F6FF] cursor-pointer focus:outline-hidden focus:bg-[#F0F6FF]">
                        <td className="px-3 py-2.5 font-mono text-[11px] text-[#1D4ED8] whitespace-nowrap" title={r.id}>{r.id.slice(5, 15)}…<div className="mt-0.5"><OriginBadge origin={r.origin} demo={r.is_demo} /></div></td>
                        <td className="px-3 py-2.5 font-mono text-[11px] whitespace-nowrap">{r.complaint_id || '—'}</td>
                        <td className="px-3 py-2.5"><InputBadge v={r.input_type} /></td>
                        <td className="px-3 py-2.5 max-w-[230px]">
                          <div className="font-semibold text-[#16212E] truncate" title={r.predicted_label_name || r.predicted_category_name || undefined}>{r.predicted_label_name || r.predicted_category_name || r.predicted_label || (r.status === 'FAILED' ? <span className="text-[#B42318] font-normal">No prediction (model failed)</span> : '—')}</div>
                          <div className="text-[11px] text-[#566475] truncate" title={r.predicted_department_name || undefined}>{r.predicted_department_name || '—'}{r.predicted_label && <span className="font-mono text-[10px] text-[#8A99AA]"> · {r.predicted_label}</span>}</div>
                        </td>
                        <td className="px-3 py-2.5 max-w-[150px]">
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><span className="w-2 h-2 rounded-full" style={{ background: MODEL_COLOR[r.model_key] || C.navy }} />{MODEL_LABEL[r.model_key] || r.model_name}</span>
                          <div className="font-mono text-[10px] text-[#566475] truncate" title={r.model_version}>{r.model_version}</div>
                        </td>
                        <td className="px-3 py-2.5"><ConfidenceBar value={r.confidence} color={MODEL_COLOR[r.model_key]} /></td>
                        <td className="px-3 py-2.5"><RoutingBadge v={r.routing_decision} /></td>
                        <td className="px-3 py-2.5"><FeedbackBadge v={r.feedback_status} /></td>
                        <td className="px-3 py-2.5 text-[#566475] text-[11px] leading-tight min-w-[84px]">{fmtDateTime(r.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={list.data.page} pageSize={list.data.page_size} total={list.data.total} onPage={setPage} />
            </div>
          )}

      <PredictionDetailDrawer id={selected} onClose={() => setSelected(null)} onChanged={refresh} />
    </div>
  );
};
