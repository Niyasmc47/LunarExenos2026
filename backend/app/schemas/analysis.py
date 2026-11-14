"""
Pydantic schemas for Regional Elevation, Slope, Hillshade, and Statistics.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from app.schemas.region import BoundingBox

class RegionalMapRequest(BaseModel):
    dataset_id: str
    bounding_box: BoundingBox
    output_width: int = Field(512, ge=128, le=2048)
    output_height: int = Field(512, ge=128, le=2048)
    colormap_name: str = "hypsometric"  # hypsometric, turbo, viridis, magma

class RegionalSlopeMapRequest(BaseModel):
    dataset_id: str
    bounding_box: BoundingBox
    output_width: int = Field(512, ge=128, le=2048)
    output_height: int = Field(512, ge=128, le=2048)
    classified: bool = True  # True = 7 lunar landing slope categories

class HillshadeRequest(BaseModel):
    dataset_id: str
    bounding_box: BoundingBox
    output_width: int = Field(512, ge=128, le=2048)
    output_height: int = Field(512, ge=128, le=2048)
    azimuth_deg: float = Field(315.0, ge=0.0, le=360.0)
    altitude_deg: float = Field(45.0, ge=5.0, le=90.0)
    z_factor: float = Field(1.0, ge=0.5, le=10.0)

class RegionalStatisticsResponse(BaseModel):
    dataset_id: str
    dataset_name: str
    bounding_box: BoundingBox
    nominal_pixel_spacing_m: float
    total_pixels: int
    valid_pixels: int
    nodata_pixels: int
    data_coverage_percentage: float
    total_area_km2: float
    valid_data_area_km2: float
    elevation_min_m: Optional[float] = None
    elevation_max_m: Optional[float] = None
    elevation_mean_m: Optional[float] = None
    elevation_median_m: Optional[float] = None
    elevation_std_m: Optional[float] = None
    elevation_range_m: Optional[float] = None
    slope_min_deg: Optional[float] = None
    slope_max_deg: Optional[float] = None
    slope_mean_deg: Optional[float] = None
    slope_median_deg: Optional[float] = None
    slope_distribution_percentage: Dict[str, float] = Field(default_factory=dict)
    citation: str
    scientific_notes: List[str] = Field(default_factory=list)

class TerrainInspectionResponse(BaseModel):
    latitude: float
    longitude: float
    projected_x: float
    projected_y: float
    in_bounds: bool
    elevation_m: Optional[float] = None
    slope_deg: Optional[float] = None
    quality_status: str  # "measured", "interpolated", "nodata", "out_of_bounds"
    dataset_id: str
    dataset_name: str
    slope_source: str  # "nasa_provided", "lunavista_derived", "none"
    effective_resolution_note: str
    citation: str
