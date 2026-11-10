import React, { useState } from 'react';
import { CheckCircle2, Database, FlaskConical, GitCompare, Layers, RefreshCw, ShieldCheck, Workflow } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { AiAdminApi, TrainingRunDetail } from '../../../services/aiAdminApi';
import {
  AdminAccessGuard, Badge, C, ConfirmDialog, CopyText, DeployBadge, Drawer, EmptyState, ErrorState, EvalBadge, HBars, KV,
  LoadingState, PageHeader, Pagination, ParamValue, Section, SelectBox, StatCard, TRAIN_OPTIONS, Timeline, TrainBadge,
  fmtDateTime, humanize, useApiData,
} from './aiUi';

const METRIC_TIPS: Record<string, string> = {
  accuracy: 'Share of evaluation samples whose top prediction equals the verified label.',
  precision: 'Of the samples predicted as a class, the share that truly belong to it (macro-averaged).',
  recall: 'Of the samples that belong to a class, the share the model found (macro-averaged).',
  macro_f1: 'Harmonic mean of precision and recall, averaged equally over classes.',
  inference_latency_ms: 'Average model inference time per sample on the evaluation hardware.',
};
const CONFIG_TIPS: Record<string, string> = {
  epochs: 'Number of full passes over the training set.',
  batch_size: 'Samples processed per optimisation step.',
  optimizer: 'Algorithm that updates the weights (e.g. AdamW).',
  learning_rate: 'Step size of each weight update.',
  loss_function: 'Objective minimised during training.',
  random_seed: 'Seed for reproducible shuffling and initialisation.',
};
const PAGE_SIZE = 25;

export const AIRetrainingHistoryScreen: React.FC = () => <AdminAccessGuard><Inner /></AdminAccessGuard>;

