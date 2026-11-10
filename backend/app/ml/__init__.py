"""
Civic issue image classification: model inference only (image -> issue code probabilities).
Department / SLA mapping lives in backend.app.rules.issue_mapping_rules.
"""
from backend.app.ml.base import (
    CivicIssueClassifier,
    InferenceError,
    IssueScore,
    ModelInfo,
    ModelUnavailableError,
)

__all__ = [
    "CivicIssueClassifier",
    "InferenceError",
    "IssueScore",
    "ModelInfo",
    "ModelUnavailableError",
]
