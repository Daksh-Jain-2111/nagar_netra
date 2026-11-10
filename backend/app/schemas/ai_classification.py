"""Response schemas for POST /api/v1/ai/classify-image."""
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field

ConfidenceBand = Literal["strong", "suggestion", "low", "insufficient"]
ClassificationStatus = Literal["success", "low_confidence", "no_civic_issue", "no_prediction"]


class IssuePrediction(BaseModel):
    rank: int
    issue_code: str
    issue_name: str
    issue_name_mr: str
    confidence: float = Field(..., ge=0.0, le=1.0, description="Model probability for this issue (not accuracy)")
    confidence_band: ConfidenceBand
    recommended: bool = Field(..., description="True only for the top prediction when it clears the minimum threshold")
    # Mapping (resolved from the corporation's category master; null when unmapped)
    mapping_status: Literal["mapped", "unmapped"]
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    category_name_mr: Optional[str] = None
    app_category_id: Optional[str] = None
    department_id: Optional[str] = None
    department_code: Optional[str] = None
    department_name: Optional[str] = None
    department_name_mr: Optional[str] = None
    sla_hours: Optional[int] = Field(None, description="Category resolution SLA in hours (categories.resolution_hours)")
    response_sla_hours: Optional[int] = Field(None, description="Statutory response clock in hours (48h, 24h if urgent)")
    priority: Optional[str] = None
    is_urgent: Optional[bool] = None
    redirect_target: Optional[str] = None


class ImageAnalysis(BaseModel):
    index: int
    filename: Optional[str] = None
    status: Literal["analyzed", "rejected"]
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    top_issue_code: Optional[str] = None
    top_confidence: Optional[float] = None


class AggregationInfo(BaseModel):
    method: str
    images_received: int
    images_analyzed: int
    top_issue_agreement: int = Field(..., description="Analyzed images whose own top issue equals the final top issue")


class ConfidenceThresholdsOut(BaseModel):
    strong: float
    suggestion: float
    minimum: float
    routing: float = Field(..., description="Corporation setting ai_confidence_threshold used by complaint routing")


class ModelInfoOut(BaseModel):
    provider: str
    model_id: str
    version: str
    taxonomy_version: str


class ClassifyImageResponse(BaseModel):
    status: ClassificationStatus
    message: str
    recommended_issue_code: Optional[str] = None
    top_confidence: float
    meets_routing_threshold: bool
    predictions: List[IssuePrediction]
    images: List[ImageAnalysis]
    aggregation: AggregationInfo
    thresholds: ConfidenceThresholdsOut
    model: ModelInfoOut
    modalities_used: List[str]
    context_received: Dict[str, bool]
    latency_ms: int
