from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class EphemerisPositionRequest(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Observer lunar latitude in degrees (-90 to +90)")
    longitude: float = Field(..., ge=-180.0, le=360.0, description="Observer lunar longitude in degrees")
    timestamp_iso: str = Field(..., description="Observation timestamp in ISO 8601 format (e.g. 2026-10-04T12:00:00Z)")
    observer_height_m: float = Field(2.0, ge=0.0, le=100.0, description="Observer instrument height above lunar surface in meters")
    dataset_id: str = Field("site01", description="Identifier of lunar DEM dataset for surface elevation")
    aberration_correction: str = Field("LT+S", description="SPICE aberration correction: 'NONE' (geometric), 'LT' (light-time), 'LT+S' (apparent)")

class CelestialBodyPosition(BaseModel):
    body_name: str = Field(..., description="Target celestial body: 'Sun' or 'Earth'")
    azimuth_deg: float = Field(..., ge=0.0, le=360.0, description="Topocentric azimuth angle in degrees (0°=N, 90°=E, 180°=S, 270°=W)")
    elevation_deg: float = Field(..., ge=-90.0, le=90.0, description="Topocentric elevation angle above local horizontal plane in degrees")
    distance_km: float = Field(..., gt=0.0, description="Distance from observer to target body in kilometers")
    apparent_angular_diameter_deg: float = Field(..., gt=0.0, description="Apparent topocentric angular diameter in degrees")
    topocentric_vector_moon_me_km: List[float] = Field(..., description="3D topocentric vector from observer to target in MOON_ME Cartesian frame [x, y, z]")
    light_time_seconds: float = Field(..., description="One-way light travel time from target to observer in seconds")

class EphemerisPositionResponse(BaseModel):
    observer_latitude: float
    observer_longitude: float
    observer_surface_elevation_m: float
    observer_height_m: float
    total_observer_elevation_m: float
    observer_cartesian_moon_me_km: List[float]
    requested_timestamp_iso: str
    ephemeris_time_tdb_seconds: float
    sun: CelestialBodyPosition
    earth: CelestialBodyPosition
    reference_frame: str
    aberration_correction: str
    lunar_radius_model_m: float
    dataset_id: str
    kernel_provenance: Dict[str, Any]
    warnings: List[str]

class EphemerisTimeSeriesRequest(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Observer lunar latitude in degrees")
    longitude: float = Field(..., ge=-180.0, le=360.0, description="Observer lunar longitude in degrees")
    start_timestamp_iso: str = Field(..., description="Start epoch ISO 8601")
    end_timestamp_iso: str = Field(..., description="End epoch ISO 8601")
    step_interval_hours: float = Field(2.0, ge=0.1, le=168.0, description="Time step between ephemeris samples in hours (e.g. 1.0 or 2.0)")
    observer_height_m: float = Field(2.0, ge=0.0, le=100.0, description="Observer instrument height above lunar terrain in meters")
    dataset_id: str = Field("site01", description="Identifier of lunar DEM dataset")
    aberration_correction: str = Field("LT+S", description="SPICE aberration correction: 'LT+S' (default), 'LT', or 'NONE'")

class EphemerisTimeSeriesPoint(BaseModel):
    timestamp_iso: str
    ephemeris_time_tdb: float
    sun_azimuth_deg: float
    sun_elevation_deg: float
    sun_distance_km: float
    sun_angular_diameter_deg: float
    earth_azimuth_deg: float
    earth_elevation_deg: float
    earth_distance_km: float
    earth_angular_diameter_deg: float

class EphemerisTimeSeriesResponse(BaseModel):
    observer_latitude: float
    observer_longitude: float
    observer_surface_elevation_m: float
    observer_height_m: float
    start_timestamp_iso: str
    end_timestamp_iso: str
    step_interval_hours: float
    total_epochs_computed: int
    series: List[EphemerisTimeSeriesPoint]
    reference_frame: str
    aberration_correction: str
    kernel_provenance: Dict[str, Any]
    warnings: List[str]

class KernelInfo(BaseModel):
    filename: str
    kernel_type: str
    description: str
    file_size_bytes: int
    loaded: bool
    source_url: str

class EphemerisStatusResponse(BaseModel):
    service_status: str
    spice_toolkit_version: str
    spiceypy_version: str
    primary_lunar_frame: str
    active_kernels: List[KernelInfo]
    total_kernels_loaded: int
    lunar_ephemeris_model: str
