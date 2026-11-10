/**
 * Admin "AI & Model Management" API client (/api/v1/admin/ai/*).
 * Every value shown in these pages comes from these endpoints; nothing is mocked client-side.
 */
import { ApiClient } from './api';

export type ModelKey = 'image_issue_classifier' | 'text_keyword_rules' | 'speech_recognition' | string;
export type InputType = 'IMAGE' | 'TEXT' | 'VOICE' | 'COMBINED';
export type RoutingDecision = 'AI_SUGGESTED' | 'HUMAN_REVIEW_REQUIRED' | 'MANUAL_SELECTION' | 'PREDICTION_FAILED';
export type FeedbackStatus = 'NOT_REVIEWED' | 'ACCEPTED' | 'CORRECTED' | 'DISPUTED';
export type TrainingEligibility = 'NOT_ELIGIBLE' | 'NEEDS_REVIEW' | 'PENDING_VALIDATION' | 'APPROVED' | 'REJECTED';

export interface EnvironmentInfo { mode: 'development' | 'production'; dev_mode: boolean }

export interface PredictionRow {
  id: string;
  complaint_id: string | null;
  corporation_id: string;
  input_type: InputType;
  task: string;
  status: string;
  predicted_label: string | null;
  predicted_label_name: string | null;
  predicted_category_id: string | null;
  predicted_category_name: string | null;
  predicted_department_name: string | null;
  model_key: ModelKey;
  model_name: string;
  model_version: string;
  model_version_id: string | null;
  confidence: number | null;
  routing_decision: RoutingDecision;
  feedback_status: FeedbackStatus;
  training_eligibility: TrainingEligibility;
  origin: 'LIVE' | 'BACKFILL' | 'SEED_SAMPLE';
  is_demo: boolean;
  created_at: string;
}

export interface PredictionList {
  items: PredictionRow[];
  total: number;
  page: number;
  page_size: number;
  facets: {
    model_versions: { model_key: string; version: string; count: number }[];
    categories: { id: string; name: string | null; count: number }[];
    labels: { id: string; name: string | null; count: number }[];
  };
  environment: EnvironmentInfo;
}

export interface TopPrediction {
  rank: number;
  label: string;
  name?: string | null;
  score: number | null;
  band?: string | null;
  category_id?: string | null;
  department?: string | null;
}

export interface FeedbackEntry {
  id: number;
  review_status: FeedbackStatus;
  original_label: string | null;
  corrected_label: string | null;
  corrected_label_name: string | null;
  notes: string | null;
  reviewer: string;
  reviewer_id: string;
  reviewer_role: string;
  created_at: string;
}

export interface PredictionDetail extends PredictionRow {
  complaint: null | {
    complaint_reference: string;
    submitted_at: string;
    channel: string;
    input_modalities: string[];
    is_anonymous: boolean;
    filed_category_id: string;
    filed_category_name: string | null;
    department: string | null;
    ward: string | null;
    initial_status: string | null;
    current_status: string;
    description: string | null;
    photo_urls: string[];
    voice: null | {
      language: string | null;
      duration_seconds: number;
      transcription_status: string;
      transcription_model: string | null;
      transcript: string | null;
    };
  };
  model: Partial<ModelVersion> & { registered?: boolean };
  inference: { params: Record<string, any> | null; latency_ms: number | null; input_summary: Record<string, any> | null };
  results: {
    status: string;
    top_predictions: TopPrediction[];
    routing_decision: RoutingDecision;
    routing_reason: string | null;
    final_category_id: string | null;
    error_message: string | null;
    timestamp: string;
  };
  feedback: {
    original_prediction: string | null;
    ground_truth_label: string | null;
    ground_truth_label_name: string | null;
    review_status: FeedbackStatus;
    training_eligibility: TrainingEligibility;
    training_eligibility_reason: string | null;
    training_sample_id: string | null;
    history: FeedbackEntry[];
    allowed_labels: { code: string; name: string | null }[];
    can_review: boolean;
    can_validate: boolean;
  };
  related_predictions: PredictionRow[];
}

export interface ArtifactFile {
  role: string;
  name: string;
  sha256: string | null;
  declared_sha256: string | null;
  size_bytes: number | null;
  present: boolean;
  verified: boolean | null;
}

export interface ModelVersion {
  id: string;
  model_key: ModelKey;
  task: string;
  name: string;
  version: string;
  version_source: string | null;
  provider: string | null;
  architecture: string | null;
  model_format: string | null;
  deployment_status: 'ACTIVE' | 'NOT_DEPLOYED' | 'SUPERSEDED' | 'ROLLED_BACK';
  trainable: boolean;
  artifact_uri: string | null;
  artifact_checksum: string | null;
  output_class_count: number | null;
  supported_languages: string[] | null;
  confidence_thresholds: Record<string, any> | null;
  first_seen_at: string | null;
  last_updated_at: string | null;
  activated_at: string | null;
  deactivated_at: string | null;
  notes: string[];
  prediction_count?: number;
  input_spec?: Record<string, any> | null;
  output_classes?: { code: string; name: string | null; keywords?: number }[] | null;
  preprocessing?: Record<string, any> | null;
  artifact_files?: ArtifactFile[] | null;
  framework?: Record<string, any> | null;
  metadata_source?: string | null;
  extra?: Record<string, any> | null;
  runtime?: RuntimeState;
}

export interface RuntimeState {
  provider?: string;
  loaded: boolean;
  model_id?: string | null;
  last_error?: string | null;
  version?: string | null;
}

