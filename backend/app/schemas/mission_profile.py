from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class RequirementClassification(str, Enum):
    HARD_CONSTRAINT = "HARD_CONSTRAINT"      # Mandatory criteria: must be satisfied for mission viability
    SOFT_PREFERENCE = "SOFT_PREFERENCE"      # Trade-off criteria: stored and validated; no hidden scoring or unweighted heuristics applied
    INFORMATIONAL = "INFORMATIONAL_METRIC"   # Contextual metrics: displayed without pass/fail verdict

class MissionType(str, Enum):
    ROBOTIC_EXPLORATION = "robotic_exploration"
    ROBOTIC_LANDER = "robotic_lander"
    CREWED_SURFACE = "crewed_surface"
    LONG_DURATION_STATION = "long_duration_station"
    CUSTOM = "custom"

class TimeDisplayPreference(str, Enum):
    UTC = "UTC"
    MISSION_ELAPSED_TIME = "MISSION_ELAPSED_TIME"
    LOCAL_LUNAR_TIME = "LOCAL_LUNAR_TIME"

class SingleRequirement(BaseModel):
    id: str = Field(..., description="Unique key of the requirement")
    name: str = Field(..., description="Human-readable requirement label")
    classification: RequirementClassification = Field(
        RequirementClassification.HARD_CONSTRAINT,
        description="Requirement enforcement level: HARD_CONSTRAINT, SOFT_PREFERENCE, or INFORMATIONAL_METRIC"
    )
    enabled: bool = Field(True, description="Whether this requirement is actively evaluated")
    value: Optional[float] = Field(None, description="Numerical threshold limit")
    unit: str = Field(..., description="Physical engineering unit (e.g., 'hours', '%', 'deg', 'm', 'hours/day', 'deg_std')")
    operator: str = Field("ge", description="Comparison operator: 'ge' (>=), 'le' (<=), 'eq' (==), 'info'")
    description: str = Field("", description="Clear rationale and scientific meaning of this requirement")
    scientific_disclaimer: Optional[str] = Field(
        None,
        description="Mandatory scientific caveat regarding physical meaning vs operational capability"
    )

class SolarRequirementsConfig(BaseModel):
    min_total_sunlight_hours: SingleRequirement = Field(
        default_factory=lambda: SingleRequirement(
            id="min_total_sunlight_hours",
            name="Minimum Total Geometric Sunlight Duration",
            classification=RequirementClassification.HARD_CONSTRAINT,
            enabled=True,
            value=72.0,
            unit="hours",
            operator="ge",
            description="Minimum cumulative duration of geometric illumination across the user-configured mission analysis window.",
            scientific_disclaimer="Geometric illumination accounts for terrain line-of-sight and finite-disk clearance; it does not model photovoltaic panel angle of incidence or electrical power generation."
        )
    )
    min_full_sunlight_hours: SingleRequirement = Field(
        default_factory=lambda: SingleRequirement(
            id="min_full_sunlight_hours",
            name="Minimum Full Sunlight Duration",
            classification=RequirementClassification.SOFT_PREFERENCE,
            enabled=False,
            value=48.0,
            unit="hours",
            operator="ge",
            description="Minimum cumulative duration where the solar disk is 100% unoccluded by terrain. Full sunlight is a geometric subset of total sunlight.",
            scientific_disclaimer="Requires 100% solar disk clearance above local horizon."
        )
    )
    max_continuous_darkness_hours: SingleRequirement = Field(
        default_factory=lambda: SingleRequirement(
            id="max_continuous_darkness_hours",
            name="Maximum Continuous Darkness Duration",
            classification=RequirementClassification.HARD_CONSTRAINT,
            enabled=True,
            value=24.0,
            unit="hours",
            operator="le",
            description="Maximum uninterrupted duration of darkness (battery energy storage limit).",
            scientific_disclaimer="Evaluates uninterrupted periods where solar disk visible fraction is zero."
        )
    )
    min_sunlight_percentage: SingleRequirement = Field(
        default_factory=lambda: SingleRequirement(
            id="min_sunlight_percentage",
            name="Minimum Sunlight Percentage",
            classification=RequirementClassification.SOFT_PREFERENCE,
            enabled=True,
            value=60.0,
            unit="%",
            operator="ge",
            description="Ratio of total illuminated hours to total mission duration (expressed in %).",
            scientific_disclaimer="Denominator is the total user-configured mission duration."
        )
    )
    min_daily_sunlight_hours: SingleRequirement = Field(
        default_factory=lambda: SingleRequirement(
            id="min_daily_sunlight_hours",
            name="Minimum Daily Sunlight Duration",
            classification=RequirementClassification.SOFT_PREFERENCE,
            enabled=False,
            value=6.0,
            unit="hours/day",
            operator="ge",
            description="Minimum geometric illumination required per standard 24.0-hour Earth day interval (distinct from the ~708.7 h lunar synodic day). Evaluates cumulative hours with solar disk clearance f_disk > 0 in each standard 24h operational window.",
            scientific_disclaimer="Applies per standard 24.0-hour Earth operational day. Partial illumination (f_disk > 0) contributes to geometric duration; does not evaluate solar incident cosine angle or battery charge efficiency."
        )
    )

