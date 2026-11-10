import React from 'react';
import { AlertTriangle, ArrowRight, BrainCircuit, CheckCircle2, CircleSlash, RefreshCw } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { AiAdminApi } from '../../../services/aiAdminApi';
import {
  AdminAccessGuard, C, EmptyState, ErrorState, HBars, Histogram, LoadingState, MODEL_COLOR, MODEL_LABEL, PageHeader,
  RoutingBadge, Section, StackedDailyBars, Timeline, FeedbackBadge, InputBadge, humanize, useApiData,
} from './aiUi';
import { SummaryCards } from './AIModelHistoryScreen';
import { ModelIcon } from './PredictionDetailDrawer';

const ROUTING_COLORS: Record<string, string> = {
  AI_SUGGESTED: C.teal, HUMAN_REVIEW_REQUIRED: C.amber, MANUAL_SELECTION: C.royal, PREDICTION_FAILED: C.red,
};
const FEEDBACK_COLORS: Record<string, string> = { NOT_REVIEWED: '#94A3B8', ACCEPTED: C.green, CORRECTED: '#7C3AED', DISPUTED: C.red };

export const AIOverviewScreen: React.FC = () => <AdminAccessGuard><Inner /></AdminAccessGuard>;

const Inner: React.FC = () => {
  const { navigateTo } = useApp();
  const ov = useApiData(() => AiAdminApi.overview(), []);
  const models = useApiData(() => AiAdminApi.models(), []);
  const d = ov.data;

  return (
    <div className="space-y-5">
      <PageHeader title="AI Overview"
        subtitle="Live state of the AI models that classify citizen complaints, and how their predictions move through review, curation and retraining."
        env={d?.environment ?? null}
        actions={<button onClick={() => { ov.reload(); models.reload(); }} className="px-3 py-1.5 bg-white border border-[#D6DFE8] rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-50"><RefreshCw className="w-3.5 h-3.5" />Refresh</button>} />

      {ov.error ? <ErrorState error={ov.error} onRetry={ov.reload} /> : !d ? <LoadingState label="Loading AI overview…" rows={4} /> : (
        <>
          <SummaryCards ov={d} />

          {/* Runtime model status */}
          <Section title="Models in the running pipeline" tip="Read from the backend process: whether each model is configured and currently loaded in memory. 'Active' means the runtime config points at this version."
            right={<button onClick={() => navigateTo('P_AI_PARAMETERS')} className="text-[11px] font-bold text-[#1D4ED8] flex items-center gap-1">Model parameters <ArrowRight className="w-3.5 h-3.5" /></button>}>
            {models.error ? <ErrorState error={models.error} onRetry={models.reload} /> : !models.data ? <LoadingState /> :
              models.data.items.filter(m => m.deployment_status === 'ACTIVE').length === 0 ? (
                <EmptyState icon={CircleSlash} title="No active model registered" body="The registry is filled from model metadata when the backend starts. Use “Sync from runtime” on the Model Parameters page." />
              ) : (
                <div className="grid md:grid-cols-3 gap-3">
                  {models.data.items.filter(m => m.deployment_status === 'ACTIVE').map(m => {
                    const rt = models.data!.runtime[m.model_key];
                    return (
                      <div key={m.id} className="rounded-xl border border-[#D6DFE8] p-4" style={{ borderTop: `3px solid ${MODEL_COLOR[m.model_key] || C.navy}` }}>
                        <div className="flex items-center gap-2 text-[#0B2545]">
                          <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${MODEL_COLOR[m.model_key]}18`, color: MODEL_COLOR[m.model_key] }}><ModelIcon k={m.model_key} /></span>
                          <div className="min-w-0"><div className="text-xs font-bold truncate">{m.name}</div><div className="font-mono text-[11px] text-[#566475] truncate">{m.version}</div></div>
                        </div>
                        <div className="mt-3 flex items-center gap-1.5 text-[11px]">
                          {rt?.last_error ? <><AlertTriangle className="w-3.5 h-3.5 text-[#B42318] shrink-0" /><span className="text-[#B42318] line-clamp-2" title={rt.last_error}>Load error: {rt.last_error}</span></>
                            : rt?.loaded ? <><CheckCircle2 className="w-3.5 h-3.5 text-[#1D7A45]" /><span className="text-[#1D7A45] font-semibold">Loaded in memory</span></>
                              : <><span className="w-2 h-2 rounded-full bg-slate-300" /><span className="text-[#566475]">Configured · loads on first use</span></>}
                        </div>
                        <div className="mt-2 text-[11px] text-[#566475]">{(m.prediction_count ?? 0).toLocaleString('en-IN')} logged prediction(s){m.trainable ? ' · trainable' : ' · not trainable'}</div>
                        {m.notes[0] && <div className="mt-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-100 rounded-md p-2 leading-snug">{m.notes[0]}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
          </Section>

          {d.summary.total_predictions === 0 ? (
            <EmptyState icon={BrainCircuit} title="No prediction activity yet"
              body={<>Charts appear once citizens submit complaints. {d.summary.demo_predictions_excluded ? `${d.summary.demo_predictions_excluded} demo seed record(s) are excluded from statistics.` : ''}</>} />
          ) : (
            <div className="grid lg:grid-cols-3 gap-4">
              <Section title="Model performance · predictions per day" className="lg:col-span-2" tip="Prediction events per day over the last 30 days, by model. Activity volume, not accuracy.">
                <StackedDailyBars data={d.charts.predictions_per_day} series={['image_issue_classifier', 'text_keyword_rules']} />
              </Section>
              <Section title="Routing decisions" tip="How each prediction related to the category the complaint was filed under.">
                <HBars rows={Object.entries(d.charts.routing_decisions).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k, value: v, color: ROUTING_COLORS[k], render: <RoutingBadge v={k} /> }))} />
              </Section>
              <Section title="Confidence distribution" className="lg:col-span-2" tip="Histogram of top-prediction probabilities per model. Uncalibrated: a high score is not proof of correctness.">
                <div className="grid sm:grid-cols-2 gap-5">
                  {Object.entries(d.charts.confidence_histogram).map(([k, bins]) => (
                    <Histogram key={k} bins={bins} color={MODEL_COLOR[k] || C.navy} label={MODEL_LABEL[k] || k} />
                  ))}
                </div>
              </Section>
              <Section title="Review status" tip="Reviewer feedback recorded on predictions.">
                <HBars rows={Object.entries(d.charts.feedback_status).map(([k, v]) => ({ label: k, value: v, color: FEEDBACK_COLORS[k], render: <FeedbackBadge v={k} /> }))} />
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#566475] mb-2">Citizen input types</div>
                  <HBars rows={Object.entries(d.charts.input_types).map(([k, v]) => ({ label: k, value: v, color: C.navy, render: <InputBadge v={k} /> }))} />
                </div>
              </Section>
              <Section title="Version comparison · prediction volume" className="lg:col-span-3" tip="Logged predictions per model version. Volume only; accuracy comparisons need an evaluation run.">
                <HBars labelWidth="18rem" rows={Object.entries(d.charts.by_model_version).sort((a, b) => b[1] - a[1]).map(([k, v]) => {
                  const [key, ver] = k.split('|');
                  return { label: k, value: v, color: MODEL_COLOR[key] || C.navy, render: <span title={ver}><b>{MODEL_LABEL[key] || key}</b> <span className="font-mono text-[#566475]">{ver}</span></span> };
                })} />
              </Section>
            </div>
          )}

          {/* Lifecycle */}
          <Section title="Training lifecycle" tip="Each stage needs a separate, recorded action. Logging a prediction never triggers retraining, and a corrected label is not trusted until a second administrator approves it.">
            <Timeline horizontal steps={[
              { label: 'Predictions logged', detail: `${d.lifecycle.predictions_logged} event(s) at complaint submission`, state: d.lifecycle.predictions_logged ? 'done' : 'pending' },
              { label: 'Reviewed by admin', detail: `${d.lifecycle.reviewed} reviewed · ${d.lifecycle.corrected} corrected`, state: d.lifecycle.reviewed ? 'done' : 'pending' },
              { label: 'Second-admin validation', detail: `${d.lifecycle.pending_validation} pending · ${d.lifecycle.approved_training_samples} approved samples`, state: d.lifecycle.approved_training_samples ? 'done' : d.lifecycle.pending_validation ? 'current' : 'pending' },
              { label: 'Dataset snapshot', detail: `${d.lifecycle.dataset_versions} dataset version(s)`, state: d.lifecycle.dataset_versions ? 'done' : 'pending' },
              { label: 'Training run', detail: `${d.lifecycle.training_runs} reported`, state: d.lifecycle.training_runs ? 'done' : 'pending' },
              { label: 'Evaluation', detail: `${d.lifecycle.evaluations_passed} passed`, state: d.lifecycle.evaluations_passed ? 'done' : 'pending' },
              { label: 'Promotion approval', detail: `${d.lifecycle.promotions_approved} approved`, state: d.lifecycle.promotions_approved ? 'done' : 'pending' },
              { label: 'Deployed (runtime)', detail: `${d.lifecycle.deployed_from_training} served by the backend`, state: d.lifecycle.deployed_from_training ? 'done' : 'pending' },
            ]} />
            {d.training_pipeline.message && (
              <p className="mt-3 text-xs text-[#566475] bg-[#F4F7FA] border border-[#E2E8F0] rounded-lg p-3">
                <b className="text-[#0B2545]">Retraining is not operational.</b> {d.training_pipeline.message}
              </p>
            )}
          </Section>

          {d.charts.status && Object.keys(d.charts.status).length > 0 && (
            <p className="text-[11px] text-[#8A99AA]">Prediction outcomes: {Object.entries(d.charts.status).map(([k, v]) => `${humanize(k)} ${v}`).join(' · ')}</p>
          )}
        </>
      )}
    </div>
  );
};