export interface TrainingRunRow {
  id: string;
  model_key: string;
  model_name: string | null;
  previous_model_version: string | null;
  candidate_model_version: string;
  dataset_version: string | null;
  training_samples: number | null;
  training_status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  evaluation_status: 'NOT_EVALUATED' | 'AWAITING_REVIEW' | 'PASSED' | 'FAILED';
  deployment_status: 'NOT_DEPLOYED' | 'STAGING' | 'ACTIVE' | 'ROLLED_BACK';
  approval_status: 'PENDING' | 'APPROVED' | 'REJECTED';
  environment: string;
  is_demo: boolean;
  queued_at: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface TrainingRunDetail extends TrainingRunRow {
  dataset: {
    version: string | null; version_id: string | null; fingerprint: string | null;
    split_sizes: Record<string, number> | null; class_distribution: Record<string, number> | null;
    reviewed_samples: number | null; training_samples: number | null;
  };
  training_config: Record<string, any> | null;
  evaluation: Record<string, any> | null;
  comparison: { evaluation_dataset: string; previous: Record<string, any>; candidate: Record<string, any> } | null;
  promotion: {
    approval_status: string; approved_by: string | null; approved_at: string | null; approval_notes: string | null;
    deployment_status: string; deployed_at: string | null; rollback_info: Record<string, any> | null;
  };
  reported_by: string | null;
  notes: string | null;
  updated_at: string | null;
}

export interface Overview {
  environment: EnvironmentInfo;
  include_demo: boolean;
  summary: {
    total_predictions: number;
    demo_predictions_excluded: number;
    active_models: { model_key: string; name: string; version: string; id: string }[];
    predictions_requiring_review: number;
    average_confidence: Record<string, { average: number; count: number }>;
    total_training_runs: number;
    last_successful_retraining: TrainingRunRow | null;
  };
  charts: {
    predictions_per_day: ({ date: string } & Record<string, number | string>)[];
    routing_decisions: Record<string, number>;
    feedback_status: Record<string, number>;
    input_types: Record<string, number>;
    status: Record<string, number>;
    confidence_histogram: Record<string, number[]>;
    by_model_version: Record<string, number>;
  };
  lifecycle: Record<string, number>;
  runtime: Record<string, RuntimeState>;
  training_pipeline: { exists: boolean; message: string | null };
}

const qs = (params: Record<string, any>) => {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '' || v === false) return;
    sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
};

export const AiAdminApi = {
  overview: (params: { include_demo?: boolean; corporation_id?: string } = {}) =>
    ApiClient.request<Overview>(`/admin/ai/overview${qs(params)}`),
  predictions: (params: Record<string, any>) =>
    ApiClient.request<PredictionList>(`/admin/ai/predictions${qs(params)}`),
  prediction: (id: string) => ApiClient.request<PredictionDetail>(`/admin/ai/predictions/${encodeURIComponent(id)}`),
  submitFeedback: (id: string, body: { review_status: FeedbackStatus; corrected_label?: string | null; notes?: string }) =>
    ApiClient.request(`/admin/ai/predictions/${encodeURIComponent(id)}/feedback`, { method: 'POST', body: JSON.stringify(body) }),
  decideTrainingEligibility: (id: string, decision: 'approve' | 'reject', notes?: string) =>
    ApiClient.request(`/admin/ai/predictions/${encodeURIComponent(id)}/training-eligibility`, {
      method: 'POST', body: JSON.stringify({ decision, notes }),
    }),
  models: () => ApiClient.request<{ items: ModelVersion[]; runtime: Record<string, RuntimeState>; environment: EnvironmentInfo }>('/admin/ai/models'),
  modelParameters: (id: string) => ApiClient.request<ModelVersion>(`/admin/ai/models/${encodeURIComponent(id)}/parameters`),
  syncModels: () => ApiClient.request<{ synced_at: string; versions_seen: number; status_changes: any[] }>('/admin/ai/models/sync', { method: 'POST' }),
  trainingRuns: (params: Record<string, any>) =>
    ApiClient.request<{ items: TrainingRunRow[]; total: number; page: number; page_size: number;
      pipeline: { runs_reported: number; approved_training_samples: number; dataset_versions: number; message: string | null };
      environment: EnvironmentInfo }>(`/admin/ai/training-runs${qs(params)}`),
  trainingRun: (id: string) => ApiClient.request<TrainingRunDetail>(`/admin/ai/training-runs/${encodeURIComponent(id)}`),
  decidePromotion: (id: string, decision: 'approve' | 'reject', notes?: string) =>
    ApiClient.request<TrainingRunDetail>(`/admin/ai/training-runs/${encodeURIComponent(id)}/approval`, {
      method: 'POST', body: JSON.stringify({ decision, notes }),
    }),
  trainingSamples: () =>
    ApiClient.request<{ items: { id: string; prediction_id: string; complaint_id: string | null; model_key: string; label: string;
      label_source: string; approved_by: string; approved_at: string; media_count: number; status: string }[];
      pending_validation: number }>('/admin/ai/training-samples'),
  datasets: () =>
    ApiClient.request<{ items: { id: string; model_key: string; version: string; fingerprint: string; sample_count: number;
      class_distribution: Record<string, number>; created_by: string; created_at: string; notes: string | null }[] }>('/admin/ai/datasets'),
  createDataset: (notes?: string) =>
    ApiClient.request('/admin/ai/datasets', { method: 'POST', body: JSON.stringify({ model_key: 'image_issue_classifier', notes }) }),
};
