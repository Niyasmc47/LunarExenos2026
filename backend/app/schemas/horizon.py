from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class HorizonAnalysisRequest(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Observer lunar latitude in degrees (-90 to +90)")
    longitude: float = Field(..., ge=-180.0, le=360.0, description="Observer lunar longitude in degrees")
    observer_height_m: float = Field(2.0, ge=0.0, le=100.0, description="Observer instrument height above lunar surface in meters")
    azimuth_resolution_deg: float = Field(1.0, ge=0.1, le=10.0, description="Azimuth sampling resolution in degrees (e.g. 1.0 = 360 samples)")
    max_search_distance_m: float = Field(15000.0, ge=100.0, le=100000.0, description="Maximum radial horizon search distance in meters")
    sampling_interval_m: float = Field(15.0, ge=2.0, le=200.0, description="Radial step interval along each ray in meters")
    dataset_id: str = Field("site01", description="Identifier of the lunar DEM dataset")

class HorizonPoint(BaseModel):
    azimuth_deg: float = Field(..., description="Azimuth angle from North (0°=N, 90°=E, 180°=S, 270°=W)")
    horizon_elevation_deg: float = Field(..., description="Apparent elevation angle above observer horizontal plane in degrees")
    distance_to_horizon_m: float = Field(..., description="Horizontal arc distance to the terrain feature forming the horizon")
    horizon_surface_elevation_m: float = Field(..., description="Absolute DEM surface elevation of the horizon feature in meters")
    horizon_lat: float = Field(..., description="Latitude of the horizon obstacle point")
    horizon_lon: float = Field(..., description="Longitude of the horizon obstacle point")

class HorizonSummary(BaseModel):
    max_horizon_elevation_deg: float
    max_horizon_azimuth_deg: float
    min_horizon_elevation_deg: float
    min_horizon_azimuth_deg: float
    mean_horizon_elevation_deg: float
    total_azimuths_computed: int
    valid_samples_count: int
    coverage_status: str  # "complete" | "partial" | "no_data"

class HorizonAnalysisResponse(BaseModel):
    observer_lat: float
    observer_lon: float
    observer_surface_elevation_m: float
    observer_height_m: float
    total_observer_elevation_m: float
    summary: HorizonSummary
    horizon_profile: List[HorizonPoint]
    parameters: Dict[str, Any]
    warnings: List[str]
    dataset_id: str
    dataset_name: str
    reference_frame: str
    citation: str
