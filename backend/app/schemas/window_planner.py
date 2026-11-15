from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

from app.schemas.mission_profile import MissionProfile
from app.schemas.screening import (
    ScreeningVerdict,
    OverallCandidateStatus,
    DataCoverageStatus,
    RequirementEvaluationResult,
    SoftPreferenceItem,
    InformationalMetricItem,
)

class WindowClassification(str, Enum):
    COMPLIANT = "COMPLIANT"          # All active hard constraints passed
    NON_COMPLIANT = "NON_COMPLIANT"  # One or more active hard constraints failed
    INDETERMINATE = "INDETERMINATE"  # Incomplete data or indeterminate metrics with zero hard failures

class WindowSolarSummary(BaseModel):
    total_sunlight_hours: float
    full_sunlight_hours: float
    partial_sunlight_hours: float
    darkness_hours: float
    longest_darkness_hours: float
    illumination_percentage: float
    min_daily_sunlight_hours: float
    sunrise_transitions: int
    sunset_transitions: int
    time_weighted_sunlight_percentage: Optional[float] = None
    any_sunlight_percentage: Optional[float] = None
    full_sunlight_percentage: Optional[float] = None
    partial_sunlight_percentage: Optional[float] = None
    darkness_percentage: Optional[float] = None

class WindowEarthSummary(BaseModel):
    total_earth_visible_hours: float
    full_disk_earth_visible_hours: float
    partial_earth_visible_hours: float
    earth_blackout_hours: float
    longest_earth_blackout_hours: float
    earth_visibility_percentage: float
    min_daily_earth_visible_hours: float
    earthrise_transitions: int
    earthset_transitions: int
    time_weighted_earth_percentage: Optional[float] = None
    any_earth_percentage: Optional[float] = None
    full_earth_percentage: Optional[float] = None
    partial_earth_percentage: Optional[float] = None
    blackout_percentage: Optional[float] = None

class EvaluatedMissionWindow(BaseModel):
    window_id: str = Field(..., description="Unique window identifier (e.g. 'win-001')")
    window_index: int = Field(..., description="Chronological index of window")
    start_timestamp_iso: str = Field(..., description="Mission start epoch (UTC)")
    end_timestamp_iso: str = Field(..., description="Mission end epoch (UTC)")
    duration_days: float = Field(..., description="Mission duration in Earth days")
    duration_hours: float = Field(..., description="Mission duration in hours")
    classification: WindowClassification = Field(..., description="COMPLIANT, NON_COMPLIANT, or INDETERMINATE")
    hard_constraints_passed: int = Field(0)
    hard_constraints_failed: int = Field(0)
    hard_constraints_indeterminate: int = Field(0)
    total_hard_constraints: int = Field(0)
    solar_summary: WindowSolarSummary
    earth_summary: WindowEarthSummary
    surface_elevation_m: Optional[float] = None
    local_slope_deg: Optional[float] = None
    hard_constraint_results: List[RequirementEvaluationResult] = Field(default_factory=list)
    soft_preference_results: List[SoftPreferenceItem] = Field(default_factory=list)
    informational_metrics: List[InformationalMetricItem] = Field(default_factory=list)
    coverage_status: DataCoverageStatus = Field(DataCoverageStatus.COMPLETE)
    coverage_certainty: str = Field("COMPLETE_DEM")
    warnings: List[str] = Field(default_factory=list)

class MissionWindowSearchRequest(BaseModel):
    profile_id: str = Field(..., description="Mission profile identifier")
    scenario_id: str = Field(..., description="Candidate scenario identifier")
    search_start_iso: str = Field(..., description="Search window start epoch (UTC ISO 8601)")
    search_end_iso: str = Field(..., description="Search window end epoch (UTC ISO 8601)")
    mission_duration_days: float = Field(..., ge=0.04, le=90.0, description="Mission duration in Earth days")
    search_step_hours: float = Field(12.0, ge=1.0, le=168.0, description="Search resolution: candidate start time step interval in hours")
    analysis_step_hours: float = Field(2.0, ge=0.5, le=24.0, description="Scientific sampling interval: visibility time step in hours")
    override_observer_height_m: Optional[float] = Field(None, ge=0.0, le=100.0, description="Optional override for observer height")
    azimuth_resolution_deg: Optional[float] = Field(2.0, ge=0.5, le=5.0, description="Horizon ray resolution in degrees")
    max_search_distance_m: Optional[float] = Field(5000.0, ge=500.0, le=100000.0, description="Horizon search radius in meters")
    name: Optional[str] = Field(None, description="Optional custom name for this search")

class WindowComparisonItem(BaseModel):
    window_id: str
    start_timestamp_iso: str
    end_timestamp_iso: str
    classification: WindowClassification
    total_sunlight_hours: float
    full_sunlight_hours: float
    longest_darkness_hours: float
    illumination_percentage: float
    total_earth_visible_hours: float
    longest_earth_blackout_hours: float
    hard_constraints_passed: int
    hard_constraints_failed: int
    hard_constraints_indeterminate: int
    differences_from_reference: List[str] = Field(default_factory=list)

class WindowComparisonResponse(BaseModel):
    search_id: str
    reference_window_id: str
    compared_windows: List[WindowComparisonItem]
    is_fully_consistent: bool
    consistency_notes: List[str] = Field(default_factory=list)

class MissionWindowSearchRecord(BaseModel):
    id: str = Field(..., description="Unique search execution identifier")
    name: str = Field(..., description="Human-readable search title")
    created_at_iso: str = Field(..., description="Search run timestamp (UTC)")
    profile_id: str = Field(..., description="Evaluated mission profile ID")
    profile_name: str = Field(..., description="Evaluated mission profile name")
    profile_version: int = Field(..., description="Profile version number")
    profile_snapshot: MissionProfile = Field(..., description="Frozen profile configuration snapshot")
    scenario_id: str = Field(..., description="Target candidate scenario ID")
    scenario_name: str = Field(..., description="Target candidate scenario name")
    site_id: str = Field(..., description="DEM dataset identifier")
    latitude: float = Field(..., description="Observer latitude in degrees")
    longitude: float = Field(..., description="Observer longitude in degrees")
    observer_height_m: float = Field(..., description="Observer instrument height above surface (meters)")
    search_start_iso: str = Field(..., description="Search boundary start (UTC)")
    search_end_iso: str = Field(..., description="Search boundary end (UTC)")
    search_span_days: float = Field(..., description="Total search span in days")
    mission_duration_days: float = Field(..., description="Evaluated mission duration in days")
    mission_duration_hours: float = Field(..., description="Evaluated mission duration in hours")
    search_step_hours: float = Field(..., description="Candidate start step interval in hours")
    analysis_step_hours: float = Field(..., description="Scientific sampling step interval in hours")
    total_windows_evaluated: int = Field(0)
    compliant_windows_count: int = Field(0)
    non_compliant_windows_count: int = Field(0)
    indeterminate_windows_count: int = Field(0)
    windows: List[EvaluatedMissionWindow] = Field(default_factory=list)
    dem_provenance: Dict[str, Any] = Field(default_factory=dict)
    spice_provenance: Dict[str, Any] = Field(default_factory=dict)
    scientific_disclaimers: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)

class MissionWindowSearchResponse(BaseModel):
    search: MissionWindowSearchRecord
