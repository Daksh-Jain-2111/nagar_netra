"""
Civic issue -> category -> department -> SLA mapping rules, and AI confidence policy.

Pure business logic (no DB, no ML). The ML layer only emits issue codes + confidences; this module
decides what those codes mean for the corporation. Department and SLA values always come from the
category master records passed in by the caller (DB), never from constants defined here.
"""
import json
import functools
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from backend.app.rules.clock_rules import response_clock_hours

TAXONOMY_PATH = Path(__file__).resolve().parent / "civic_issue_taxonomy.json"

ISSUE_KIND_ISSUE = "issue"
ISSUE_KIND_REJECT = "reject"


# ---------------------------------------------------------------------------
# Taxonomy
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class CivicIssue:
    code: str
    kind: str
    name_en: str
    name_mr: str
    category_id: Optional[str]
    app_category_id: Optional[str]
    corporation_overrides: Dict[str, str] = field(default_factory=dict)

    @property
    def is_reject(self) -> bool:
        return self.kind == ISSUE_KIND_REJECT

    def candidate_category_ids(self, corporation_id: str) -> List[str]:
        """Category ids to try, in order, for a corporation."""
        candidates: List[str] = []
        override = self.corporation_overrides.get(corporation_id)
        if override:
            candidates.append(override)
        if self.category_id:
            candidates.append(self.category_id)
            # Corporations bootstrapped from the platform template prefix ids with the corp id
            # (see routers/platform.py create_corporation_from_template).
            candidates.append(f"{corporation_id}_{self.category_id}")
        return candidates


@dataclass(frozen=True)
class CivicIssueTaxonomy:
    version: str
    issues: Tuple[CivicIssue, ...]

    @functools.cached_property
    def by_code(self) -> Dict[str, CivicIssue]:
        return {i.code: i for i in self.issues}

    def get(self, code: str) -> Optional[CivicIssue]:
        return self.by_code.get(code)

    @property
    def codes(self) -> List[str]:
        return [i.code for i in self.issues]


def parse_taxonomy(raw: Dict[str, Any]) -> CivicIssueTaxonomy:
    issues: List[CivicIssue] = []
    seen = set()
    for entry in raw.get("issues", []):
        code = entry["code"]
        if code in seen:
            raise ValueError(f"Duplicate civic issue code in taxonomy: {code}")
        seen.add(code)
        kind = entry.get("kind", ISSUE_KIND_ISSUE)
        if kind not in (ISSUE_KIND_ISSUE, ISSUE_KIND_REJECT):
            raise ValueError(f"Invalid kind '{kind}' for issue {code}")
        if kind == ISSUE_KIND_ISSUE and not entry.get("category_id"):
            raise ValueError(f"Issue {code} must map to a category_id")
        issues.append(CivicIssue(
            code=code,
            kind=kind,
            name_en=entry["name_en"],
            name_mr=entry.get("name_mr") or entry["name_en"],
            category_id=entry.get("category_id"),
            app_category_id=entry.get("app_category_id"),
            corporation_overrides=dict(entry.get("corporation_overrides") or {}),
        ))
    if not issues:
        raise ValueError("Civic issue taxonomy is empty")
    return CivicIssueTaxonomy(version=str(raw.get("taxonomy_version", "unversioned")), issues=tuple(issues))


@functools.lru_cache(maxsize=1)
def load_taxonomy(path: str = str(TAXONOMY_PATH)) -> CivicIssueTaxonomy:
    with open(path, "r", encoding="utf-8") as fh:
        return parse_taxonomy(json.load(fh))


# ---------------------------------------------------------------------------
# Confidence policy
# ---------------------------------------------------------------------------
BAND_STRONG = "strong"            # >= strong threshold          -> strong AI recommendation
BAND_SUGGESTION = "suggestion"    # >= suggestion threshold      -> AI suggestion
BAND_LOW = "low"                  # >= minimum threshold         -> low-confidence suggestion
BAND_INSUFFICIENT = "insufficient"  # < minimum                  -> never presented as a recommendation


@dataclass(frozen=True)
class ConfidenceThresholds:
    strong: float = 0.80
    suggestion: float = 0.60
    minimum: float = 0.40

    def __post_init__(self):
        for name in ("strong", "suggestion", "minimum"):
            value = getattr(self, name)
            if not 0.0 <= value <= 1.0:
                raise ValueError(f"Confidence threshold '{name}' must be within [0, 1], got {value}")
        if not (self.strong >= self.suggestion >= self.minimum):
            raise ValueError("Confidence thresholds must satisfy strong >= suggestion >= minimum")


def confidence_band(confidence: float, thresholds: ConfidenceThresholds) -> str:
    if confidence >= thresholds.strong:
        return BAND_STRONG
    if confidence >= thresholds.suggestion:
        return BAND_SUGGESTION
    if confidence >= thresholds.minimum:
        return BAND_LOW
    return BAND_INSUFFICIENT


# ---------------------------------------------------------------------------
# Issue -> category -> department -> SLA
# ---------------------------------------------------------------------------
def resolve_category_record(
    issue: CivicIssue,
    corporation_id: str,
    categories_by_id: Dict[str, Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    """Pick the active category record for an issue from the corporation's category master."""
    for candidate in issue.candidate_category_ids(corporation_id):
        record = categories_by_id.get(candidate)
        if record and record.get("is_active", True):
            return record
    return None


def build_issue_mapping(
    issue: CivicIssue,
    category: Optional[Dict[str, Any]],
    department: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Deterministic mapping for one issue. `category` / `department` are plain dicts read from the
    category master. SLA:
      - sla_hours           = category resolution SLA (categories.resolution_hours)
      - response_sla_hours  = statutory response clock from clock_rules (urgent categories are faster)
    """
    mapping: Dict[str, Any] = {
        "category_id": None,
        "category_name": None,
        "category_name_mr": None,
        "app_category_id": issue.app_category_id,
        "department_id": None,
        "department_code": None,
        "department_name": None,
        "department_name_mr": None,
        "sla_hours": None,
        "response_sla_hours": None,
        "priority": None,
        "is_urgent": None,
        "redirect_target": None,
        "mapping_status": "unmapped",
    }
    if not category:
        return mapping

    is_urgent = bool(category.get("is_urgent"))
    mapping.update({
        "category_id": category["id"],
        "category_name": category.get("name"),
        "category_name_mr": category.get("name_mr"),
        "sla_hours": category.get("resolution_hours"),
        "response_sla_hours": response_clock_hours(is_urgent),
        "priority": category.get("priority"),
        "is_urgent": is_urgent,
        "redirect_target": category.get("redirect_target"),
        "mapping_status": "mapped",
    })
    if department:
        mapping.update({
            "department_id": department["id"],
            "department_code": department.get("code"),
            "department_name": department.get("name"),
            "department_name_mr": department.get("name_mr"),
        })
    return mapping
