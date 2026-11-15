from typing import List, Optional, Dict, Any
from enum import Enum
from pydantic import BaseModel, Field
from app.schemas.horizon import HorizonPoint, HorizonSummary

class VisibilityState(str, Enum):
    FULLY_VISIBLE = "FULLY_VISIBLE"
    PARTIALLY_VISIBLE = "PARTIALLY_VISIBLE"
    FULLY_OBSTRUCTED = "FULLY_OBSTRUCTED"
    INDETERMINATE = "INDETERMINATE"

class CoverageCertainty(str, Enum):
    CONFIRMED_EVALUATED = "CONFIRMED_EVALUATED"
    INDETERMINATE_PARTIAL_DEM = "INDETERMINATE_PARTIAL_DEM"

class CombinedVisibilityState(str, Enum):
    SUN_AND_EARTH_VISIBLE = "SUN_AND_EARTH_VISIBLE"
    SUN_VISIBLE_ONLY = "SUN_VISIBLE_ONLY"
    EARTH_VISIBLE_ONLY = "EARTH_VISIBLE_ONLY"
    NEITHER_VISIBLE = "NEITHER_VISIBLE"
    PARTIAL_DUAL_VISIBILITY = "PARTIAL_DUAL_VISIBILITY"
    INDETERMINATE = "INDETERMINATE"

class CelestialDiskVisibility(BaseModel):
    body_name: str
    azimuth_deg: float
    elevation_deg: float
    angular_diameter_deg: float
    angular_radius_deg: float
    distance_km: float
    horizon_elevation_at_azimuth_deg: float
    upper_limb_elevation_deg: float
    lower_limb_elevation_deg: float
    upper_limb_clearance_deg: float
    lower_limb_clearance_deg: float
    visible_fraction: float
    visible_percentage: float
    visibility_state: VisibilityState
    coverage_certainty: CoverageCertainty
    light_time_seconds: float
    calculation_method: str = "SLICED_SPHERICAL_DISK_INTEGRATION"

