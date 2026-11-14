"""
Elevation profile extraction service along linear transects across lunar DEMs.
"""

import math
from typing import List, Optional
import numpy as np

from app.schemas.terrain import ElevationProfileResponse, ProfileSample
from app.services.coordinate_transform import (
    lat_lon_to_stereographic,
    stereographic_to_lat_lon,
)
from app.services.dem_loader import dem_loader

def extract_elevation_profile(
    dataset_id: str,
    start_lat: float,
    start_lon: float,
    end_lat: float,
    end_lon: float,
    num_samples: int = 100,
) -> ElevationProfileResponse:
    """
    Extracts high-resolution elevation and slope samples along a transect.
    """
    num_samples = max(2, min(500, num_samples))

    # Convert geographic end-points to South Polar Stereographic (meters)
    x1, y1 = lat_lon_to_stereographic(start_lat, start_lon)
    x2, y2 = lat_lon_to_stereographic(end_lat, end_lon)

    dx = x2 - x1
    dy = y2 - y1
    total_distance_m = math.hypot(dx, dy)

    samples: List[ProfileSample] = []
    elevations: List[float] = []
    slopes: List[float] = []

    for i in range(num_samples):
        t = i / (num_samples - 1)
        x = x1 + t * dx
        y = y1 + t * dy

        lat, lon = stereographic_to_lat_lon(x, y)
        pt = dem_loader.sample_point(lat, lon)

        dist_m = t * total_distance_m
        elev = pt.get("elevation_m")
        slope = pt.get("slope_deg")

        if elev is not None:
            elevations.append(elev)
        if slope is not None:
            slopes.append(slope)

        samples.append(
            ProfileSample(
                distance_m=round(dist_m, 2),
                latitude=round(lat, 6),
                longitude=round(lon, 6),
                projected_x=round(x, 2),
                projected_y=round(y, 2),
                elevation_m=round(elev, 2) if elev is not None else None,
                slope_deg=round(slope, 2) if slope is not None else None,
                quality_status=pt.get("quality_status", "nodata"),
            )
        )

    min_elev = float(np.min(elevations)) if elevations else None
    max_elev = float(np.max(elevations)) if elevations else None
    diff_elev = round(max_elev - min_elev, 2) if min_elev is not None and max_elev is not None else None
    mean_slp = round(float(np.mean(slopes)), 2) if slopes else None
    max_slp = round(float(np.max(slopes)), 2) if slopes else None

    return ElevationProfileResponse(
        dataset_id=dataset_id,
        start_latitude=start_lat,
        start_longitude=start_lon,
        end_latitude=end_lat,
        end_longitude=end_lon,
        total_distance_m=round(total_distance_m, 2),
        sample_count=len(samples),
        min_elevation_m=min_elev,
        max_elevation_m=max_elev,
        elevation_diff_m=diff_elev,
        mean_slope_deg=mean_slp,
        max_slope_deg=max_slp,
        samples=samples,
    )
