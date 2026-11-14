"""
Pydantic schemas for NASA Lunar Terrain Dataset Catalogue and Discovery.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class DatasetRecord(BaseModel):
    dataset_id: str
    product_series: str  # "PGDA-78", "PGDA-81", "PGDA-90", "MOON-TREK"
    name: str
    region_name: str
    description: str
    source_url: str
    citation: str
    reference_frame: str = "MOON_ME (DE421)"
    projection_crs: str
    nominal_pixel_spacing_m: float
    effective_resolution_note: str
    bounds_projected: Dict[str, float]  # left, bottom, right, top in meters
    bounds_geographic: Dict[str, float]  # min_lat, max_lat, min_lon, max_lon in degrees
    elevation_datum: str = "Sphere R = 1,737,400 m"
    elevation_units: str = "meters"
    nodata_value: float = -32767.0
    file_size_mb: float
    access_method: str  # "local", "cog_range", "wmts"
    is_local_available: bool = False
    local_surf_path: Optional[str] = None
    local_slp_path: Optional[str] = None
    remote_surf_url: Optional[str] = None
    remote_slp_url: Optional[str] = None
    companion_layers: List[str] = Field(default_factory=list)
    quality_notes: List[str] = Field(default_factory=list)

class DatasetCatalogueResponse(BaseModel):
    total_datasets: int
    datasets: List[DatasetRecord]

class DatasetDiscoveryCandidate(BaseModel):
    dataset: DatasetRecord
    coverage_percentage: float
    overlaps_completely: bool
    intersection_bounds_geographic: Dict[str, float]
    resolution_rank: int
    recommendation_type: Optional[str] = None  # "best_resolution", "best_coverage", "alternative"
    notes: List[str] = Field(default_factory=list)

class DatasetDiscoveryRequest(BaseModel):
    min_latitude: float = Field(..., ge=-90.0, le=90.0)
    max_latitude: float = Field(..., ge=-90.0, le=90.0)
    min_longitude: float = Field(..., ge=-180.0, le=180.0)
    max_longitude: float = Field(..., ge=-180.0, le=180.0)

class DatasetDiscoveryResponse(BaseModel):
    selected_region_geographic: Dict[str, float]
    selected_region_area_km2: float
    best_resolution_candidate: Optional[DatasetDiscoveryCandidate] = None
    best_coverage_candidate: Optional[DatasetDiscoveryCandidate] = None
    all_candidates: List[DatasetDiscoveryCandidate]
    coverage_warnings: List[str] = Field(default_factory=list)
