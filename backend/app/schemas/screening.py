from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

from app.schemas.mission_profile import (
    MissionProfile,
    RequirementClassification,
)

class ScreeningVerdict(str, Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    INDETERMINATE = "INDETERMINATE"

class OverallCandidateStatus(str, Enum):
    COMPLIANT = "COMPLIANT"          # All active hard constraints passed
    NON_COMPLIANT = "NON_COMPLIANT"  # One or more active hard constraints failed
    INDETERMINATE = "INDETERMINATE"  # One or more active hard constraints indeterminate, none failed

class DataCoverageStatus(str, Enum):
    COMPLETE = "COMPLETE"
    PARTIAL = "PARTIAL"
    UNAVAILABLE = "UNAVAILABLE"
    INCOMPATIBLE = "INCOMPATIBLE"

class RequirementEvaluationResult(BaseModel):
    requirement_id: str = Field(..., description="Unique key of requirement")
    requirement_name: str = Field(..., description="Human-readable requirement label")
    category: str = Field(..., description="'solar', 'earth', or 'terrain'")
    classification: RequirementClassification = Field(..., description="Classification tier")
    operator: str = Field(..., description="Comparison operator: 'ge', 'le', 'gt', 'lt', 'eq'")
    threshold_value: Optional[float] = Field(None, description="Required numerical threshold")
    threshold_str: str = Field(..., description="Formatted criterion (e.g. '>= 120.0 h')")
    actual_value: Optional[float] = Field(None, description="Actual measured numerical value")
    actual_value_str: str = Field(..., description="Formatted measured value (e.g. '145.2 h', 'N/A')")
    unit: str = Field(..., description="Physical engineering unit")
    verdict: ScreeningVerdict = Field(..., description="Screening verdict: PASS, FAIL, or INDETERMINATE")
    explanation: str = Field(..., description="Scientific explanation of the evaluation result")
    supporting_data_source: str = Field(..., description="Source engine or dataset provenance")
    analysis_period: str = Field(..., description="Evaluation time window")

class SoftPreferenceItem(BaseModel):
    requirement_id: str
    requirement_name: str
    category: str
    operator: str
    threshold_value: Optional[float] = None
    threshold_str: str
    actual_value: Optional[float] = None
    actual_value_str: str
    unit: str
    is_available: bool = True
    notes: str

class InformationalMetricItem(BaseModel):
    id: str
    name: str
    category: str
    value: Any
    value_str: str
    unit: Optional[str] = None
    source: str

class CandidateScreeningSummary(BaseModel):
    candidate_id: str = Field(..., description="Scenario or candidate identifier")
    candidate_name: str = Field(..., description="Candidate landing site / scenario name")
    site_id: str = Field(..., description="DEM dataset identifier")
    latitude: float = Field(..., description="Lunar latitude in degrees")
    longitude: float = Field(..., description="Lunar longitude in degrees")
    observer_height_m: float = Field(..., description="Observer height above surface in meters")
    surface_elevation_m: Optional[float] = Field(None, description="Surface elevation in meters")
    local_slope_deg: Optional[float] = Field(None, description="Local slope in degrees")
    overall_status: OverallCandidateStatus = Field(..., description="COMPLIANT, NON_COMPLIANT, or INDETERMINATE")
    hard_constraints_passed: int = Field(0)
    hard_constraints_failed: int = Field(0)
    hard_constraints_indeterminate: int = Field(0)
    total_hard_constraints: int = Field(0)
    hard_constraint_results: List[RequirementEvaluationResult] = Field(default_factory=list)
    soft_preference_results: List[SoftPreferenceItem] = Field(default_factory=list)
    informational_metrics: List[InformationalMetricItem] = Field(default_factory=list)
    coverage_status: DataCoverageStatus = Field(DataCoverageStatus.COMPLETE)
    coverage_certainty: str = Field("COMPLETE_DEM")
    valid_ray_count: int = Field(0)
    total_ray_count: int = Field(0)
    dem_provenance: Dict[str, Any] = Field(default_factory=dict)
    spice_provenance: Dict[str, Any] = Field(default_factory=dict)
    warnings: List[str] = Field(default_factory=list)
    scientific_disclaimers: List[str] = Field(default_factory=list)

class ScreeningRunRecord(BaseModel):
    id: str = Field(..., description="Unique screening run identifier")
    name: str = Field(..., description="Human-readable title of screening run")
    created_at_iso: str = Field(..., description="Timestamp of screening execution (UTC)")
    profile_id: str = Field(..., description="Mission profile identifier")
    profile_name: str = Field(..., description="Mission profile name")
    profile_version: int = Field(..., description="Mission profile version evaluated")
    profile_snapshot: MissionProfile = Field(..., description="Complete snapshot of profile configuration")
    start_timestamp_iso: str = Field(..., description="Screening analysis start epoch (UTC)")
    end_timestamp_iso: str = Field(..., description="Screening analysis end epoch (UTC)")
    duration_days: float = Field(..., description="Screening duration in days")
    observer_height_m: float = Field(..., description="Observer height used in screening")
    calculation_config: Dict[str, Any] = Field(default_factory=dict)
    candidates: List[CandidateScreeningSummary] = Field(default_factory=list)
    overall_summary: Dict[str, Any] = Field(default_factory=dict)

class CandidateScreeningRequest(BaseModel):
    profile_id: str = Field(..., description="ID of mission profile to evaluate against")
    scenario_ids: List[str] = Field(..., min_length=1, max_length=10, description="List of scenario IDs to screen")
    override_start_iso: Optional[str] = Field(None, description="Optional override for analysis start epoch (UTC)")
    override_end_iso: Optional[str] = Field(None, description="Optional override for analysis end epoch (UTC)")
    override_duration_days: Optional[float] = Field(None, ge=0.04, le=90.0, description="Optional override for duration in days")
    override_observer_height_m: Optional[float] = Field(None, ge=0.0, le=100.0, description="Optional override for observer height")
    step_interval_hours: Optional[float] = Field(2.0, ge=0.1, le=24.0, description="Ephemeris & visibility sampling step")
    azimuth_resolution_deg: Optional[float] = Field(2.0, ge=0.5, le=5.0, description="Horizon ray azimuth resolution")
    max_search_distance_m: Optional[float] = Field(5000.0, ge=500.0, le=100000.0, description="Horizon ray search distance")
    aberration_correction: Optional[str] = Field("LT+S", description="'LT+S' or 'NONE'")
    name: Optional[str] = Field(None, description="Optional custom name for this screening run")

class CandidateScreeningResponse(BaseModel):
    run: ScreeningRunRecord
