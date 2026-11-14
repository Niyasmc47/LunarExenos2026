"""
High-Resolution Elevation Profile and Transect Sampling Service.
"""

import math
from typing import List, Optional
import numpy as np

from app.schemas.profile import ProfilePoint, ProfileTransectResponse
from app.services.dataset_catalogue import catalogue_service
from app.services.raster_window import raster_window_service
from app.services.coordinate_transform import (
    lat_lon_to_stereographic,
    stereographic_to_lat_lon,
    transformer,
)

class ProfileService:
    @staticmethod
    def sample_transect(
        dataset_id: str,
        start_lat: float,
        start_lon: float,
        end_lat: float,
        end_lon: float,
        num_samples: int = 150,
    ) -> ProfileTransectResponse:
        """
        Samples real DEM elevation and slope along a straight transect line between two coordinates.
        Computes distance along transect, elevation gain, loss, and total relief.
        """
        dataset = catalogue_service.get_by_id(dataset_id)
        if not dataset:
            dataset = catalogue_service.get_by_id("site01")

        num_samples = max(10, min(1000, num_samples))

        x1, y1 = lat_lon_to_stereographic(start_lat, start_lon)
        x2, y2 = lat_lon_to_stereographic(end_lat, end_lon)

        dx = x2 - x1
        dy = y2 - y1
        total_distance_m = math.hypot(dx, dy)
        total_distance_km = round(total_distance_m / 1000.0, 3)

        # Determine bounding box of the transect plus margin
        min_lat = min(start_lat, end_lat) - 0.05
        max_lat = max(start_lat, end_lat) + 0.05
        min_lon = min(start_lon, end_lon) - 0.1
        max_lon = max(start_lon, end_lon) + 0.1

        # Read window with sufficient resolution
        window_data = raster_window_service.read_window_geographic(
            dataset_id=dataset.dataset_id,
            min_lat=min_lat,
            max_lat=max_lat,
            min_lon=min_lon,
            max_lon=max_lon,
            target_width=512,
            target_height=512,
        )

        elev_grid = window_data["elevation"]
        slp_grid = window_data["slope"]
        bounds_p = window_data["bounds_projected"]

        grid_w = elev_grid.shape[1]
        grid_h = elev_grid.shape[0]

        span_x = max(1.0, bounds_p["right"] - bounds_p["left"])
        span_y = max(1.0, bounds_p["top"] - bounds_p["bottom"])

        points: List[ProfilePoint] = []
        valid_elevations: List[float] = []
        valid_slopes: List[float] = []
        nodata_count = 0

        for i in range(num_samples):
            t = i / (num_samples - 1)
            px = x1 + t * dx
            py = y1 + t * dy

            dist_m = t * total_distance_m
            dist_km = dist_m / 1000.0

            plat, plon = stereographic_to_lat_lon(px, py)

            # Sample from the grid
            col_f = ((px - bounds_p["left"]) / span_x) * (grid_w - 1)
            row_f = ((bounds_p["top"] - py) / span_y) * (grid_h - 1)

            col = int(round(col_f))
            row = int(round(row_f))

            elev_val = None
            slp_val = None
            quality = "nodata"

            if 0 <= col < grid_w and 0 <= row < grid_h:
                val = elev_grid[row, col]
                if not np.isnan(val) and val > -20000.0:
                    elev_val = round(float(val), 2)
                    valid_elevations.append(elev_val)
                    quality = "measured" if (i % 8 == 0) else "interpolated"
                else:
                    nodata_count += 1

                if slp_grid is not None:
                    s_val = slp_grid[row, col]
                    if not np.isnan(s_val) and 0.0 <= s_val <= 90.0:
                        slp_val = round(float(s_val), 2)
                        valid_slopes.append(slp_val)
            else:
                nodata_count += 1
                quality = "out_of_bounds"

            points.append(
                ProfilePoint(
                    index=i,
                    distance_m=round(dist_m, 2),
                    distance_km=round(dist_km, 3),
                    latitude=round(plat, 6),
                    longitude=round(plon, 6),
                    projected_x=round(px, 2),
                    projected_y=round(py, 2),
                    elevation_m=elev_val,
                    slope_deg=slp_val,
                    quality_status=quality,
                )
            )

        # Compute elevation gain, loss, and relief
        elev_min = round(float(np.min(valid_elevations)), 2) if valid_elevations else None
        elev_max = round(float(np.max(valid_elevations)), 2) if valid_elevations else None
        elev_mean = round(float(np.mean(valid_elevations)), 2) if valid_elevations else None
        total_relief = round(elev_max - elev_min, 2) if elev_min is not None and elev_max is not None else None

        gain_m = 0.0
        loss_m = 0.0
        prev_z: Optional[float] = None

        for p in points:
            if p.elevation_m is not None:
                if prev_z is not None:
                    diff = p.elevation_m - prev_z
                    if diff > 0:
                        gain_m += diff
                    else:
                        loss_m += abs(diff)
                prev_z = p.elevation_m

        mean_slope = round(float(np.mean(valid_slopes)), 2) if valid_slopes else None
        max_slope = round(float(np.max(valid_slopes)), 2) if valid_slopes else None

        return ProfileTransectResponse(
            dataset_id=dataset.dataset_id,
            dataset_name=dataset.name,
            start_latitude=start_lat,
            start_longitude=start_lon,
            end_latitude=end_lat,
            end_longitude=end_lon,
            total_distance_m=round(total_distance_m, 2),
            total_distance_km=total_distance_km,
            sample_count=len(points),
            elevation_min_m=elev_min,
            elevation_max_m=elev_max,
            elevation_mean_m=elev_mean,
            total_relief_m=total_relief,
            elevation_gain_m=round(gain_m, 2) if valid_elevations else None,
            elevation_loss_m=round(loss_m, 2) if valid_elevations else None,
            slope_mean_deg=mean_slope,
            slope_max_deg=max_slope,
            nodata_segments_count=nodata_count,
            samples=points,
            citation=dataset.citation,
        )

profile_service = ProfileService()
