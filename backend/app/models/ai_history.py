"""
AI model history: model registry, prediction events, reviewer feedback, curated training samples,
dataset snapshots and training runs.

These tables only RECORD what the AI pipeline actually did. Nothing here triggers training:
  * a prediction event is written when a complaint is submitted (services/ai_history_service.py);
  * reviewer feedback never becomes training data on its own - a second administrator must approve
    the sample before it enters the curated dataset;
  * training runs are reported by an external training pipeline (none exists in this repo yet);
  * a model version is "ACTIVE" only when the running backend is configured to serve it
    (services/ai_model_registry_service.py), never because it was trained or approved.
"""
import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey, Integer, JSON, String, Text, UniqueConstraint,
)
from sqlalchemy.orm import relationship

from backend.app.database import Base


def _utcnow():
    return datetime.datetime.utcnow()


class SchemaMigration(Base):
    """Applied lightweight schema/data migrations (the project has no Alembic setup)."""
    __tablename__ = "schema_migrations"

    id = Column(String(100), primary_key=True)
    applied_at = Column(DateTime, default=_utcnow)
    notes = Column(Text, nullable=True)


class AIModelVersion(Base):
    __tablename__ = "ai_model_versions"
    __table_args__ = (UniqueConstraint("model_key", "version", name="uq_ai_model_key_version"),)

    id = Column(String(60), primary_key=True)                 # aimv_<sha1 prefix>
    model_key = Column(String(50), nullable=False, index=True)  # image_issue_classifier | text_keyword_rules | speech_recognition
    task = Column(String(40), nullable=False)                 # image_classification | text_classification | speech_recognition
    name = Column(String(150), nullable=False)
    version = Column(String(100), nullable=False)
    version_source = Column(String(120), nullable=True)       # where the version string came from
    provider = Column(String(50), nullable=True)
    architecture = Column(String(255), nullable=True)
    model_format = Column(String(80), nullable=True)
    input_spec = Column(JSON, nullable=True)
    output_classes = Column(JSON, nullable=True)
    preprocessing = Column(JSON, nullable=True)
    confidence_thresholds = Column(JSON, nullable=True)
    supported_languages = Column(JSON, nullable=True)
    artifact_uri = Column(String(255), nullable=True)
    artifact_checksum = Column(String(80), nullable=True)
    artifact_files = Column(JSON, nullable=True)              # [{name, sha256, declared_sha256, size_bytes, verified}]
    framework = Column(JSON, nullable=True)
    metadata_source = Column(String(255), nullable=True)
    notes = Column(JSON, nullable=True)                       # list of caveats shown to admins
    extra = Column(JSON, nullable=True)
    trainable = Column(Boolean, default=False)
    # ACTIVE | NOT_DEPLOYED | SUPERSEDED | ROLLED_BACK
    deployment_status = Column(String(20), default="NOT_DEPLOYED")
    first_seen_at = Column(DateTime, default=_utcnow)
    last_synced_at = Column(DateTime, default=_utcnow)
    activated_at = Column(DateTime, nullable=True)
    deactivated_at = Column(DateTime, nullable=True)


class AIPredictionEvent(Base):
    __tablename__ = "ai_prediction_events"

    id = Column(String(40), primary_key=True)                 # pred_<hex>
    corporation_id = Column(String(50), ForeignKey("corporations.id"), nullable=False, index=True)
    complaint_id = Column(String(50), ForeignKey("complaints.id"), nullable=True, index=True)
    model_version_id = Column(String(60), ForeignKey("ai_model_versions.id"), nullable=True, index=True)
    model_key = Column(String(50), nullable=False, index=True)
    model_name = Column(String(150), nullable=False)
    model_version = Column(String(100), nullable=False)
    model_provider = Column(String(50), nullable=True)
    task = Column(String(40), nullable=False)
    input_type = Column(String(20), nullable=False)           # IMAGE | TEXT | VOICE | COMBINED
    input_summary = Column(JSON, nullable=True)
    status = Column(String(20), nullable=False)               # SUCCESS | LOW_CONFIDENCE | NO_CIVIC_ISSUE | NO_PREDICTION | FAILED
    predicted_label = Column(String(60), nullable=True)
    predicted_label_name = Column(String(150), nullable=True)
    predicted_category_id = Column(String(50), nullable=True, index=True)
    predicted_category_name = Column(String(150), nullable=True)
    predicted_department_id = Column(String(50), nullable=True)
    predicted_department_name = Column(String(150), nullable=True)
    confidence = Column(Float, nullable=True)
    top_predictions = Column(JSON, nullable=True)
    routing_decision = Column(String(30), nullable=False)     # AI_SUGGESTED | HUMAN_REVIEW_REQUIRED | MANUAL_SELECTION | PREDICTION_FAILED
    routing_reason = Column(Text, nullable=True)
    final_category_id = Column(String(50), nullable=True)
    inference_params = Column(JSON, nullable=True)
    latency_ms = Column(Integer, nullable=True)
    error_message = Column(String(255), nullable=True)
    origin = Column(String(20), default="LIVE")               # LIVE | BACKFILL | SEED_SAMPLE
    is_demo = Column(Boolean, default=False)
    feedback_status = Column(String(20), default="NOT_REVIEWED", index=True)  # NOT_REVIEWED | ACCEPTED | CORRECTED | DISPUTED
    ground_truth_label = Column(String(60), nullable=True)    # set only by a reviewer
    # NOT_ELIGIBLE | NEEDS_REVIEW | PENDING_VALIDATION | APPROVED | REJECTED
    training_eligibility = Column(String(25), default="NOT_ELIGIBLE")
    training_eligibility_reason = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=_utcnow, index=True)

    feedback = relationship("AIPredictionFeedback", back_populates="prediction",
                            order_by="AIPredictionFeedback.created_at.desc()", cascade="all, delete-orphan")
    model_version_rel = relationship("AIModelVersion")


