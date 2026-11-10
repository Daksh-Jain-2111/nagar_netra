import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Columns2, Database, HelpCircle, RefreshCw, XCircle } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { AiAdminApi, ModelVersion } from '../../../services/aiAdminApi';
import {
  AdminAccessGuard, Badge, C, ConfirmDialog, CopyText, DeployBadge, EmptyState, ErrorState, HBars, KV, LoadingState,
  MODEL_COLOR, MODEL_LABEL, PageHeader, ParamValue, Section, fmtBytes, fmtDateTime, humanize, useApiData,
} from './aiUi';
import { ModelIcon } from './PredictionDetailDrawer';

const TABS = [
  { key: 'image_issue_classifier', label: 'Image classification' },
  { key: 'text_keyword_rules', label: 'Text classification' },
  { key: 'speech_recognition', label: 'Speech recognition' },
];

const TIPS: Record<string, string> = {
  architecture: 'Network / method, read from the model manifest or runtime metadata.',
  format: 'Serialized format of the artifact loaded by the backend.',
  input: 'What the model consumes and the tensor it is fed.',
  preprocessing: 'Transformations applied before inference (resize, crop, normalisation…).',
  thresholds: 'Confidence cut-offs used by the pipeline. These are model probabilities, not accuracy.',
  checksum: 'SHA-256 of the primary artifact. Files marked verified matched the checksum declared in the manifest.',
  status: 'ACTIVE only when the running backend is configured to serve this exact version. Other versions found on disk are NOT DEPLOYED.',
};

export const AIModelParametersScreen: React.FC = () => <AdminAccessGuard><Inner /></AdminAccessGuard>;