const Inner: React.FC = () => {
  const { currentUser } = useApp();
  const isPlatform = currentUser.role === 'platform';
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const runs = useApiData(() => AiAdminApi.trainingRuns({ training_status: status, page, page_size: PAGE_SIZE }), [status, page]);
  const samples = useApiData(() => (isPlatform ? AiAdminApi.trainingSamples() : Promise.resolve(null)), [isPlatform]);
  const datasets = useApiData(() => (isPlatform ? AiAdminApi.datasets() : Promise.resolve(null)), [isPlatform]);
  const [snapOpen, setSnapOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const snapshot = async () => {
    setBusy(true); setErr(null);
    try { await AiAdminApi.createDataset(notes || undefined); setSnapOpen(false); setNotes(''); datasets.reload(); runs.reload(); }
    catch (e: any) { setErr(e?.message || 'Snapshot failed'); } finally { setBusy(false); }
  };
  const p = runs.data?.pipeline;

  return (
    <div className="space-y-5">
      <PageHeader title="Retraining History"
        subtitle="Training jobs reported by the training pipeline, the curated dataset they were trained on, their evaluation, and promotion decisions."
        env={runs.data?.environment ?? null}
        actions={<button onClick={() => { runs.reload(); samples.reload(); datasets.reload(); }} className="px-3 py-1.5 bg-white border border-[#D6DFE8] rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-50"><RefreshCw className="w-3.5 h-3.5" />Refresh</button>} />

      {p && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Training runs reported" value={p.runs_reported} icon={Workflow} accent={C.royal} tip="Runs registered by a training pipeline through the API." />
          <StatCard label="Approved training samples" value={p.approved_training_samples} icon={ShieldCheck} accent={C.teal} tip="Reviewed examples validated by a second administrator (the curated dataset)." />
          <StatCard label="Awaiting 2nd approval" value={samples.data?.pending_validation ?? '—'} icon={CheckCircle2} accent={C.amber} tip="Reviewed predictions whose label still needs a second administrator." />
          <StatCard label="Dataset versions" value={p.dataset_versions} icon={Database} accent={C.navy} tip="Immutable snapshots of approved samples, identified by a SHA-256 fingerprint." />
        </div>
      )}

      {p?.message && (
        <div className="rounded-xl border border-[#BFD3F2] bg-[#F0F6FF] p-4 text-xs text-[#0B2545] flex gap-3">
          <FlaskConical className="w-5 h-5 text-[#1D4ED8] shrink-0" />
          <div>
            <b>Retraining is not operational in this deployment.</b> {p.message}
            <span className="block mt-1 text-[#566475]">What works today: predictions are logged, reviewers record corrections, a second administrator approves samples into the curated dataset, and dataset snapshots can be frozen for a future training pipeline. When a pipeline reports runs through the API, they appear here.</span>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-[#D6DFE8] shadow-xs">
        <div className="px-4 py-3 border-b border-[#D6DFE8] flex flex-wrap items-end justify-between gap-3">
          <h3 className="text-xs font-bold text-[#0B2545] uppercase tracking-wider">Training runs</h3>
          <div className="w-48"><SelectBox label="Training status" value={status} onChange={v => { setStatus(v); setPage(1); }} options={TRAIN_OPTIONS} /></div>
        </div>
        {runs.error ? <div className="p-4"><ErrorState error={runs.error} onRetry={runs.reload} /></div> :
          !runs.data ? <div className="p-4"><LoadingState rows={4} /></div> :
            runs.data.total === 0 ? (
              <div className="p-4"><EmptyState icon={Workflow} title={status ? 'No runs with this status' : 'No training runs recorded'}
                body={status ? 'Clear the status filter to see all runs.' : 'No model has been retrained. Complaint submissions and reviewer feedback never start training on their own.'} /></div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[1100px]">
                    <thead><tr className="border-b border-[#D6DFE8] bg-slate-50 text-[#566475] font-semibold">
                      <th className="px-3 py-2.5">Training run ID</th><th className="px-3 py-2.5">Model</th><th className="px-3 py-2.5">Previous version</th>
                      <th className="px-3 py-2.5">Candidate version</th><th className="px-3 py-2.5">Dataset version</th><th className="px-3 py-2.5">Samples</th>
                      <th className="px-3 py-2.5">Start</th><th className="px-3 py-2.5">Completion</th><th className="px-3 py-2.5">Training</th>
                      <th className="px-3 py-2.5">Evaluation</th><th className="px-3 py-2.5">Deployment</th>
                    </tr></thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {runs.data.items.map(r => (
                        <tr key={r.id} tabIndex={0} onClick={() => setSelected(r.id)} onKeyDown={e => { if (e.key === 'Enter') setSelected(r.id); }} className="hover:bg-[#F0F6FF] cursor-pointer">
                          <td className="px-3 py-2.5 font-mono text-[11px] text-[#1D4ED8]">{r.id}{r.environment !== 'production' && <div className="mt-0.5"><Badge tone="amber">{r.environment}</Badge></div>}</td>
                          <td className="px-3 py-2.5">{r.model_name || r.model_key}</td>
                          <td className="px-3 py-2.5 font-mono text-[11px]">{r.previous_model_version || '—'}</td>
                          <td className="px-3 py-2.5 font-mono text-[11px]">{r.candidate_model_version}</td>
                          <td className="px-3 py-2.5 font-mono text-[11px]">{r.dataset_version || '—'}</td>
                          <td className="px-3 py-2.5 font-mono">{r.training_samples ?? '—'}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-[#566475]">{fmtDateTime(r.started_at)}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-[#566475]">{fmtDateTime(r.completed_at)}</td>
                          <td className="px-3 py-2.5"><TrainBadge v={r.training_status} /></td>
                          <td className="px-3 py-2.5"><EvalBadge v={r.evaluation_status} /></td>
                          <td className="px-3 py-2.5"><DeployBadge v={r.deployment_status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={runs.data.page} pageSize={runs.data.page_size} total={runs.data.total} onPage={setPage} />
              </>
            )}
      </div>

      {isPlatform && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Section title="Curated training dataset" tip="Only examples reviewed by one administrator and approved by a different one are listed here.">
            {samples.error ? <ErrorState error={samples.error} onRetry={samples.reload} /> : !samples.data ? <LoadingState /> :
              samples.data.items.length === 0 ? (
                <EmptyState icon={ShieldCheck} title="No approved samples yet"
                  body="Review image predictions in AI Model History, then have a second platform administrator approve them for training." />
              ) : (
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-xs">
                    <thead><tr className="text-left text-[#566475] border-b border-[#D6DFE8]"><th className="py-1.5">Sample</th><th>Label</th><th>Source</th><th>Complaint</th><th>Approved</th></tr></thead>
                    <tbody>{samples.data.items.map(s => (
                      <tr key={s.id} className="border-b border-slate-100">
                        <td className="py-1.5 font-mono text-[11px]">{s.id.slice(0, 14)}…</td><td className="font-mono text-[11px]">{s.label}</td>
                        <td><Badge tone={s.label_source === 'REVIEWER_CORRECTION' ? 'violet' : 'green'}>{s.label_source === 'REVIEWER_CORRECTION' ? 'Corrected' : 'Confirmed'}</Badge></td>
                        <td className="font-mono text-[11px]">{s.complaint_id}</td><td className="text-[#566475]">{s.approved_by} · {fmtDateTime(s.approved_at)}</td>
                      </tr>))}</tbody>
                  </table>
                </div>
              )}
          </Section>
          <Section title="Dataset versions" tip="A snapshot freezes the approved samples with a SHA-256 fingerprint so a training run can state exactly what it was trained on. Creating one does not start training."
            right={<button onClick={() => { setErr(null); setSnapOpen(true); }} disabled={!samples.data?.items.length}
              className="px-2.5 py-1 rounded-lg bg-[#0B3D66] text-white text-[11px] font-bold disabled:opacity-40 flex items-center gap-1"><Layers className="w-3.5 h-3.5" />Create snapshot</button>}>
            {datasets.error ? <ErrorState error={datasets.error} onRetry={datasets.reload} /> : !datasets.data ? <LoadingState /> :
              datasets.data.items.length === 0 ? <EmptyState icon={Database} title="No dataset versions" body="Snapshot the curated dataset once it has approved samples." /> : (
                <ul className="space-y-2">
                  {datasets.data.items.map(d => (
                    <li key={d.id} className="rounded-lg border border-[#E2E8F0] p-3 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2"><b className="font-mono text-[#0B2545]">{d.version}</b><span className="text-[#566475]">{d.sample_count} samples · {fmtDateTime(d.created_at)}</span></div>
                      <div className="mt-1 text-[#566475]">Fingerprint <CopyText value={d.fingerprint} display={`${d.fingerprint.slice(0, 16)}…`} /> · by {d.created_by}</div>
                      <div className="mt-2"><HBars rows={Object.entries(d.class_distribution).map(([k, v]) => ({ label: k, value: v, color: C.teal, render: <span className="font-mono">{k}</span> }))} /></div>
                    </li>
                  ))}
                </ul>
              )}
          </Section>
        </div>
      )}

      <RunDrawer id={selected} onClose={() => setSelected(null)} onChanged={runs.reload} canDecide={isPlatform} />

      <ConfirmDialog open={snapOpen} title="Create dataset snapshot?"
        body={<>Freezes the {samples.data?.items.length ?? 0} currently approved sample(s) into a new immutable dataset version. This does <b>not</b> start training.</>}
        confirmLabel="Create snapshot" busy={busy} error={err} onConfirm={snapshot} onCancel={() => setSnapOpen(false)}>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Notes (optional)" className="w-full text-xs border border-[#D6DFE8] rounded-lg px-2.5 py-2" />
      </ConfirmDialog>
    </div>
  );
};

const RunDrawer: React.FC<{ id: string | null; onClose: () => void; onChanged: () => void; canDecide: boolean }> = ({ id, onClose, onChanged, canDecide }) => {
  const run = useApiData(() => (id ? AiAdminApi.trainingRun(id) : Promise.resolve(null)), [id]);
  return (
    <Drawer open={!!id} onClose={onClose} title={<span className="font-mono">{id}</span>}
      subtitle={run.data ? `${run.data.model_name || run.data.model_key} · candidate ${run.data.candidate_model_version}` : undefined}>
      {run.error ? <ErrorState error={run.error} onRetry={run.reload} /> : null}
      {!run.data && !run.error && <LoadingState rows={5} />}
      {run.data && <RunBody r={run.data} canDecide={canDecide} onChanged={() => { run.reload(); onChanged(); }} />}
    </Drawer>
  );
};

const MetricGrid: React.FC<{ m: Record<string, any> }> = ({ m }) => {
  const scalar = Object.entries(m).filter(([, v]) => typeof v === 'number');
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {scalar.map(([k, v]) => (
        <div key={k} className="rounded-lg border border-[#E2E8F0] p-2.5" title={METRIC_TIPS[k]}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#566475]">{humanize(k)}</div>
          <div className="text-base font-bold text-[#0B2545] font-mono">{v <= 1 && !k.includes('latency') ? `${(v * 100).toFixed(1)}%` : v}</div>
        </div>
      ))}
    </div>
  );
};

const RunBody: React.FC<{ r: TrainingRunDetail; canDecide: boolean; onChanged: () => void }> = ({ r, canDecide, onChanged }) => {
  const [confirm, setConfirm] = useState<null | 'approve' | 'reject'>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ev = r.evaluation || {};
  const cm = ev.confusion_matrix as { labels: string[]; matrix: number[][] } | undefined;
  const perClass = ev.per_class as Record<string, Record<string, number>> | undefined;
  const ready = r.training_status === 'COMPLETED' && r.evaluation_status === 'PASSED' && !!r.comparison && r.approval_status === 'PENDING' && !r.is_demo;

  const decide = async () => {
    setBusy(true); setErr(null);
    try { await AiAdminApi.decidePromotion(r.id, confirm!, notes || undefined); setConfirm(null); onChanged(); }
    catch (e: any) { setErr(e?.message || 'Failed'); } finally { setBusy(false); }
  };
  const failed = r.training_status === 'FAILED' || r.training_status === 'CANCELLED';

  return (
    <>
      {r.is_demo && <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-900">Demo run: reported with environment “demo”. It did not train a production model.</div>}
      <Section title="Lifecycle">
        <Timeline steps={[
          { label: 'Queued', detail: fmtDateTime(r.queued_at), state: 'done' },
          { label: 'Training started', detail: fmtDateTime(r.started_at), state: r.started_at ? 'done' : 'pending' },
          { label: failed ? `Training ${r.training_status.toLowerCase()}` : 'Training completed', detail: fmtDateTime(r.completed_at), state: failed ? 'failed' : r.training_status === 'COMPLETED' ? 'done' : r.training_status === 'RUNNING' ? 'current' : 'pending' },
          { label: `Evaluation: ${humanize(r.evaluation_status)}`, state: r.evaluation_status === 'PASSED' ? 'done' : r.evaluation_status === 'FAILED' ? 'failed' : r.evaluation_status === 'AWAITING_REVIEW' ? 'current' : 'pending' },
          { label: `Promotion: ${humanize(r.approval_status)}`, detail: r.promotion.approved_by ? `${r.promotion.approved_by} · ${fmtDateTime(r.promotion.approved_at)}` : undefined, state: r.approval_status === 'APPROVED' ? 'done' : r.approval_status === 'REJECTED' ? 'failed' : 'pending' },
          { label: `Deployment: ${humanize(r.deployment_status)}`, detail: r.deployment_status === 'ACTIVE' ? `Served by the backend since ${fmtDateTime(r.promotion.deployed_at)}` : 'Active only when the backend serves this version', state: r.deployment_status === 'ACTIVE' ? 'done' : r.deployment_status === 'ROLLED_BACK' ? 'failed' : r.deployment_status === 'STAGING' ? 'current' : 'pending' },
        ]} />
      </Section>

      <Section title="Dataset" tip="Exactly what the candidate was trained on.">
        <dl>
          <KV label="Dataset version" mono>{r.dataset.version}</KV>
          <KV label="Dataset fingerprint">{r.dataset.fingerprint ? <CopyText value={r.dataset.fingerprint} display={`${r.dataset.fingerprint.slice(0, 20)}…`} /> : '—'}</KV>
          <KV label="Train / validation / test">{r.dataset.split_sizes ? Object.entries(r.dataset.split_sizes).map(([k, v]) => `${k}: ${v}`).join(' · ') : '—'}</KV>
          <KV label="Reviewed & approved samples">{r.dataset.reviewed_samples ?? '—'}</KV>
        </dl>
        {r.dataset.class_distribution && <div className="mt-3"><HBars rows={Object.entries(r.dataset.class_distribution).map(([k, v]) => ({ label: k, value: v, color: C.teal, render: <span className="font-mono">{k}</span> }))} /></div>}
      </Section>

      <Section title="Training configuration">
        {r.training_config ? <dl>{Object.entries(r.training_config).map(([k, v]) => <KV key={k} label={humanize(k)} tip={CONFIG_TIPS[k]}><ParamValue value={v} /></KV>)}</dl>
          : <p className="text-xs text-[#566475]">The pipeline did not report a training configuration.</p>}
      </Section>

      <Section title="Evaluation" tip="Only metrics reported by the evaluation pipeline are shown.">
        {!r.evaluation ? <p className="text-xs text-[#566475]">No evaluation has been reported for this run.</p> : (
          <div className="space-y-4">
            <MetricGrid m={ev} />
            {perClass && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs"><thead><tr className="text-left text-[#566475] border-b border-[#D6DFE8]"><th className="py-1.5">Class</th>{Object.keys(Object.values(perClass)[0] || {}).map(k => <th key={k}>{humanize(k)}</th>)}</tr></thead>
                  <tbody>{Object.entries(perClass).map(([cls, vals]) => (
                    <tr key={cls} className="border-b border-slate-100"><td className="py-1.5 font-mono">{cls}</td>{Object.values(vals).map((v, i) => <td key={i} className="font-mono">{typeof v === 'number' && v <= 1 ? v.toFixed(3) : String(v)}</td>)}</tr>
                  ))}</tbody></table>
              </div>
            )}
            {cm && cm.labels && cm.matrix && (
              <div className="overflow-x-auto">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#566475] mb-1">Confusion matrix (rows: true, columns: predicted)</div>
                <table className="text-[10px] font-mono"><tbody>
                  <tr><td />{cm.labels.map(l => <td key={l} className="px-1 py-0.5 text-[#566475] [writing-mode:vertical-rl] rotate-180">{l}</td>)}</tr>
                  {cm.matrix.map((row, i) => {
                    const max = Math.max(1, ...cm.matrix.flat());
                    return (<tr key={i}><td className="pr-2 text-[#566475] whitespace-nowrap">{cm.labels[i]}</td>
                      {row.map((v, j) => <td key={j} className="w-7 h-7 text-center" style={{ background: i === j ? `rgba(15,138,132,${0.15 + 0.85 * v / max})` : v ? `rgba(180,35,24,${0.1 + 0.6 * v / max})` : '#F8FAFC' }}>{v}</td>)}</tr>);
                  })}
                </tbody></table>
              </div>
            )}
          </div>
        )}
      </Section>

      <Section title="Model comparison" tip="Previous and candidate models evaluated on the same evaluation dataset.">
        {!r.comparison ? <p className="text-xs text-[#566475]">No comparison has been reported.</p> : (
          <div className="space-y-2">
            <p className="text-[11px] text-[#566475] flex items-center gap-1"><GitCompare className="w-3.5 h-3.5" />Evaluation dataset: <span className="font-mono">{r.comparison.evaluation_dataset}</span></p>
            {Object.keys(r.comparison.candidate).filter(k => typeof r.comparison!.candidate[k] === 'number').map(k => {
              const prev = Number(r.comparison!.previous[k]); const cand = Number(r.comparison!.candidate[k]);
              const pct = (v: number) => (v <= 1 ? `${(v * 100).toFixed(1)}%` : String(v));
              const top = Math.max(prev || 0, cand || 0, 1e-9);
              return (
                <div key={k} className="text-xs">
                  <div className="font-semibold text-[#566475] mb-1">{humanize(k)}</div>
                  {[['Previous', prev, '#94A3B8'], ['Candidate', cand, C.teal]].map(([lbl, v, col]) => (
                    <div key={lbl as string} className="grid grid-cols-[5rem_1fr_4rem] items-center gap-2">
                      <span className="text-[11px]">{lbl as string}</span>
                      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">{!Number.isNaN(v as number) && <div className="h-full rounded-full" style={{ width: `${((v as number) / top) * 100}%`, background: col as string }} />}</div>
                      <span className="font-mono text-[11px] text-right">{Number.isNaN(v as number) ? '—' : pct(v as number)}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="Promotion" tip="Training completion does not approve a model, and approval does not deploy it. A version becomes Active only when the backend is configured to serve it.">
        <dl>
          <KV label="Approval status"><Badge tone={r.approval_status === 'APPROVED' ? 'green' : r.approval_status === 'REJECTED' ? 'red' : 'slate'}>{humanize(r.approval_status)}</Badge></KV>
          <KV label="Approved by">{r.promotion.approved_by}</KV>
          <KV label="Decision time">{fmtDateTime(r.promotion.approved_at)}</KV>
          {r.promotion.approval_notes && <KV label="Notes">{r.promotion.approval_notes}</KV>}
          <KV label="Deployment"><DeployBadge v={r.deployment_status} />{r.promotion.deployed_at && <span className="ml-2 text-[#566475]">{fmtDateTime(r.promotion.deployed_at)}</span>}</KV>
          <KV label="Rollback information">{r.promotion.rollback_info ? <ParamValue value={r.promotion.rollback_info} /> : 'None'}</KV>
        </dl>
        {canDecide && r.approval_status === 'PENDING' && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button disabled={!ready} onClick={() => { setErr(null); setConfirm('approve'); }} className="px-3 py-1.5 rounded-lg bg-[#0F8A84] text-white text-xs font-bold disabled:opacity-40">Approve candidate</button>
            <button disabled={r.is_demo} onClick={() => { setErr(null); setConfirm('reject'); }} className="px-3 py-1.5 rounded-lg border border-red-200 text-[#B42318] text-xs font-bold disabled:opacity-40">Reject</button>
            {!ready && <span className="text-[11px] text-[#566475]">Approval requires a completed run, a PASSED evaluation and a comparison on the same evaluation set.</span>}
          </div>
        )}
      </Section>

      <ConfirmDialog open={confirm !== null} title={confirm === 'approve' ? 'Approve candidate for deployment?' : 'Reject this candidate?'}
        body={confirm === 'approve'
          ? <>Records your approval of <b className="font-mono">{r.candidate_model_version}</b>. Nothing is deployed: an operator must install the artifact and point the backend at it, after which the registry marks it Active.</>
          : <>The candidate <b className="font-mono">{r.candidate_model_version}</b> will be marked rejected.</>}
        confirmLabel={confirm === 'approve' ? 'Approve' : 'Reject'} tone={confirm === 'reject' ? 'danger' : 'primary'}
        busy={busy} error={err} onConfirm={decide} onCancel={() => setConfirm(null)}>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Decision notes" className="w-full text-xs border border-[#D6DFE8] rounded-lg px-2.5 py-2" />
      </ConfirmDialog>
    </>
  );
};
