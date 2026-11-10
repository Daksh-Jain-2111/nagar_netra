"""
Multi-image evidence aggregation.

A citizen can attach up to 3 photos of the same issue. Each photo is classified independently
(batched in one forward pass) and the per-photo probability distributions are combined with an
arithmetic mean ("soft voting"):

    P(issue | photos) = (1/N) * sum_i P(issue | photo_i)

Why the mean and not max/product:
  * one ambiguous or off-target photo (e.g. a wide street shot) lowers confidence instead of
    flipping the answer, and disagreement between photos is surfaced as lower confidence;
  * the product of probabilities becomes over-confident when photos agree and collapses when one
    photo is unrelated; max lets a single odd photo dominate.
The result is still a proper distribution, so the same confidence thresholds apply.
"""
from dataclasses import dataclass
from typing import List, Sequence

import numpy as np

AGGREGATION_METHOD = "mean_probability"


@dataclass(frozen=True)
class AggregatedDistribution:
    probabilities: np.ndarray       # shape (num_labels,)
    per_image_top: List[int]        # argmax label index for each image
    images_used: int


def aggregate_probabilities(per_image: np.ndarray, weights: Sequence[float] = None) -> AggregatedDistribution:
    if per_image.ndim != 2 or per_image.shape[0] == 0:
        raise ValueError("Expected a non-empty (num_images, num_labels) probability matrix")
    if weights is None:
        w = np.full(per_image.shape[0], 1.0 / per_image.shape[0])
    else:
        w = np.asarray(weights, dtype=np.float64)
        if w.shape[0] != per_image.shape[0] or np.any(w < 0) or w.sum() <= 0:
            raise ValueError("Invalid aggregation weights")
        w = w / w.sum()
    combined = (per_image.astype(np.float64) * w[:, None]).sum(axis=0)
    combined = combined / combined.sum()
    return AggregatedDistribution(
        probabilities=combined,
        per_image_top=[int(i) for i in np.argmax(per_image, axis=1)],
        images_used=int(per_image.shape[0]),
    )