const Inner: React.FC = () => {
  const { currentUser } = useApp();
  const list = useApiData(() => AiAdminApi.models(), []);
  const [tab, setTab] = useState(TABS[0].key);
  const [syncOpen, setSyncOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [compare, setCompare] = useState<[string, string]>(['', '']);

  const versions = useMemo(() => (list.data?.items || []).filter(m => m.model_key === tab), [list.data, tab]);
  useEffect(() => {
    setCompare([versions[0]?.id || '', versions[1]?.id || '']);
  }, [tab, versions.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const sync = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await AiAdminApi.syncModels();
      setNotice(`Registry synced: ${r.versions_seen} version(s) read from runtime metadata${r.status_changes.length ? `, ${r.status_changes.length} status change(s)` : ', no status changes'}.`);
      setSyncOpen(false);
      list.reload();
    } catch (e: any) { setErr(e?.message || 'Sync failed'); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Model Parameters"
        subtitle="Versioned registry of the AI models NagarNetra runs, read from artifact manifests and the backend configuration."
        env={list.data?.environment ?? null}
        actions={currentUser.role === 'platform' && (
          <button onClick={() => { setErr(null); setSyncOpen(true); }} className="px-3 py-1.5 bg-[#0B3D66] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-[#093254]">
            <RefreshCw className="w-3.5 h-3.5" />Sync from runtime
          </button>
        )} />

      {notice && <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{notice}</div>}

      <div role="tablist" className="flex gap-1 bg-white border border-[#D6DFE8] rounded-xl p-1 overflow-x-auto">
        {TABS.map(t => {
          const n = (list.data?.items || []).filter(m => m.model_key === t.key).length;
          return (
            <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
              className={`flex-1 min-w-[160px] px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 ${tab === t.key ? 'bg-[#0B3D66] text-white' : 'text-[#16212E] hover:bg-[#F4F7FA]'}`}>
              <ModelIcon k={t.key} className="w-3.5 h-3.5" />{t.label}<span className={`px-1.5 rounded-full text-[10px] ${tab === t.key ? 'bg-white/20' : 'bg-slate-100'}`}>{n}</span>
            </button>
          );
        })}
      </div>

      {list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : !list.data ? <LoadingState label="Reading model registry…" rows={5} /> :
        versions.length === 0 ? (
          <EmptyState icon={Database} title={`No ${TABS.find(t => t.key === tab)?.label.toLowerCase()} model registered`}
            body="The registry lists only models whose metadata the backend can read on disk. If the model files were just installed, run “Sync from runtime”." />
        ) : (
          <>
            {versions.map(m => <ModelCard key={m.id} id={m.id} summary={m} runtime={list.data!.runtime[m.model_key]} />)}
            <CompareSection versions={versions} compare={compare} setCompare={setCompare} />
          </>
        )}

      <ConfirmDialog open={syncOpen} title="Sync model registry from runtime?"
        body="Re-reads model manifests and files on the server (including SHA-256 checksums) and recomputes which version is active. No model is loaded, changed or deployed."
        confirmLabel="Sync now" busy={busy} error={err} onConfirm={sync} onCancel={() => setSyncOpen(false)} />
    </div>
  );
};

const ModelCard: React.FC<{ id: string; summary: ModelVersion; runtime?: { loaded: boolean; last_error?: string | null } }> = ({ id, summary, runtime }) => {
  const [open, setOpen] = useState(summary.deployment_status === 'ACTIVE');
  const [showClasses, setShowClasses] = useState(false);
  const detail = useApiData(() => (open ? AiAdminApi.modelParameters(id) : Promise.resolve(null)), [id, open]);
  const m = detail.data || summary;
  const color = MODEL_COLOR[m.model_key] || C.navy;
  return (
    <section className="bg-white rounded-xl border border-[#D6DFE8] shadow-xs overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-[#F8FAFC]" aria-expanded={open}>
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}18`, color }}><ModelIcon k={m.model_key} /></span>
          <div className="min-w-0">
            <div className="text-sm font-bold text-[#0B2545] truncate">{m.name}</div>
            <div className="text-[11px] text-[#566475] font-mono truncate">{m.version}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span title={TIPS.status}><DeployBadge v={m.deployment_status} /></span>
          {m.deployment_status === 'ACTIVE' && runtime && (runtime.last_error ? <Badge tone="red">Load error</Badge> : runtime.loaded ? <Badge tone="teal">Loaded</Badge> : <Badge tone="slate">Not loaded yet</Badge>)}
          {open ? <ChevronUp className="w-4 h-4 text-[#566475]" /> : <ChevronDown className="w-4 h-4 text-[#566475]" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-[#D6DFE8] p-4 space-y-4">
          {detail.loading && !detail.data && <LoadingState />}
          {detail.error ? <ErrorState error={detail.error} onRetry={detail.reload} /> : null}
          {m.notes?.length > 0 && (
            <ul className="space-y-1">
              {m.notes.map(n => <li key={n} className="text-[11px] text-amber-900 bg-amber-50 border border-amber-100 rounded-md px-2.5 py-1.5 flex gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />{n}</li>)}
            </ul>
          )}
          <div className="grid lg:grid-cols-2 gap-4">
            <dl>
              <KV label="Model name">{m.name}</KV>
              <KV label="Model version"><span className="font-mono">{m.version}</span></KV>
              <KV label="Version source">{m.version_source}</KV>
              <KV label="Architecture" tip={TIPS.architecture}>{m.architecture}</KV>
              <KV label="Model format" tip={TIPS.format}>{m.model_format}</KV>
              <KV label="Provider" mono>{m.provider}</KV>
              <KV label="Deployment status" tip={TIPS.status}><DeployBadge v={m.deployment_status} /></KV>
              <KV label="Supported languages">{m.supported_languages?.length ? m.supported_languages.map(l => l.toUpperCase()).join(', ') : 'Not applicable'}</KV>
              <KV label="Last updated">{fmtDateTime(m.last_updated_at)}{m.activated_at && <span className="text-[#566475]"> · active since {fmtDateTime(m.activated_at)}</span>}</KV>
              <KV label="Logged predictions">{(m.prediction_count ?? 0).toLocaleString('en-IN')}</KV>
              <KV label="Trainable">{m.trainable ? 'Yes (supervised retraining possible)' : 'No'}</KV>
            </dl>
            <dl>
              <KV label="Input specification" tip={TIPS.input}><ParamValue value={m.input_spec} /></KV>
              <KV label="Preprocessing" tip={TIPS.preprocessing}><ParamValue value={m.preprocessing} /></KV>
              <KV label="Confidence threshold" tip={TIPS.thresholds}><ParamValue value={m.confidence_thresholds} /></KV>
              <KV label="Runtime / framework"><ParamValue value={m.framework} /></KV>
            </dl>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#566475]">Output classes ({m.output_classes?.length ?? m.output_class_count ?? 0})</div>
              {(m.output_classes?.length || 0) > 0 && <button onClick={() => setShowClasses(s => !s)} className="text-[11px] font-bold text-[#1D4ED8]">{showClasses ? 'Hide' : 'Show all'}</button>}
            </div>
            {!m.output_classes?.length ? <p className="text-xs text-[#566475] mt-1">{m.task === 'speech_recognition' ? 'Produces transcripts, not classes.' : '—'}</p> : (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(showClasses ? m.output_classes : m.output_classes.slice(0, 8)).map(c => (
                  <span key={c.code} className="px-2 py-1 rounded-md bg-[#F4F7FA] border border-[#E2E8F0] text-[11px]" title={c.name || undefined}>
                    <span className="font-mono">{c.code}</span>{c.name && <span className="text-[#566475]"> · {c.name}</span>}{c.keywords !== undefined && <span className="text-[#8A99AA]"> · {c.keywords} kw</span>}
                  </span>
                ))}
                {!showClasses && m.output_classes.length > 8 && <span className="text-[11px] text-[#566475] self-center">+{m.output_classes.length - 8} more</span>}
              </div>
            )}
          </div>

          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#566475] mb-1.5">Artifact</div>
            <dl>
              <KV label="Location / identifier" mono>{m.artifact_uri}</KV>
              <KV label="Artifact checksum" tip={TIPS.checksum}>{m.artifact_checksum ? <CopyText value={m.artifact_checksum} display={`sha256:${m.artifact_checksum.slice(0, 20)}…`} /> : 'Not available'}</KV>
              <KV label="Metadata source" mono>{m.metadata_source}</KV>
            </dl>
            {(m.artifact_files?.length || 0) > 0 && (
              <div className="overflow-x-auto mt-2">
                <table className="w-full text-xs min-w-[520px]">
                  <thead><tr className="text-left text-[#566475] border-b border-[#D6DFE8]"><th className="py-1.5">File</th><th>Role</th><th>Size</th><th>SHA-256</th><th>Integrity</th></tr></thead>
                  <tbody>
                    {m.artifact_files!.map(f => (
                      <tr key={f.name} className="border-b border-slate-100">
                        <td className="py-1.5 font-mono">{f.name}</td><td>{f.role}</td><td>{fmtBytes(f.size_bytes)}</td>
                        <td className="font-mono">{f.sha256 ? <CopyText value={f.sha256} display={`${f.sha256.slice(0, 12)}…`} /> : '—'}</td>
                        <td>{f.verified === true ? <span className="inline-flex items-center gap-1 text-[#1D7A45]"><CheckCircle2 className="w-3.5 h-3.5" />Matches manifest</span>
                          : f.verified === false ? <span className="inline-flex items-center gap-1 text-[#B42318]"><XCircle className="w-3.5 h-3.5" />Mismatch</span>
                            : <span className="inline-flex items-center gap-1 text-[#566475]" title="No checksum declared in a manifest for this file"><HelpCircle className="w-3.5 h-3.5" />No declared checksum</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

const FIELDS: { key: keyof ModelVersion; label: string }[] = [
  { key: 'version', label: 'Version' }, { key: 'deployment_status', label: 'Deployment status' },
  { key: 'architecture', label: 'Architecture' }, { key: 'model_format', label: 'Model format' },
  { key: 'provider', label: 'Provider' }, { key: 'input_spec', label: 'Input specification' },
  { key: 'preprocessing', label: 'Preprocessing' }, { key: 'confidence_thresholds', label: 'Confidence threshold' },
  { key: 'output_classes', label: 'Output classes' }, { key: 'supported_languages', label: 'Supported languages' },
  { key: 'artifact_checksum', label: 'Artifact checksum' }, { key: 'framework', label: 'Runtime / framework' },
  { key: 'prediction_count', label: 'Logged predictions' }, { key: 'last_updated_at', label: 'Last updated' },
];

const CompareSection: React.FC<{ versions: ModelVersion[]; compare: [string, string]; setCompare: (c: [string, string]) => void }> = ({ versions, compare, setCompare }) => {
  const a = useApiData(() => (compare[0] ? AiAdminApi.modelParameters(compare[0]) : Promise.resolve(null)), [compare[0]]);
  const b = useApiData(() => (compare[1] ? AiAdminApi.modelParameters(compare[1]) : Promise.resolve(null)), [compare[1]]);
  const show = (v: any) => (v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));
  return (
    <Section title="Compare model versions" tip="Field-by-field comparison of two registered versions of the same model. Differences are highlighted.">
      {versions.length < 2 ? (
        <EmptyState icon={Columns2} title="Only one version registered"
          body={<>Comparison needs at least two versions of {MODEL_LABEL[versions[0]?.model_key] || 'this model'}. New versions appear here when their artifacts are installed on the server and the registry is synced.</>} />
      ) : (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-2">
            {[0, 1].map(i => (
              <select key={i} value={compare[i]} aria-label={`Version ${i + 1}`}
                onChange={e => setCompare(i === 0 ? [e.target.value, compare[1]] : [compare[0], e.target.value])}
                className="text-xs border border-[#D6DFE8] rounded-lg px-2.5 py-2 bg-white">
                {versions.map(v => <option key={v.id} value={v.id}>{v.version} ({humanize(v.deployment_status)})</option>)}
              </select>
            ))}
          </div>
          <HBars rows={[a.data, b.data].filter(Boolean).map(v => ({ label: v!.version, value: v!.prediction_count || 0, color: MODEL_COLOR[v!.model_key], render: <span className="font-mono">{v!.version}</span> }))} />
          {a.data && b.data && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[640px]">
                <thead><tr className="text-left text-[#566475] border-b border-[#D6DFE8]"><th className="py-2 w-44">Field</th><th className="font-mono">{a.data.version}</th><th className="font-mono">{b.data.version}</th></tr></thead>
                <tbody>
                  {FIELDS.map(f => {
                    const va = show(a.data![f.key]); const vb = show(b.data![f.key]);
                    const diff = va !== vb;
                    return (
                      <tr key={f.key} className={`border-b border-slate-100 align-top ${diff ? 'bg-[#FFFBEB]' : ''}`}>
                        <td className="py-1.5 font-semibold text-[#566475]">{f.label}{diff && <span className="ml-1.5"><Badge tone="amber">differs</Badge></span>}</td>
                        <td className="py-1.5 pr-3 break-all"><ParamValue value={a.data![f.key]} /></td>
                        <td className="py-1.5 break-all"><ParamValue value={b.data![f.key]} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Section>
  );
};
