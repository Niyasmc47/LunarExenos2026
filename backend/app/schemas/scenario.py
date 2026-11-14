from typing import List, Dict, Any, Optional, Literal
from pydantic import BaseModel, Field
from app.schemas.visibility import (
    SolarMetrics,
    EarthMetrics,
    CombinedMetrics,
    VisibilityTimeSeriesPoint,
    VisibilityTransitionPoint,
)

class ScenarioRecord(BaseModel):
    id: str = Field(..., description="Unique scenario identifier")
    name: str = Field(..., description="Human-readable scenario name")
    description: str = Field("", description="Detailed mission description and landing context")
    site_id: str = Field(..., description="Candidate site identifier (must match an available DEM dataset)")
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Observer lunar latitude in degrees (-90 to +90)")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Observer lunar longitude in degrees (-180 to +180)")
    observer_height_m: float = Field(2.0, ge=0.0, le=100.0, description="Observer eye/antenna height above local terrain in meters")
    start_timestamp_iso: str = Field(..., description="Mission analysis start epoch (ISO 8601 UTC)")
    end_timestamp_iso: str = Field(..., description="Mission analysis end epoch (ISO 8601 UTC)")
    step_interval_hours: float = Field(2.0, ge=0.1, le=24.0, description="Time sampling interval in hours")
    azimuth_resolution_deg: float = Field(2.0, ge=0.5, le=10.0, description="Horizon skyline azimuth step in degrees")
    max_search_distance_m: float = Field(5000.0, ge=500.0, le=50000.0, description="Horizon raycast max search distance in meters")
    aberration_correction: str = Field("LT+S", description="SPICE stellar and light-time aberration correction")
    created_at_iso: str = Field(..., description="Creation timestamp")
    updated_at_iso: str = Field(..., description="Last update timestamp")

class ScenarioCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    description: Optional[str] = Field("", max_length=500)
    site_id: str = Field("site01", description="Dataset identifier, e.g. site01")
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    observer_height_m: float = Field(2.0, ge=0.0, le=100.0)
    start_timestamp_iso: str = Field("2026-10-04T12:00:00Z")
    end_timestamp_iso: str = Field("2026-10-07T12:00:00Z")
    step_interval_hours: float = Field(2.0, ge=0.1, le=24.0)
    azimuth_resolution_deg: float = Field(2.0, ge=0.5, le=10.0)
    max_search_distance_m: float = Field(5000.0, ge=500.0, le=50000.0)
    aberration_correction: str = Field("LT+S")

class ScenarioUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=120)
    description: Optional[str] = Field(None, max_length=500)
    site_id: Optional[str] = None
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)
    observer_height_m: Optional[float] = Field(None, ge=0.0, le=100.0)
    start_timestamp_iso: Optional[str] = None
    end_timestamp_iso: Optional[str] = None
    step_interval_hours: Optional[float] = Field(None, ge=0.1, le=24.0)
    azimuth_resolution_deg: Optional[float] = Field(None, ge=0.5, le=10.0)
    max_search_distance_m: Optional[float] = Field(None, ge=500.0, le=50000.0)
    aberration_correction: Optional[str] = None

class MissionConstraints(BaseModel):
    min_sunlight_hours: Optional[float] = Field(None, ge=0.0, description="Minimum required total geometric sunlight hours")
    min_sunlight_pct: Optional[float] = Field(None, ge=0.0, le=100.0, description="Minimum required percentage of mission time with sunlight")
    max_darkness_hours: Optional[float] = Field(None, ge=0.0, description="Maximum allowable continuous darkness period in hours")
    min_earth_visible_hours: Optional[float] = Field(None, ge=0.0, description="Minimum required total geometric Earth visibility hours")
    min_earth_visible_pct: Optional[float] = Field(None, ge=0.0, le=100.0, description="Minimum required percentage of mission time with Earth line-of-sight")
    max_earth_blackout_hours: Optional[float] = Field(None, ge=0.0, description="Maximum allowable continuous Earth blackout period in hours")
    max_allowable_slope_deg: Optional[float] = Field(None, ge=0.0, le=90.0, description="Maximum allowable landing site slope in degrees")

class ConstraintResult(BaseModel):
    constraint_id: str
    constraint_name: str
    required_criterion: str
    actual_value_str: str
    status: Literal["PASSED", "FAILED", "INDETERMINATE"]
    explanation: str

class ScenarioTerrainMetrics(BaseModel):
    observer_surface_elevation_m: float
    observer_height_m: float
    total_observer_elevation_m: float
    local_slope_deg: Optional[float] = None
    elevation_min_m: float
    elevation_max_m: float
    elevation_mean_m: float
    dem_coverage_status: str
    dem_nominal_spacing_m: float
    effective_resolution_note: str
    lola_laser_count: Optional[int] = None
    vertical_uncertainty_m: Optional[float] = None
    slope_uncertainty_deg: Optional[float] = None
    dataset_citation: str

class ScenarioComparisonResult(BaseModel):
    scenario: ScenarioRecord
    terrain: ScenarioTerrainMetrics
    solar: SolarMetrics
    earth: EarthMetrics
    combined: CombinedMetrics
    timeline: List[VisibilityTimeSeriesPoint]
    transitions: List[VisibilityTransitionPoint]
    constraints: List[ConstraintResult]
    passed_constraints_count: int
    failed_constraints_count: int
    indeterminate_constraints_count: int
    warnings: List[str]
    configuration_differences: List[str]

class MultiScenarioComparisonRequest(BaseModel):
    scenario_ids: List[str] = Field(..., min_length=2, max_length=4, description="List of 2 to 4 scenario IDs to compare")
    enforce_harmonized_time: bool = Field(True, description="Enforce identical start epoch and duration across all compared scenarios for a scientifically fair comparison")
    override_start_iso: Optional[str] = Field(None, description="Optional override start timestamp for all compared scenarios")
    override_duration_days: Optional[float] = Field(None, ge=0.5, le=30.0, description="Optional override duration in days")
    override_step_hours: Optional[float] = Field(None, ge=0.1, le=24.0, description="Optional override step interval in hours")
    constraints: Optional[MissionConstraints] = Field(default_factory=MissionConstraints)

class ScenarioRankingItem(BaseModel):
    rank: int
    scenario_id: str
    scenario_name: str
    passed_count: int
    total_count: int
    compliance_score_pct: float
    dominant_tradeoff: str

class MultiScenarioComparisonResponse(BaseModel):
    comparison_id: str
    timestamp_iso: str
    is_harmonized: bool
    harmonization_notes: List[str]
    scenarios: List[ScenarioComparisonResult]
    ranking_summary: List[ScenarioRankingItem]
    scientific_caveats: List[str]
    provenance: Dict[str, Any]

class ScenarioExportRequest(BaseModel):
    comparison_response: MultiScenarioComparisonResponse
    format: Literal["json", "csv"] = "json"
