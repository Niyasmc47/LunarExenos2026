"""
Pydantic schemas for Elevation Profiles and Transects.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class ProfilePoint(BaseModel):
    index: int
    distance_m: float
    distance_km: float
    latitude: float
    longitude: float
    projected_x: float
    projected_y: float
    elevation_m: Optional[float] = None
    slope_deg: Optional[float] = None
    quality_status: str

class ProfileTransectRequest(BaseModel):
    dataset_id: str
    start_latitude: float = Field(..., ge=-90.0, le=90.0)
    start_longitude: float = Field(..., ge=-180.0, le=180.0)
    end_latitude: float = Field(..., ge=-90.0, le=90.0)
    end_longitude: float = Field(..., ge=-180.0, le=180.0)
    num_samples: int = Field(150, ge=10, le=1000)

class ProfileTransectResponse(BaseModel):
    dataset_id: str
    dataset_name: str
    start_latitude: float
    start_longitude: float
    end_latitude: float
    end_longitude: float
    total_distance_m: float
    total_distance_km: float
    sample_count: int
    elevation_min_m: Optional[float] = None
    elevation_max_m: Optional[float] = None
    elevation_mean_m: Optional[float] = None
    total_relief_m: Optional[float] = None
    elevation_gain_m: Optional[float] = None
    elevation_loss_m: Optional[float] = None
    slope_mean_deg: Optional[float] = None
    slope_max_deg: Optional[float] = None
    nodata_segments_count: int = 0
    samples: List[ProfilePoint]
    citation: str