class EarthRequirementsConfig(BaseModel):
    min_total_earth_visible_hours: SingleRequirement = Field(
        default_factory=lambda: SingleRequirement(
            id="min_total_earth_visible_hours",
            name="Minimum Total Geometric Earth Visibility",
            classification=RequirementClassification.HARD_CONSTRAINT,
            enabled=True,
            value=48.0,
            unit="hours",
            operator="ge",
            description="Minimum cumulative duration of direct geometric line-of-sight to Earth across the mission analysis window.",
            scientific_disclaimer="Geometric Earth visibility does not guarantee an operational radio link; RF link budget, antenna pointing, and data rates are not modeled."
        )
    )
    max_continuous_earth_blackout_hours: SingleRequirement = Field(
        default_factory=lambda: SingleRequirement(
            id="max_continuous_earth_blackout_hours",
            name="Maximum Continuous Earth LOS Blackout",
            classification=RequirementClassification.HARD_CONSTRAINT,
            enabled=True,
            value=12.0,
            unit="hours",
            operator="le",
            description="Maximum allowable duration of continuous Direct-to-Earth loss of signal (LOS).",
            scientific_disclaimer="Periods where Earth disk is completely obstructed by local terrain."
        )
    )
    min_daily_earth_visible_hours: SingleRequirement = Field(
        default_factory=lambda: SingleRequirement(
            id="min_daily_earth_visible_hours",
            name="Minimum Daily Earth Visibility",
            classification=RequirementClassification.SOFT_PREFERENCE,
            enabled=False,
            value=4.0,
            unit="hours/day",
            operator="ge",
            description="Minimum Direct-to-Earth line-of-sight required per standard 24.0-hour Earth day interval (distinct from the ~708.7 h lunar synodic day). Evaluates cumulative visible contact hours in each standard 24h operational window.",
            scientific_disclaimer="Applies per standard 24.0-hour Earth day. Line-of-sight clearance does not evaluate RF link budget or ground station scheduling."
        )
    )
    min_full_disk_earth_visible_hours: SingleRequirement = Field(
        default_factory=lambda: SingleRequirement(
            id="min_full_disk_earth_visible_hours",
            name="Minimum Full-Disk Earth Visibility",
            classification=RequirementClassification.INFORMATIONAL,
            enabled=False,
            value=24.0,
            unit="hours",
            operator="ge",
            description="Cumulative duration where the entire Earth disk is completely unoccluded by terrain. Full-disk visibility is a geometric subset of total visibility.",
            scientific_disclaimer="Full-disk clearance without partial atmospheric limb clipping."
        )
    )

class TerrainRequirementsConfig(BaseModel):
    max_local_slope_deg: SingleRequirement = Field(
        default_factory=lambda: SingleRequirement(
            id="max_local_slope_deg",
            name="Maximum Allowable Landing Site Slope",
            classification=RequirementClassification.HARD_CONSTRAINT,
            enabled=True,
            value=10.0,
            unit="deg",
            operator="le",
            description="Maximum local slope at the landing/observation site (lander tip-over safety threshold).",
            scientific_disclaimer="Derived from NASA LOLA 5 m DEM slope maps. Geomorphic slope alone does not guarantee boulder clearance or regolith trafficability."
        )
    )
    min_elevation_m: SingleRequirement = Field(
        default_factory=lambda: SingleRequirement(
            id="min_elevation_m",
            name="Minimum Surface Elevation",
            classification=RequirementClassification.INFORMATIONAL,
            enabled=False,
            value=0.0,
            unit="m",
            operator="ge",
            description="Minimum surface elevation above the IAU 1,737,400 m lunar sphere datum.",
            scientific_disclaimer="Reference datum is the IAU Moon 2000 Sphere (R = 1,737,400.0 m)."
        )
    )
    max_elevation_m: SingleRequirement = Field(
        default_factory=lambda: SingleRequirement(
            id="max_elevation_m",
            name="Maximum Surface Elevation",
            classification=RequirementClassification.INFORMATIONAL,
            enabled=False,
            value=2500.0,
            unit="m",
            operator="le",
            description="Maximum surface elevation above the IAU 1,737,400 m lunar sphere datum.",
            scientific_disclaimer="Reference datum is the IAU Moon 2000 Sphere (R = 1,737,400.0 m)."
        )
    )
    max_roughness_factor: SingleRequirement = Field(
        default_factory=lambda: SingleRequirement(
            id="max_roughness_factor",
            name="Maximum Local Terrain Roughness Factor",
            classification=RequirementClassification.INFORMATIONAL,
            enabled=False,
            value=5.0,
            unit="deg_std",
            operator="le",
            description="Local standard deviation of slope within the landing area footprint.",
            scientific_disclaimer="Derived from local 5 m DEM neighborhood variance."
        )
    )

