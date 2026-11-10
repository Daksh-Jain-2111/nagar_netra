from backend.app.ml.providers.clip_zero_shot import ClipZeroShotClassifier
from backend.app.ml.providers.onnx_classifier import OnnxIssueClassifier

PROVIDERS = {
    "clip_zero_shot": ClipZeroShotClassifier,
    "onnx_classifier": OnnxIssueClassifier,
}

__all__ = ["ClipZeroShotClassifier", "OnnxIssueClassifier", "PROVIDERS"]