class VisibilityInstantRequest(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Observer lunar latitude in degrees")
    longitude: float = Field(..., ge=-180.0, le=360.0, description="Observer lunar longitude in degrees")
    timestamp_iso: str = Field(..., description="Observation epoch in ISO 8601 UTC format")
    observer_height_m: float = Field(2.0, ge=0.0, le=100.0, description="Observer height above terrain in meters")
    dataset_id: str = Field("site01", description="DEM dataset identifier")
    azimuth_resolution_deg: float = Field(1.0, ge=0.5, le=5.0, description="Azimuth resolution in degrees")
    max_search_distance_m: float = Field(15000.0, ge=500.0, le=100000.0, description="Radial search distance in meters")
    aberration_correction: str = Field("LT+S", description="Aberration correction ('NONE' or 'LT+S')")

class VisibilityInstantResponse(BaseModel):
    latitude: float
    longitude: float
    observer_surface_elevation_m: float
    observer_height_m: float
    total_observer_elevation_m: float
    timestamp_iso: str
    ephemeris_time_tdb: float
    sun: CelestialDiskVisibility
    earth: CelestialDiskVisibility
    combined_state: CombinedVisibilityState
    terrain_horizon_summary: HorizonSummary
    horizon_profile: List[HorizonPoint]
    warnings: List[str]
    provenance: Dict[str, Any]

class VisibilityTransitionPoint(BaseModel):
    transition_type: str  # e.g., "SUNRISE_START", "SUNRISE_END", "SUNSET_START", "SUNSET_END"
    timestamp_iso: str
    ephemeris_time_tdb: float
    azimuth_deg: float
    elevation_deg: float
    visible_fraction: float
    convergence_tolerance_seconds: float

class VisibilityTimeSeriesPoint(BaseModel):
    timestamp_iso: str
    ephemeris_time_tdb: float
    sun_azimuth_deg: float
    sun_elevation_deg: float
    sun_visible_fraction: float
    sun_visibility_state: VisibilityState
    earth_azimuth_deg: float
    earth_elevation_deg: float
    earth_visible_fraction: float
    earth_visibility_state: VisibilityState
    combined_state: CombinedVisibilityState
    terrain_elevation_sun_az_deg: float
    terrain_elevation_earth_az_deg: float

class SolarMetrics(BaseModel):
    total_sun_visible_hours: float
    total_sun_full_hours: float
    total_sun_partial_hours: float
    total_darkness_hours: float
    longest_darkness_hours: float
    longest_darkness_start_iso: Optional[str] = None
    longest_darkness_end_iso: Optional[str] = None
    longest_illumination_hours: float
    illumination_fraction: float
    sunlight_percentage: Optional[float] = None
    any_sunlight_percentage: float = 0.0
    full_sunlight_percentage: float = 0.0
    partial_sunlight_percentage: float = 0.0
    darkness_percentage: float = 0.0
    time_weighted_solar_disk_fraction: float = 0.0
    time_weighted_sunlight_percentage: float = 0.0
    indeterminate_hours: float = 0.0
    indeterminate_percentage: float = 0.0
    coverage_certainty: CoverageCertainty = CoverageCertainty.CONFIRMED_EVALUATED
    sunrise_count: int
    sunset_count: int
    max_sun_elevation_deg: float
    min_sun_elevation_deg: float

class EarthMetrics(BaseModel):
    total_earth_visible_hours: float
    total_earth_full_hours: float
    total_earth_partial_hours: float
    total_earth_blackout_hours: float
    longest_earth_blackout_hours: float
    longest_earth_blackout_start_iso: Optional[str] = None
    longest_earth_blackout_end_iso: Optional[str] = None
    longest_earth_visible_hours: float
    earth_visibility_fraction: float
    earth_visibility_percentage: Optional[float] = None
    any_earth_visible_percentage: float = 0.0
    full_earth_percentage: float = 0.0
    partial_earth_percentage: float = 0.0
    earth_blackout_percentage: float = 0.0
    time_weighted_earth_disk_fraction: float = 0.0
    time_weighted_earth_percentage: float = 0.0
    indeterminate_hours: float = 0.0
    indeterminate_percentage: float = 0.0
    coverage_certainty: CoverageCertainty = CoverageCertainty.CONFIRMED_EVALUATED
    earthrise_count: int
    earthset_count: int
    max_earth_elevation_deg: float
    min_earth_elevation_deg: float

class CombinedMetrics(BaseModel):
    both_visible_hours: float
    sun_only_hours: float
    earth_only_hours: float
    neither_visible_hours: float
    longest_both_visible_hours: float
    longest_neither_visible_hours: float
    total_interval_hours: float

class VisibilityAnalysisRequest(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Observer lunar latitude in degrees")
    longitude: float = Field(..., ge=-180.0, le=360.0, description="Observer lunar longitude in degrees")
    start_timestamp_iso: str = Field(..., description="Start epoch in ISO 8601 UTC format")
    end_timestamp_iso: str = Field(..., description="End epoch in ISO 8601 UTC format")
    step_interval_hours: float = Field(1.0, ge=0.1, le=24.0, description="Sampling interval in hours")
    observer_height_m: float = Field(2.0, ge=0.0, le=100.0, description="Observer instrument height above surface in meters")
    dataset_id: str = Field("site01", description="DEM dataset identifier")
    azimuth_resolution_deg: float = Field(1.0, ge=0.5, le=5.0, description="Azimuth resolution in degrees")
    max_search_distance_m: float = Field(15000.0, ge=500.0, le=100000.0, description="Radial search distance in meters")
    aberration_correction: str = Field("LT+S", description="Aberration correction ('NONE' or 'LT+S')")

class VisibilityAnalysisResponse(BaseModel):
    latitude: float
    longitude: float
    observer_surface_elevation_m: float
    observer_height_m: float
    start_timestamp_iso: str
    end_timestamp_iso: str
    step_interval_hours: float
    total_epochs_computed: int
    series: List[VisibilityTimeSeriesPoint]
    transitions: List[VisibilityTransitionPoint]
    solar_metrics: SolarMetrics
    earth_metrics: EarthMetrics
    combined_metrics: CombinedMetrics
    terrain_horizon_summary: HorizonSummary
    horizon_profile: List[HorizonPoint]
    warnings: List[str]
    provenance: Dict[str, Any]
