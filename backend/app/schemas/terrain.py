from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class ProjectedBounds(BaseModel):
    left: float
    bottom: float
    right: float
    top: float

class GeographicBounds(BaseModel):
    min_latitude: float
    max_latitude: float
    min_longitude: float
    max_longitude: float

class GeographicCoordinate(BaseModel):
    latitude: float
    longitude: float

class ElevationStats(BaseModel):
    min_m: float
    max_m: float
    mean_m: float
    std_m: float
    range_m: float

class CompanionProductInfo(BaseModel):
    type: str # surf, ldec, slp, toterr, slperr
    filename: str
    available: bool
    description: str

class DatasetMetadata(BaseModel):
    dataset_id: str
    name: str
    region_name: str
    description: str
    source_url: str
    publication_ref: str
    reference_frame: str
    projection_crs: str
    pixel_spacing_m: float
    effective_resolution_note: str
    dimensions: Dict[str, int]
    bounds_projected: ProjectedBounds
    bounds_geographic: GeographicBounds
    center_geographic: GeographicCoordinate
    elevation_stats: ElevationStats
    companions: List[CompanionProductInfo]
    quality_summary: Dict[str, Any]

class ElevationPointResponse(BaseModel):
    latitude: float
    longitude: float
    projected_x: Optional[float] = None
    projected_y: Optional[float] = None
    in_bounds: bool
    elevation_m: Optional[float] = None
    slope_deg: Optional[float] = None
    lola_count: Optional[int] = None
    elevation_uncertainty_m: Optional[float] = None
    slope_uncertainty_deg: Optional[float] = None
    quality_status: str # "measured", "interpolated", "out_of_bounds", "nodata"
    note: Optional[str] = None

class TerrainGridResponse(BaseModel):
    dataset_id: str
    lod: str # 'low', 'medium', 'high'
    grid_width: int
    grid_height: int
    bounds_projected: ProjectedBounds
    bounds_geographic: GeographicBounds
    center_geographic: GeographicCoordinate
    elevations: List[List[Optional[float]]]
    slopes: Optional[List[List[Optional[float]]]] = None
    lola_counts: Optional[List[List[Optional[int]]]] = None
    uncertainties: Optional[List[List[Optional[float]]]] = None
    min_elevation: float
    max_elevation: float
    reference_radius_m: float = 1737400.0
    quality_summary: Dict[str, Any]

class ProfileSample(BaseModel):
    distance_m: float
    latitude: float
    longitude: float
    projected_x: float
    projected_y: float
    elevation_m: Optional[float] = None
    slope_deg: Optional[float] = None
    quality_status: str

class ElevationProfileResponse(BaseModel):
    dataset_id: str
    start_latitude: float
    start_longitude: float
    end_latitude: float
    end_longitude: float
    total_distance_m: float
    sample_count: int
    min_elevation_m: Optional[float] = None
    max_elevation_m: Optional[float] = None
    elevation_diff_m: Optional[float] = None
    mean_slope_deg: Optional[float] = None
    max_slope_deg: Optional[float] = None
    samples: List[ProfileSample]

