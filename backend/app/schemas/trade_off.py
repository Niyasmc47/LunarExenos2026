from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

from app.schemas.mission_profile import (
    MissionProfile,
    RequirementClassification,
)
from app.schemas.screening import (
    ScreeningVerdict,
    OverallCandidateStatus,
    DataCoverageStatus,
    RequirementEvaluationResult,
    CandidateScreeningSummary,
)
from app.schemas.window_planner import (
    EvaluatedMissionWindow,
    WindowClassification,
)
from app.schemas.terrain_assessment import (
    CandidateTerrainAssessment,
    TerrainSuitabilityStatus,
)


class PreferenceDirection(str, Enum):
    HIGHER_IS_BETTER = "HIGHER_IS_BETTER"  # Benefit criterion
    LOWER_IS_BETTER = "LOWER_IS_BETTER"    # Cost criterion
    TARGET_RANGE = "TARGET_RANGE"          # Proximity to preferred interval


class NormalizationMethod(str, Enum):
    MIN_MAX = "MIN_MAX"                    # Linear scaling using reference bounds
    TARGET_RANGE = "TARGET_RANGE"          # Distance penalty outside target interval


class ParetoDominanceStatus(str, Enum):
    PARETO_OPTIMAL = "PARETO_OPTIMAL"                  # Non-dominated across all comparable dimensions
    DOMINATED = "DOMINATED"                            # Strictly dominated by at least one alternative
    INCOMPARABLE_INCOMPLETE = "INCOMPARABLE_INCOMPLETE"  # Incomplete data prevents definitive dominance classification


class PreferenceCriterionConfig(BaseModel):
    id: str = Field(..., description="Unique criterion ID (e.g. 'pref-sunlight')")
    name: str = Field(..., description="Human-readable criterion label")
    metric_key: str = Field(..., description="Internal metric key in extracted metrics dictionary")
    unit: str = Field(..., description="Measurement unit (e.g. 'h', 'deg', 'm')")
    category: str = Field("solar", description="'solar', 'earth', or 'terrain'")
    enabled: bool = Field(True, description="Whether criterion participates in multi-criteria evaluation")
    weight: float = Field(1.0, ge=0.0, description="Raw user-entered weight >= 0.0")
    direction: PreferenceDirection = Field(PreferenceDirection.HIGHER_IS_BETTER)
    normalization_method: NormalizationMethod = Field(NormalizationMethod.MIN_MAX)
    reference_min: Optional[float] = Field(None, description="Lower reference bound for normalization")
    reference_max: Optional[float] = Field(None, description="Upper reference bound for normalization")
    target_min: Optional[float] = Field(None, description="Preferred lower bound for target-range metrics")
    target_max: Optional[float] = Field(None, description="Preferred upper bound for target-range metrics")
    is_relative_to_alternatives: bool = Field(False, description="Whether reference bounds were derived from candidate pool")
    description: str = Field("", description="Detailed explanation of criterion significance")


class PreferenceModelConfig(BaseModel):
    criteria: List[PreferenceCriterionConfig] = Field(default_factory=list)
    use_relative_bounds: bool = Field(False, description="If true, reference bounds default to candidate min/max with warning")
    version: str = Field("1.0", description="Preference model schema version")


class MissionAlternativeInput(BaseModel):
    name: str = Field(..., min_length=1, max_length=120, description="Name of alternative (e.g. 'Site 01 - Window A')")
    description: Optional[str] = Field(None, description="Optional brief description")
    notes: Optional[str] = Field(None, description="User-authored engineering notes")
    scenario_id: str = Field(..., description="Candidate scenario identifier")
    window_search_id: Optional[str] = Field(None, description="Mission window search ID from MVP 7.3")
    window_id: Optional[str] = Field(None, description="Specific window ID from search (e.g. 'win-001')")
    terrain_assessment_id: Optional[str] = Field(None, description="Terrain assessment record ID from MVP 7.4")
    screening_run_id: Optional[str] = Field(None, description="Candidate screening run ID from MVP 7.2")


class MissionAlternativeRecord(BaseModel):
    id: str = Field(..., description="Unique alternative identifier (e.g. 'alt-01')")
    name: str
    description: Optional[str] = None
    notes: Optional[str] = None
    candidate_id: str
    candidate_name: str
    site_id: str
    latitude: float
    longitude: float
    start_timestamp_iso: str
    end_timestamp_iso: str
    duration_days: float
    duration_hours: float
    profile_id: str
    profile_version: int
    profile_snapshot: MissionProfile
    source_screening_id: Optional[str] = None
    source_window_id: Optional[str] = None
    source_terrain_assessment_id: Optional[str] = None
    hard_constraint_status: OverallCandidateStatus = Field(
        OverallCandidateStatus.INDETERMINATE,
        description="COMPLIANT (all pass), NON_COMPLIANT (any fail), or INDETERMINATE (incomplete/missing data, none failed)"
    )
    terrain_suitability_status: Optional[TerrainSuitabilityStatus] = None
    hard_constraints_passed: int = Field(0)
    hard_constraints_failed: int = Field(0)
    hard_constraints_indeterminate: int = Field(0)
    total_hard_constraints: int = Field(0)
    extracted_metrics: Dict[str, Optional[float]] = Field(default_factory=dict)
    hard_constraint_verdicts: List[RequirementEvaluationResult] = Field(default_factory=list)
    missing_metrics: List[str] = Field(default_factory=list)
    data_completeness_pct: float = Field(0.0)
    provenance: Dict[str, Any] = Field(default_factory=dict)
    warnings: List[str] = Field(default_factory=list)


