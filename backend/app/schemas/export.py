"""
Pydantic schemas for Scientific Data Exports.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class ExportMetadata(BaseModel):
    export_type: str  # "elevation_map", "slope_map", "hillshade", "profile_csv", "statistics_json", "geotiff"
    dataset_id: str
    dataset_name: str
    source_url: str
    citation: str
    projection_crs: str
    reference_frame: str
    elevation_datum: str
    resolution_nominal_m: float
    effective_resolution_note: str
    bounds_geographic: Dict[str, float]
    generation_date_iso: str
    software: str = "LUNAVISTA Lunar Terrain Analysis Engine"
    scientific_disclaimer: str
