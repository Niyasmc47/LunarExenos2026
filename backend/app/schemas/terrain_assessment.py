from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

from app.schemas.mission_profile import (
    MissionProfile,
    RequirementClassification,
    SingleRequirement,
)
from app.schemas.scenario import ScenarioRecord
from app.schemas.screening import (
    ScreeningVerdict,
    DataCoverageStatus,
)

class TerrainSuitabilityStatus(str, Enum):
    COMPLIANT = "COMPLIANT"          # All active hard constraints passed
    NON_COMPLIANT = "NON_COMPLIANT"  # One or more active hard constraints failed
    INDETERMINATE = "INDETERMINATE"  # Incomplete data or indeterminate metrics with zero hard failures

class ElevationAssessmentMetrics(BaseModel):
    point_elevation_m: Optional[float] = Field(None, description="Surface elevation at candidate center coordinate")
    min_elevation_m: Optional[float] = Field(None, description="Minimum elevation within evaluated footprint")
    max_elevation_m: Optional[float] = Field(None, description="Maximum elevation within evaluated footprint")
    elevation_range_m: Optional[float] = Field(None, description="Elevation range (max - min) within evaluated footprint")
    mean_elevation_m: Optional[float] = Field(None, description="Mean elevation within evaluated footprint")
    std_elevation_m: Optional[float] = Field(None, description="Elevation standard deviation within evaluated footprint")
    elevation_datum: str = Field("IAU Moon 2000 Reference Sphere (R = 1,737,400.0 m)")
    elevation_units: str = Field("meters")
    datum_note: str = Field("Elevation is measured relative to the lunar reference sphere (1737.4 km), not spacecraft altitude above ground.")

class SlopeAssessmentMetrics(BaseModel):
    point_slope_deg: Optional[float] = Field(None, description="Local slope at candidate center coordinate")
    min_slope_deg: Optional[float] = Field(None, description="Minimum slope within evaluated footprint")
    max_slope_deg: Optional[float] = Field(None, description="Maximum slope within evaluated footprint")
    mean_slope_deg: Optional[float] = Field(None, description="Mean slope within evaluated footprint")
    median_slope_deg: Optional[float] = Field(None, description="Median slope within evaluated footprint")
    std_slope_deg: Optional[float] = Field(None, description="Slope standard deviation within evaluated footprint")
    slope_source: str = Field("NASA LOLA 5 m/pixel co-registered slope product (Site01_final_adj_5mpp_slp.tif)")
    slope_distribution: Dict[str, float] = Field(default_factory=dict, description="Percentage of footprint area across 7 standard lunar slope hazard bins")
    exceedance_percentage: Optional[float] = Field(None, description="Percentage of valid footprint area exceeding the configured maximum slope threshold")
    slope_units: str = Field("degrees")

class RoughnessAssessmentMetrics(BaseModel):
    status: str = Field("UNSUPPORTED", description="Roughness assessment availability status")
    is_supported: bool = Field(False, description="Whether an official roughness dataset was available and evaluated")
    scientific_justification: str = Field(
        "Official LOLA terrain roughness product is not loaded in the repository data directory. "
        "In accordance with lunar landing site evaluation guidelines, slope or elevation variance "
        "cannot be substituted for micro-relief roughness or boulder hazard detection. "
        "Requirement is classified as INDETERMINATE."
    )
    measured_value: Optional[float] = Field(None)
    unit: str = Field("deg_std")
    derived_slope_std_deg: Optional[float] = Field(
        None,
        description="Experimental DEM-derived local slope standard deviation within footprint. Strictly distinct from official NASA roughness products."
    )