class AlternativeNormalizedMetric(BaseModel):
    criterion_id: str
    criterion_name: str
    raw_value: Optional[float] = None
    unit: str
    direction: PreferenceDirection
    reference_min: float
    reference_max: float
    normalized_value: Optional[float] = None  # Scale 0.0 to 1.0
    normalized_weight: float                 # Sums to 1.0 across enabled criteria
    score_contribution: Optional[float] = None  # (normalized_weight * normalized_value * 100.0)
    formula_str: str
    is_available: bool = True
    note: Optional[str] = None


class AlternativeScoreBreakdown(BaseModel):
    alternative_id: str
    alternative_name: str
    composite_score: float = Field(0.0, description="Normalized score on 0 to 100 scale")
    score_status: str = Field("COMPLETE", description="'COMPLETE' (all enabled valid) or 'INCOMPLETE' (missing measurements)")
    available_weight_fraction: float = Field(1.0, description="Fraction of configured weight evaluated (1.0 = 100%)")
    ranking_eligibility: str = Field(
        "ELIGIBLE",
        description="'ELIGIBLE', 'INELIGIBLE_NON_COMPLIANT', 'INELIGIBLE_INDETERMINATE', or 'INELIGIBLE_INCOMPLETE_SCORE'",
    )
    eligible_rank: Optional[int] = Field(None, description="Rank among compliant, complete alternatives (1 = highest)")
    ineligibility_reason: Optional[str] = Field(None, description="Explanation why alternative is excluded from ranking")
    normalized_metrics: List[AlternativeNormalizedMetric] = Field(default_factory=list)
    explanation: str
    limitations: List[str] = Field(default_factory=list)


class AlternativeParetoResult(BaseModel):
    alternative_id: str
    status: ParetoDominanceStatus
    dominated_by: List[str] = Field(default_factory=list, description="IDs of alternatives that dominate this alternative")
    dominates: List[str] = Field(default_factory=list, description="IDs of alternatives dominated by this alternative")
    dominating_criteria_by_alternative: Dict[str, List[str]] = Field(
        default_factory=dict,
        description="Explains which criteria established dominance for each dominating alternative",
    )
    is_fully_comparable: bool = Field(True, description="Whether alternative has all active criteria measured")
    explanation: str


class SensitivityScenarioResult(BaseModel):
    scenario_id: str
    scenario_name: str
    scenario_description: str
    is_available: bool = Field(True, description="Whether scenario had required criteria enabled")
    warning: Optional[str] = None
    weights: Dict[str, float]
    scores: Dict[str, float]               # alternative_id -> composite score
    rankings: Dict[str, int]              # raw score order for reference
    eligible_rankings: Dict[str, Optional[int]] = Field(
        default_factory=dict,
        description="Official rank among eligible (compliant + complete) alternatives only",
    )
    ineligibility_reasons: Dict[str, str] = Field(default_factory=dict)
    leading_alternative_id: Optional[str] = Field(None, description="Leading eligible alternative ID (None if no eligible candidates)")
    leading_alternative_name: Optional[str] = Field(None, description="Leading eligible alternative name")


class SensitivityAnalysisResponse(BaseModel):
    study_id: str
    current_leader_id: Optional[str] = None
    has_eligible_leader: bool = Field(False, description="True if an eligible compliant complete leader exists")
    tested_scenarios: List[SensitivityScenarioResult]
    leader_stability: Dict[str, float] = Field(default_factory=dict, description="Percentage of scenarios where alternative ranked #1")
    robust_alternatives: List[str] = Field(default_factory=list, description="Alternatives that remain ranked top-2 in >= 60% of scenarios")
    summary_notes: List[str] = Field(default_factory=list)


class TradeOffStudyCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    description: Optional[str] = None
    profile_id: str = Field(..., description="Target mission profile ID for study")
    nominal_duration_days: float = Field(..., ge=0.04, le=90.0)
    alternatives: List[MissionAlternativeInput] = Field(..., min_length=2, max_length=10)
    custom_preferences: Optional[PreferenceModelConfig] = None


class TradeOffStudyUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    alternatives: Optional[List[MissionAlternativeInput]] = None
    preference_model: Optional[PreferenceModelConfig] = None


class TradeOffStudyRecord(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    created_at_iso: str
    updated_at_iso: str
    profile_id: str
    profile_name: str
    profile_version: int
    nominal_duration_days: float
    alternatives: List[MissionAlternativeRecord] = Field(default_factory=list)
    preference_model: PreferenceModelConfig
    scores: Dict[str, AlternativeScoreBreakdown] = Field(default_factory=dict)
    pareto_results: Dict[str, AlternativeParetoResult] = Field(default_factory=dict)
    sensitivity_summary: Optional[SensitivityAnalysisResponse] = None
    analysis_timestamp_iso: Optional[str] = None
    warnings: List[str] = Field(default_factory=list)
    scientific_disclaimers: List[str] = Field(default_factory=list)


class TradeOffStudyResponse(BaseModel):
    study: TradeOffStudyRecord
