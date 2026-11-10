import React, { useState } from 'react';
import { BadgeCheck, Cpu, FileSearch, GitBranch, ImageIcon, MessageSquareWarning, Mic, Scale, ShieldCheck } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { AiAdminApi, FeedbackStatus, PredictionDetail } from '../../../services/aiAdminApi';
import { mediaUrl } from '../../../services/api';
import {
  Badge, C, ConfidenceBar, ConfirmDialog, CopyText, Drawer, EligibilityBadge, ErrorState, FeedbackBadge, InfoTip,
  InputBadge, KV, LoadingState, MODEL_COLOR, MODEL_LABEL, OriginBadge, ParamValue, RoutingBadge, Section, DeployBadge,
  fmtDateTime, humanize, useApiData,
} from './aiUi';

const PARAM_TIPS: Record<string, string> = {
  input_tensor_shape: 'Shape of the tensor fed to the ONNX model: batch, channels, height, width.',
  input_dtype: 'Element type the ONNX session expects (read from the loaded model).',
  input_dimensions: 'Height x width x channels of each photo after preprocessing.',
  preprocessing: 'Resize/crop and per-channel normalisation applied before inference (from the loaded model manifest).',
  data_type: 'Numeric type of the preprocessed pixel tensor.',
  quantization: 'Weight quantisation of the model artifact. int8 trades a little accuracy for ~4x smaller size and faster CPU inference.',
  confidence_thresholds: 'Probability bands used to decide whether a suggestion is strong, a suggestion, or too weak to show.',
  aggregation: 'How several photos of one complaint are combined: the mean of their per-photo probabilities.',
  logit_scale: 'CLIP temperature: cosine similarities are multiplied by this before softmax.',
  embedding_dim: 'Length of the image/text embedding vectors compared by CLIP.',
  runtime: 'Inference runtime and version that executed the model.',
  execution_providers: 'ONNX Runtime hardware backend used (CPU here).',
  end_to_end_ms: 'Time from start of the server-side classification to the mapped result, including preprocessing.',
  taxonomy_version: 'Version of the civic issue taxonomy that maps model labels to categories and departments.',
};

export const PredictionDetailDrawer: React.FC<{ id: string | null; onClose: () => void; onChanged: () => void }> = ({ id, onClose, onChanged }) => {
  const { data, error, loading, reload } = useApiData(() => (id ? AiAdminApi.prediction(id) : Promise.resolve(null)), [id]);
  return (
    <Drawer open={!!id} onClose={onClose}
      title={<span className="flex items-center gap-2"><FileSearch className="w-4 h-4 text-[#1D4ED8]" />Prediction <span className="font-mono">{id}</span></span>}
      subtitle={data?.complaint ? <>Complaint <span className="font-mono">{data.complaint.complaint_reference}</span> · {fmtDateTime(data.created_at)}</> : undefined}>
      {loading && !data && <LoadingState label="Loading prediction…" rows={6} />}
      {error ? <ErrorState error={error} onRetry={reload} /> : null}
      {data && <Body d={data} reload={() => { reload(); onChanged(); }} />}
    </Drawer>
  );
};

