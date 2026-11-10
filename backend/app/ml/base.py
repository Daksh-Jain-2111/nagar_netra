"""
Model-inference contract for civic issue image classification.

This layer knows ONLY about images and issue codes (the model's label space). It has no notion of
departments, SLAs, corporations or the database; those live in rules/issue_mapping_rules.py and
services/issue_classification_service.py. Any model (zero-shot CLIP, a fine-tuned CNN/ViT, a remote
inference service) can be plugged in by implementing `CivicIssueClassifier.predict_proba_batch`.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Sequence, Tuple

import numpy as np
from PIL import Image


class ModelUnavailableError(RuntimeError):
    """The model artifacts are missing/invalid or the provider is disabled."""


class InferenceError(RuntimeError):
    """The model failed while running inference."""


@dataclass(frozen=True)
class ModelInfo:
    provider: str            # e.g. "clip_zero_shot"
    model_id: str            # e.g. "open_clip/ViT-B-16/laion400m_e32"
    version: str             # artifact version from the model manifest
    labels: Tuple[str, ...]  # issue codes, in output order


@dataclass(frozen=True)
class IssueScore:
    issue_code: str
    confidence: float        # probability in [0, 1] from the model (not accuracy)


class CivicIssueClassifier(ABC):
    """Abstract civic issue classifier. Implementations must be thread-safe for inference."""

    @property
    @abstractmethod
    def info(self) -> ModelInfo:
        ...

    @abstractmethod
    def predict_proba_batch(self, images: Sequence[Image.Image]) -> np.ndarray:
        """Return an array of shape (len(images), len(info.labels)); each row sums to 1."""

    def inference_spec(self) -> dict:
        """
        Static inference parameters this model actually uses (input tensor, preprocessing, runtime),
        recorded with every prediction for audit. Providers override this; values must come from the
        loaded artifact/session, never from documentation.
        """
        return {}

    # Convenience API --------------------------------------------------------
    def predict(self, image: Image.Image) -> List[IssueScore]:
        """Full probability distribution for one image, highest confidence first."""
        probs = self.predict_proba_batch([image])[0]
        return scores_from_probabilities(self.info.labels, probs)

    def predict_top_k(self, image: Image.Image, k: int = 3) -> List[IssueScore]:
        return self.predict(image)[: max(0, k)]


def scores_from_probabilities(labels: Sequence[str], probs: np.ndarray) -> List[IssueScore]:
    order = np.argsort(-probs, kind="stable")
    return [IssueScore(issue_code=labels[i], confidence=float(probs[i])) for i in order]


def softmax(logits: np.ndarray, axis: int = -1) -> np.ndarray:
    shifted = logits - np.max(logits, axis=axis, keepdims=True)
    exp = np.exp(shifted)
    return exp / np.sum(exp, axis=axis, keepdims=True)
