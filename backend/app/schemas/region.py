"""
Pydantic schemas for Lunar Region Selection and Geometry.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class BoundingBox(BaseModel):
    min_latitude: float = Field(..., ge=-90.0, le=90.0)
    max_latitude: float = Field(..., ge=-90.0, le=90.0)
    min_longitude: float = Field(..., ge=-180.0, le=180.0)
    max_longitude: float = Field(..., ge=-180.0, le=180.0)

class PredefinedSite(BaseModel):
    id: str
    name: str
    category: str
    target_center: Dict[str, float]  # lat, lon
    bounding_box: BoundingBox
    description: str
    suggested_dataset_id: str

class RegionMetadata(BaseModel):
    bounding_box: BoundingBox
    center_latitude: float
    center_longitude: float
    width_km: float
    height_km: float
    area_km2: float
    hemisphere: str
    polar_zone: str