const Body: React.FC<{ d: PredictionDetail; reload: () => void }> = ({ d, reload }) => {
  const color = MODEL_COLOR[d.model_key] || C.royal;
  const params = d.inference.params || {};
  const c = d.complaint;
  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="navy">{MODEL_LABEL[d.model_key] || d.model_key}</Badge>
        <InputBadge v={d.input_type} />
        <RoutingBadge v={d.routing_decision} />
        <FeedbackBadge v={d.feedback_status} />
        <OriginBadge origin={d.origin} demo={d.is_demo} />
      </div>

      {d.is_demo && (
        <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-900">
          Demo seed record: these scores were written by the seed script and were not produced by any model. Excluded from statistics and training.
        </div>
      )}

      {/* COMPLAINT CONTEXT */}
      <Section title="Complaint context" tip="The complaint this prediction was made for. Citizen name and phone number are intentionally not shown.">
        {c ? (
          <dl>
            <KV label="Complaint reference"><CopyText value={c.complaint_reference} /></KV>
            <KV label="Submission time">{fmtDateTime(c.submitted_at)}</KV>
            <KV label="Input modality">
              <span className="inline-flex gap-1 flex-wrap">{c.input_modalities.length ? c.input_modalities.map(m => <Badge key={m} tone="slate">{m}</Badge>) : '—'}<span className="text-[#566475]">· channel: {c.channel}</span></span>
            </KV>
            <KV label="Filed category" tip="The category the complaint was actually filed under (may differ from the prediction).">{c.filed_category_name || c.filed_category_id}</KV>
            <KV label="Department">{c.department}</KV>
            <KV label="Ward">{c.ward}</KV>
            <KV label="Complaint status">{humanize(c.initial_status)} at submission → <b>{humanize(c.current_status)}</b> now</KV>
            {c.is_anonymous && <KV label="Citizen">Anonymous complaint</KV>}
            {c.description && <KV label="Description"><span className="italic text-[#16212E]">“{c.description}”</span></KV>}
            {c.voice && (
              <KV label="Voice note" tip="Transcript produced by the speech-to-text model and confirmed/edited by the citizen.">
                <span className="flex items-center gap-1.5"><Mic className="w-3.5 h-3.5 text-violet-600" />
                  {c.voice.language?.toUpperCase() || '—'} · {c.voice.duration_seconds?.toFixed(1)} s · {c.voice.transcription_model || 'no model'} ({c.voice.transcription_status})
                </span>
                {c.voice.transcript && <span className="block mt-1 italic">“{c.voice.transcript}”</span>}
              </KV>
            )}
            {c.photo_urls.length > 0 && (
              <KV label="Photos">
                <div className="flex gap-2 flex-wrap">
                  {c.photo_urls.map(u => (
                    <a key={u} href={mediaUrl(u)} target="_blank" rel="noreferrer" className="block w-20 h-20 rounded-lg overflow-hidden border border-[#D6DFE8] bg-slate-50">
                      <img src={mediaUrl(u)} alt="Complaint photo" className="w-full h-full object-cover" loading="lazy" />
                    </a>
                  ))}
                </div>
              </KV>
            )}
          </dl>
        ) : <p className="text-xs text-[#566475]">This prediction is not linked to a complaint.</p>}
      </Section>

      {/* MODEL INFORMATION */}
      <Section title="Model information" tip="Model that produced this prediction, read from the model registry (artifact manifest / runtime config).">
        <dl>
          <KV label="Model name">{d.model.name || d.model_name}</KV>
          <KV label="Model version"><span className="font-mono">{d.model.version || d.model_version}</span>{d.model.deployment_status && <span className="ml-2"><DeployBadge v={d.model.deployment_status} /></span>}</KV>
          {d.model.version_source && <KV label="Version source">{d.model.version_source}</KV>}
          <KV label="Artifact identifier">{d.model.artifact_uri ? <span className="font-mono">{d.model.artifact_uri}</span> : d.model.registered === false ? 'Not registered (version not recorded at prediction time)' : '—'}</KV>
          {d.model.artifact_checksum && <KV label="Artifact checksum" tip="SHA-256 of the primary model file."><CopyText value={d.model.artifact_checksum} display={`${d.model.artifact_checksum.slice(0, 16)}…`} /></KV>}
          {d.model.architecture && <KV label="Architecture">{d.model.architecture}</KV>}
          {d.model.framework && <KV label="Runtime / framework"><ParamValue value={d.model.framework} /></KV>}
        </dl>
      </Section>

      {/* INFERENCE PARAMETERS */}
      <Section title="Inference parameters" tip="Only parameters recorded by the running pipeline are shown. Backfilled records have none.">
        {Object.keys(params).length === 0 && d.inference.latency_ms == null ? (
          <p className="text-xs text-[#566475]">No inference parameters were recorded for this prediction{d.origin !== 'LIVE' ? ' (created before prediction logging existed)' : ''}.</p>
        ) : (
          <dl>
            {Object.entries(params).map(([k, v]) => <KV key={k} label={humanize(k)} tip={PARAM_TIPS[k]}><ParamValue value={v} /></KV>)}
            {d.inference.latency_ms != null && <KV label="Inference latency" tip="Model forward-pass time measured on the server.">{d.inference.latency_ms} ms</KV>}
            {d.inference.input_summary && <KV label="Input summary"><ParamValue value={d.inference.input_summary} /></KV>}
          </dl>
        )}
      </Section>

      {/* PREDICTION RESULTS */}
      <Section title="Prediction results" tip="Model output. Scores are model probabilities, not accuracy, and are not verified labels.">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[#566475]">Top predicted category:</span>
            <b className="text-[#0B2545]">{d.predicted_label_name || d.predicted_label || '—'}</b>
            {d.predicted_category_name && <span className="text-[#566475]">→ {d.predicted_category_name}{d.predicted_department_name ? ` · ${d.predicted_department_name}` : ''}</span>}
            <Badge tone="slate">{humanize(d.results.status)}</Badge>
          </div>
          {d.results.top_predictions.length > 0 ? (
            <table className="w-full text-xs">
              <thead><tr className="text-left text-[#566475] border-b border-[#D6DFE8]"><th className="py-1.5 w-8">#</th><th>Class</th><th className="w-40">Score</th></tr></thead>
              <tbody>
                {d.results.top_predictions.slice(0, 3).map(p => (
                  <tr key={p.rank} className="border-b border-slate-100">
                    <td className="py-1.5 font-mono">{p.rank}</td>
                    <td className="py-1.5"><span className="font-mono text-[11px]">{p.label}</span>{p.name && <span className="text-[#566475]"> · {p.name}</span>}</td>
                    <td className="py-1.5"><ConfidenceBar value={p.score} color={color} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-xs text-[#566475]">No class scores (prediction {d.results.status.toLowerCase()}).</p>}
          {d.results.error_message && <p className="text-xs text-[#B42318]">Error: {d.results.error_message}</p>}
          <dl>
            <KV label="Routing decision"><RoutingBadge v={d.routing_decision} /></KV>
            <KV label="Why">{d.results.routing_reason}</KV>
            <KV label="Timestamp">{fmtDateTime(d.results.timestamp)}</KV>
          </dl>
        </div>
      </Section>

      <FeedbackSection d={d} reload={reload} />

      {d.related_predictions.length > 0 && (
        <Section title="Other predictions for this complaint">
          <ul className="space-y-1.5 text-xs">
            {d.related_predictions.map(r => (
              <li key={r.id} className="flex flex-wrap items-center gap-2">
                <Badge tone="navy">{MODEL_LABEL[r.model_key] || r.model_key}</Badge>
                <span className="font-mono">{r.id}</span>
                <span>{r.predicted_label_name || r.predicted_label}</span>
                <span className="font-mono text-[#566475]">{r.confidence != null ? `${(r.confidence * 100).toFixed(1)}%` : ''}</span>
                <RoutingBadge v={r.routing_decision} />
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
};

const FeedbackSection: React.FC<{ d: PredictionDetail; reload: () => void }> = ({ d, reload }) => {
  const { currentUser } = useApp();
  const fb = d.feedback;
  const [status, setStatus] = useState<FeedbackStatus>('ACCEPTED');
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [confirm, setConfirm] = useState<null | 'feedback' | 'approve' | 'reject'>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [vNotes, setVNotes] = useState('');

  const run = async () => {
    setBusy(true); setErr(null);
    try {
      if (confirm === 'feedback') {
        await AiAdminApi.submitFeedback(d.id, { review_status: status, corrected_label: status === 'CORRECTED' ? label : null, notes });
        setNotes(''); setLabel('');
      } else if (confirm) {
        await AiAdminApi.decideTrainingEligibility(d.id, confirm, vNotes || undefined);
        setVNotes('');
      }
      setConfirm(null);
      reload();
    } catch (e: any) {
      setErr(e?.message || 'Request failed');
    } finally { setBusy(false); }
  };

  return (
    <Section title="Feedback & ground truth"
      tip="Model predictions and reviewer-verified labels are stored separately. A reviewed label enters the curated training dataset only after a second platform administrator approves it.">
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-lg border border-[#D6DFE8] p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#566475] flex items-center gap-1"><Cpu className="w-3.5 h-3.5" />Original AI prediction</div>
          <div className="mt-1 text-sm font-bold text-[#0B2545] font-mono break-all">{fb.original_prediction || '—'}</div>
          <div className="text-[11px] text-[#566475]">Model output · unverified</div>
        </div>
        <div className={`rounded-lg border p-3 ${fb.ground_truth_label ? 'border-emerald-200 bg-emerald-50/50' : 'border-dashed border-[#C5D0DC]'}`}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#566475] flex items-center gap-1"><BadgeCheck className="w-3.5 h-3.5" />Verified label (ground truth)</div>
          <div className="mt-1 text-sm font-bold text-[#0B2545] font-mono break-all">{fb.ground_truth_label || 'Not verified'}</div>
          <div className="text-[11px] text-[#566475]">{fb.ground_truth_label ? `Set by reviewer · ${humanize(fb.review_status)}` : 'No reviewer has confirmed a label'}</div>
        </div>
      </div>
      <dl className="mt-3">
        <KV label="Review status"><FeedbackBadge v={fb.review_status} /></KV>
        <KV label="Training eligibility" tip="Not eligible: rule-based model, failed prediction, demo data, or no photos. Needs review → Pending 2nd approval → In curated dataset.">
          <span className="inline-flex flex-wrap items-center gap-2"><EligibilityBadge v={fb.training_eligibility} />{fb.training_eligibility_reason && <span className="text-[#566475]">{fb.training_eligibility_reason}</span>}</span>
        </KV>
        {fb.training_sample_id && <KV label="Training sample"><span className="font-mono">{fb.training_sample_id}</span></KV>}
      </dl>

      {fb.history.length > 0 && (
        <div className="mt-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#566475] mb-1.5">Reviewer feedback</div>
          <ul className="space-y-2">
            {fb.history.map(h => (
              <li key={h.id} className="text-xs rounded-lg bg-[#F4F7FA] border border-[#E2E8F0] p-2.5">
                <div className="flex flex-wrap items-center gap-2"><FeedbackBadge v={h.review_status} /><b>{h.reviewer}</b><span className="text-[#566475]">({h.reviewer_role}) · {fmtDateTime(h.created_at)}</span></div>
                {h.corrected_label && <div className="mt-1">Corrected <span className="font-mono">{h.original_label}</span> → <span className="font-mono font-bold">{h.corrected_label}</span>{h.corrected_label_name && ` (${h.corrected_label_name})`}</div>}
                {h.notes && <div className="mt-1 text-[#566475] italic">“{h.notes}”</div>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {fb.can_review && (
        <div className="mt-4 rounded-lg border border-[#D6DFE8] p-3 space-y-2">
          <div className="text-[11px] font-bold text-[#0B2545] flex items-center gap-1.5"><MessageSquareWarning className="w-3.5 h-3.5 text-[#1D4ED8]" />Record a review</div>
          <div className="flex flex-wrap gap-2">
            {(['ACCEPTED', 'CORRECTED', 'DISPUTED'] as FeedbackStatus[]).map(s => (
              <button key={s} onClick={() => setStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${status === s ? 'bg-[#0B3D66] text-white border-[#0B3D66]' : 'bg-white border-[#D6DFE8] text-[#16212E] hover:bg-slate-50'}`}>
                {s === 'ACCEPTED' ? 'Prediction is correct' : s === 'CORRECTED' ? 'Correct the label' : 'Dispute / unclear'}
              </button>
            ))}
          </div>
          {status === 'CORRECTED' && (
            <select value={label} onChange={e => setLabel(e.target.value)} aria-label="Corrected label"
              className="w-full text-xs border border-[#D6DFE8] rounded-lg px-2.5 py-2 bg-white">
              <option value="">Select the correct class…</option>
              {fb.allowed_labels.filter(l => l.code !== fb.original_prediction).map(l => <option key={l.code} value={l.code}>{l.code}{l.name ? ` — ${l.name}` : ''}</option>)}
            </select>
          )}
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} maxLength={1000} placeholder="Reviewer notes (optional)"
            className="w-full text-xs border border-[#D6DFE8] rounded-lg px-2.5 py-2" />
          <button disabled={status === 'CORRECTED' && !label} onClick={() => { setErr(null); setConfirm('feedback'); }}
            className="px-3.5 py-2 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-bold disabled:opacity-50">Save review</button>
        </div>
      )}

      {fb.training_eligibility === 'PENDING_VALIDATION' && (
        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50/60 p-3 space-y-2">
          <div className="text-[11px] font-bold text-[#0B2545] flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-[#1D4ED8]" />Second-administrator validation</div>
          {fb.can_validate ? (
            <>
              <p className="text-[11px] text-[#566475]">Approving adds this example with label <b className="font-mono">{fb.ground_truth_label}</b> to the curated training dataset. It does not start training.</p>
              <textarea value={vNotes} onChange={e => setVNotes(e.target.value)} rows={2} placeholder="Validation notes (optional)" className="w-full text-xs border border-[#D6DFE8] rounded-lg px-2.5 py-2 bg-white" />
              <div className="flex gap-2">
                <button onClick={() => { setErr(null); setConfirm('approve'); }} className="px-3 py-1.5 rounded-lg bg-[#0F8A84] text-white text-xs font-bold">Approve for training</button>
                <button onClick={() => { setErr(null); setConfirm('reject'); }} className="px-3 py-1.5 rounded-lg border border-red-200 bg-white text-[#B42318] text-xs font-bold">Reject</button>
              </div>
            </>
          ) : (
            <p className="text-[11px] text-[#566475]">
              {currentUser.role !== 'platform' ? 'Only a platform administrator can validate training samples.'
                : 'Waiting for a different platform administrator: the reviewer who set the label cannot approve it.'}
            </p>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirm !== null}
        title={confirm === 'feedback' ? 'Save reviewer feedback?' : confirm === 'approve' ? 'Approve for curated training data?' : 'Reject this training example?'}
        body={confirm === 'feedback'
          ? <>This records <b>{status === 'CORRECTED' ? `corrected label ${label}` : humanize(status)}</b> against prediction {d.id}. It does not change the complaint, and the label will need a second administrator’s approval before it can be used for training.</>
          : confirm === 'approve'
            ? <>The example (complaint {d.complaint_id}) will be added to the curated dataset with label <b>{fb.ground_truth_label}</b>. Training is not started.</>
            : <>The example will be excluded from training data.</>}
        confirmLabel={confirm === 'reject' ? 'Reject' : 'Confirm'}
        tone={confirm === 'reject' ? 'danger' : 'primary'}
        busy={busy} error={err} onConfirm={run} onCancel={() => setConfirm(null)} />
    </Section>
  );
};

export const ModelIcon: React.FC<{ k: string; className?: string }> = ({ k, className = 'w-4 h-4' }) =>
  k === 'image_issue_classifier' ? <ImageIcon className={className} /> : k === 'speech_recognition' ? <Mic className={className} />
    : k === 'text_keyword_rules' ? <Scale className={className} /> : <GitBranch className={className} />;