class FootprintDataQuality(BaseModel):
    coverage_status: DataCoverageStatus = Field(DataCoverageStatus.COMPLETE)
    coverage_certainty: str = Field("COMPLETE_100PCT", description="'COMPLETE_100PCT', 'PARTIAL_INDETERMINATE', or 'UNAVAILABLE'")
    assessment_mode: str = Field("CIRCULAR_FOOTPRINT", description="'POINT' for radius 0.0 or 'CIRCULAR_FOOTPRINT' for radius > 0.0")
    requested_radius_m: float = Field(..., description="Requested assessment radius in meters (0.0 = point assessment)")
    nominal_grid_spacing_m: float = Field(5.0, description="Nominal raster grid spacing in meters")
    effective_resolution_note: str = Field(
        "Nominal 5 m/pixel grid spacing. Effective spatial resolution varies with LOLA orbital track density; "
        "pixels between laser ground tracks are interpolated. Nominal grid spacing does not guarantee 5 m effective measurement resolution."
    )
    total_pixels_in_footprint: int = Field(0)
    valid_pixels_in_footprint: int = Field(0)
    nodata_pixels_in_footprint: int = Field(0)
    valid_data_percentage: float = Field(0.0)
    evaluated_area_m2: float = Field(0.0)
    coverage_warnings: List[str] = Field(default_factory=list)

class EvaluatedTerrainRequirement(BaseModel):
    requirement_id: str
    requirement_name: str
    classification: RequirementClassification
    operator: str
    threshold_value: Optional[float] = None
    threshold_str: str
    actual_value: Optional[float] = None
    actual_value_str: str
    unit: str
    verdict: ScreeningVerdict
    explanation: str
    supporting_data_source: str

class CandidateTerrainAssessment(BaseModel):
    candidate_id: str
    candidate_name: str
    site_id: str
    latitude: float
    longitude: float
    projected_x: Optional[float] = None
    projected_y: Optional[float] = None
    overall_status: TerrainSuitabilityStatus
    hard_constraints_passed: int = Field(0)
    hard_constraints_failed: int = Field(0)
    hard_constraints_indeterminate: int = Field(0)
    total_hard_constraints: int = Field(0)
    elevation_metrics: ElevationAssessmentMetrics
    slope_metrics: SlopeAssessmentMetrics
    roughness_metrics: RoughnessAssessmentMetrics
    data_quality: FootprintDataQuality
    hard_constraint_results: List[EvaluatedTerrainRequirement] = Field(default_factory=list)
    soft_preference_results: List[EvaluatedTerrainRequirement] = Field(default_factory=list)
    informational_metrics: List[EvaluatedTerrainRequirement] = Field(default_factory=list)
    scientific_disclaimers: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)

class TerrainAssessmentRequest(BaseModel):
    profile_id: str = Field(..., description="Target mission profile identifier")
    scenario_ids: List[str] = Field(..., min_length=1, max_length=20, description="List of candidate scenario identifiers")
    assessment_radius_m: float = Field(
        50.0,
        ge=0.0,
        le=1000.0,
        description="Landing or operational assessment footprint radius in meters (0.0 = point assessment). Default 50 m corresponds to standard lunar lander hazard footprint."
    )
    override_dataset_id: Optional[str] = Field(None, description="Optional override for DEM dataset")
    name: Optional[str] = Field(None, description="Optional custom name for assessment run")

class TerrainAssessmentRecord(BaseModel):
    id: str = Field(..., description="Unique assessment execution identifier")
    name: str = Field(..., description="Human-readable assessment title")
    created_at_iso: str = Field(..., description="Execution timestamp (UTC)")
    profile_id: str
    profile_name: str
    profile_version: int
    profile_snapshot: MissionProfile = Field(..., description="Frozen profile configuration snapshot")
    scenario_snapshots: List[ScenarioRecord] = Field(..., description="Frozen candidate scenario snapshots")
    assessment_radius_m: float
    dataset_metadata: Dict[str, Any] = Field(default_factory=dict)
    calculation_method: str = Field("LUNAVISTA Terrain Suitability Engine v1.0 (NASA LOLA 5m/px)")
    total_candidates_evaluated: int = Field(0)
    compliant_candidates_count: int = Field(0)
    non_compliant_candidates_count: int = Field(0)
    indeterminate_candidates_count: int = Field(0)
    candidates: List[CandidateTerrainAssessment] = Field(default_factory=list)
    scientific_disclaimers: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)

class TerrainAssessmentResponse(BaseModel):
    assessment: TerrainAssessmentRecord