class AIPredictionFeedback(Base):
    __tablename__ = "ai_prediction_feedback"

    id = Column(Integer, primary_key=True, autoincrement=True)
    prediction_id = Column(String(40), ForeignKey("ai_prediction_events.id"), nullable=False, index=True)
    review_status = Column(String(20), nullable=False)        # ACCEPTED | CORRECTED | DISPUTED
    original_label = Column(String(60), nullable=True)
    corrected_label = Column(String(60), nullable=True)
    corrected_label_name = Column(String(150), nullable=True)
    notes = Column(Text, nullable=True)
    reviewer_id = Column(String(50), nullable=False)
    reviewer_name = Column(String(100), nullable=False)
    reviewer_role = Column(String(30), nullable=False)
    created_at = Column(DateTime, default=_utcnow)

    prediction = relationship("AIPredictionEvent", back_populates="feedback")


class AITrainingSample(Base):
    """A reviewed example that a SECOND administrator approved for the curated training dataset."""
    __tablename__ = "ai_training_samples"

    id = Column(String(40), primary_key=True)                 # ts_<hex>
    prediction_id = Column(String(40), ForeignKey("ai_prediction_events.id"), nullable=False, unique=True)
    complaint_id = Column(String(50), ForeignKey("complaints.id"), nullable=True)
    model_key = Column(String(50), nullable=False, index=True)
    label = Column(String(60), nullable=False)
    label_source = Column(String(30), nullable=False)         # CONFIRMED_PREDICTION | REVIEWER_CORRECTION
    feedback_id = Column(Integer, ForeignKey("ai_prediction_feedback.id"), nullable=True)
    labelled_by = Column(String(50), nullable=False)
    approved_by = Column(String(50), nullable=False)
    approved_by_name = Column(String(100), nullable=True)
    approved_at = Column(DateTime, default=_utcnow)
    media_paths = Column(JSON, nullable=True)                 # complaint photo paths (UPLOAD_DIR-relative)
    status = Column(String(20), default="APPROVED")           # APPROVED | REVOKED
    notes = Column(Text, nullable=True)


class AIDatasetVersion(Base):
    """Immutable snapshot of approved training samples (the hand-off to a training pipeline)."""
    __tablename__ = "ai_dataset_versions"

    id = Column(String(60), primary_key=True)
    model_key = Column(String(50), nullable=False, index=True)
    version = Column(String(80), nullable=False, unique=True)
    fingerprint = Column(String(64), nullable=False)          # sha256 of the sorted (sample id, label, media) list
    sample_count = Column(Integer, nullable=False)
    class_distribution = Column(JSON, nullable=False)
    manifest = Column(JSON, nullable=False)                   # [{sample_id, prediction_id, complaint_id, label, media_paths}]
    created_by = Column(String(50), nullable=False)
    created_by_name = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=_utcnow)
    notes = Column(Text, nullable=True)


class AITrainingRun(Base):
    """A training job reported by the training pipeline. Completion != approval != deployment."""
    __tablename__ = "ai_training_runs"

    id = Column(String(60), primary_key=True)
    model_key = Column(String(50), nullable=False, index=True)
    model_name = Column(String(150), nullable=True)
    previous_model_version_id = Column(String(60), ForeignKey("ai_model_versions.id"), nullable=True)
    previous_model_version = Column(String(100), nullable=True)
    candidate_model_version = Column(String(100), nullable=False)
    candidate_model_version_id = Column(String(60), ForeignKey("ai_model_versions.id"), nullable=True)
    dataset_version_id = Column(String(60), ForeignKey("ai_dataset_versions.id"), nullable=True)
    dataset_version = Column(String(80), nullable=True)
    dataset_fingerprint = Column(String(64), nullable=True)
    training_samples = Column(Integer, nullable=True)
    split_sizes = Column(JSON, nullable=True)                 # {"train": n, "validation": n, "test": n}
    class_distribution = Column(JSON, nullable=True)
    reviewed_samples = Column(Integer, nullable=True)
    training_config = Column(JSON, nullable=True)             # architecture, epochs, batch_size, optimizer, ...
    evaluation = Column(JSON, nullable=True)                  # metrics produced by the evaluation pipeline only
    comparison = Column(JSON, nullable=True)                  # previous vs candidate on the same evaluation set
    training_status = Column(String(20), default="QUEUED")    # QUEUED | RUNNING | COMPLETED | FAILED | CANCELLED
    evaluation_status = Column(String(20), default="NOT_EVALUATED")  # NOT_EVALUATED | AWAITING_REVIEW | PASSED | FAILED
    deployment_status = Column(String(20), default="NOT_DEPLOYED")   # NOT_DEPLOYED | STAGING | ACTIVE | ROLLED_BACK
    approval_status = Column(String(20), default="PENDING")   # PENDING | APPROVED | REJECTED
    approved_by = Column(String(50), nullable=True)
    approved_by_name = Column(String(100), nullable=True)
    approval_notes = Column(Text, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    deployed_at = Column(DateTime, nullable=True)
    rollback_info = Column(JSON, nullable=True)
    environment = Column(String(20), default="production")    # production | staging | demo
    is_demo = Column(Boolean, default=False)
    reported_by = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)
    queued_at = Column(DateTime, default=_utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)