class MissionRequirementsSet(BaseModel):
    solar: SolarRequirementsConfig = Field(default_factory=SolarRequirementsConfig)
    earth: EarthRequirementsConfig = Field(default_factory=EarthRequirementsConfig)
    terrain: TerrainRequirementsConfig = Field(default_factory=TerrainRequirementsConfig)

class MissionProfile(BaseModel):
    id: str = Field(..., description="Unique profile identifier (e.g. 'profile-robotic-lander')")
    name: str = Field(..., description="Human-readable mission profile name")
    description: str = Field(..., description="Detailed mission description and operational concept")
    mission_type: MissionType = Field(MissionType.ROBOTIC_LANDER, description="Mission type classification")
    duration_days: float = Field(..., ge=0.04, le=90.0, description="User-selected mission duration in standard Earth days (0.04 to 90.0 days). Distinct from astronomical lunar cycle lengths (e.g. synodic month ~29.53 Earth days).")
    start_timestamp_iso: str = Field(..., description="Intended illumination analysis window start epoch (UTC ISO 8601)")
    end_timestamp_iso: str = Field(..., description="Intended illumination analysis window end epoch (UTC ISO 8601)")
    observer_height_m: float = Field(2.0, ge=0.0, le=100.0, description="Observer instrument height above surface (meters)")
    time_display_preference: TimeDisplayPreference = Field(TimeDisplayPreference.UTC)
    requirements: MissionRequirementsSet = Field(default_factory=MissionRequirementsSet)
    version: int = Field(1, ge=1, description="Profile version number, incremented on updates")
    is_template: bool = Field(False, description="Whether this is a built-in illustrative template")
    created_at_iso: str = Field(..., description="Profile creation timestamp (UTC)")
    updated_at_iso: str = Field(..., description="Profile last modified timestamp (UTC)")

class MissionProfileCreateRequest(BaseModel):
    name: str = Field(..., max_length=120)
    description: Optional[str] = Field("", max_length=1000)
    mission_type: MissionType = Field(MissionType.CUSTOM)
    duration_days: float = Field(7.0)
    start_timestamp_iso: str = Field("2026-10-04T12:00:00Z")
    end_timestamp_iso: str = Field("2026-10-11T12:00:00Z")
    observer_height_m: float = Field(2.0)
    time_display_preference: TimeDisplayPreference = Field(TimeDisplayPreference.UTC)
    requirements: Optional[Any] = None

class MissionProfileUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, max_length=120)
    description: Optional[str] = Field(None, max_length=1000)
    mission_type: Optional[MissionType] = None
    duration_days: Optional[float] = None
    start_timestamp_iso: Optional[str] = None
    end_timestamp_iso: Optional[str] = None
    observer_height_m: Optional[float] = None
    time_display_preference: Optional[TimeDisplayPreference] = None
    requirements: Optional[Any] = None

class MissionProfileValidationRequest(BaseModel):
    name: Optional[str] = ""
    description: Optional[str] = ""
    mission_type: Optional[str] = "custom"
    duration_days: Optional[float] = None
    start_timestamp_iso: Optional[str] = None
    end_timestamp_iso: Optional[str] = None
    observer_height_m: Optional[float] = None
    time_display_preference: Optional[str] = "UTC"
    requirements: Optional[Any] = None

class ValidationFeedbackItem(BaseModel):
    field: str
    message: str
    severity: str  # "ERROR" | "WARNING" | "INFO"

class MissionProfileValidationResponse(BaseModel):
    is_valid: bool
    errors: List[ValidationFeedbackItem]
    warnings: List[ValidationFeedbackItem]
    info_notes: List[ValidationFeedbackItem]
