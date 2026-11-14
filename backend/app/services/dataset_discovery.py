"""
Automatic NASA Lunar Dataset Discovery and Resolution-Aware Recommendation Service.
"""

import math
from typing import Dict, List, Optional, Tuple
from app.schemas.dataset import (
    DatasetRecord,
    DatasetDiscoveryCandidate,
    DatasetDiscoveryResponse,
)
from app.services.dataset_catalogue import catalogue_service
from app.services.coordinate_transform import (
    lat_lon_to_stereographic,
    stereographic_to_lat_lon,
    LUNAR_RADIUS_M,
)

def compute_spherical_box_area_km2(
    min_lat: float, max_lat: float, min_lon: float, max_lon: float
) -> float:
    """
    Computes accurate spherical surface area in km^2 on the lunar datum (R = 1,737.4 km).
    """
    r_km = LUNAR_RADIUS_M / 1000.0
    lat1 = math.radians(min_lat)
    lat2 = math.radians(max_lat)

    lon_span_deg = (max_lon - min_lon) % 360.0
    if lon_span_deg == 0.0 and max_lon != min_lon:
        lon_span_deg = 360.0
    lon_span_rad = math.radians(lon_span_deg)

    area = (r_km ** 2) * lon_span_rad * abs(math.sin(lat2) - math.sin(lat1))
    return max(0.01, float(area))

def compute_projected_overlap(
    user_left: float,
    user_bottom: float,
    user_right: float,
    user_top: float,
    ds_left: float,
    ds_bottom: float,
    ds_right: float,
    ds_top: float,
) -> Tuple[float, Optional[Dict[str, float]]]:
    """
    Computes intersection and coverage percentage in South Polar Stereographic space.
    """
    user_width = max(0.0, user_right - user_left)
    user_height = max(0.0, user_top - user_bottom)
    user_area = user_width * user_height

    if user_area <= 0.0:
        return 0.0, None

    ix_left = max(user_left, ds_left)
    ix_bottom = max(user_bottom, ds_bottom)
    ix_right = min(user_right, ds_right)
    ix_top = min(user_top, ds_top)

    if ix_right <= ix_left or ix_top <= ix_bottom:
        return 0.0, None

    intersection_area = (ix_right - ix_left) * (ix_top - ix_bottom)
    coverage_pct = round(min(100.0, (intersection_area / user_area) * 100.0), 1)

    # Convert intersection bounds back to geographic
    lat_min, lon_min = stereographic_to_lat_lon(ix_left, ix_bottom)
    lat_max, lon_max = stereographic_to_lat_lon(ix_right, ix_top)

    inter_geo = {
        "min_lat": round(min(lat_min, lat_max), 4),
        "max_lat": round(max(lat_min, lat_max), 4),
        "min_lon": round(min(lon_min, lon_max), 4),
        "max_lon": round(max(lon_min, lon_max), 4),
    }

    return coverage_pct, inter_geo

class DatasetDiscoveryEngine:
    def __init__(self):
        self.catalogue = catalogue_service

    def discover_datasets_for_region(
        self,
        min_lat: float,
        max_lat: float,
        min_lon: float,
        max_lon: float,
    ) -> DatasetDiscoveryResponse:
        """
        Analyzes a selected geographic region and discovers all compatible NASA datasets,
        evaluating spatial overlap and providing resolution-aware recommendations.
        """
        # Ensure valid latitude ordering
        min_lat, max_lat = min(min_lat, max_lat), max(min_lat, max_lat)

        selected_area_km2 = compute_spherical_box_area_km2(min_lat, max_lat, min_lon, max_lon)

        # Convert bounding box to polar stereographic projection
        # Sample the 4 corners plus midpoints
        lats = [min_lat, max_lat, (min_lat + max_lat) / 2.0]
        lons = [min_lon, max_lon, (min_lon + max_lon) / 2.0]
        xs: List[float] = []
        ys: List[float] = []

        for lat in lats:
            for lon in lons:
                x, y = lat_lon_to_stereographic(lat, lon)
                xs.append(x)
                ys.append(y)

        u_left = min(xs)
        u_right = max(xs)
        u_bottom = min(ys)
        u_top = max(ys)

        all_records = self.catalogue.list_all()
        candidates: List[DatasetDiscoveryCandidate] = []
        warnings: List[str] = []

        if max_lat > -80.0:
            warnings.append(
                f"Selected region (up to {max_lat:.1f}°N/S) extends north of the -80° South Polar LOLA DEM boundary."
            )

        for rec in all_records:
            ds_b = rec.bounds_projected
            cov_pct, inter_geo = compute_projected_overlap(
                u_left, u_bottom, u_right, u_top,
                ds_b["left"], ds_b["bottom"], ds_b["right"], ds_b["top"],
            )

            if cov_pct > 0.0 and inter_geo is not None:
                notes: List[str] = []
                if cov_pct >= 99.5:
                    notes.append("Complete spatial coverage across the selected region.")
                else:
                    notes.append(f"Partial spatial coverage ({cov_pct}% of selected area).")

                if rec.is_local_available:
                    notes.append("Locally cached for instant processing.")
                else:
                    notes.append("Streamable on-demand via Cloud Optimized GeoTIFF byte-ranges.")

                candidates.append(
                    DatasetDiscoveryCandidate(
                        dataset=rec,
                        coverage_percentage=cov_pct,
                        overlaps_completely=(cov_pct >= 99.5),
                        intersection_bounds_geographic=inter_geo,
                        resolution_rank=int(rec.nominal_pixel_spacing_m),
                        notes=notes,
                    )
                )

        # Sort candidates: first by coverage completeness, then by finest nominal resolution
        candidates.sort(key=lambda c: (c.coverage_percentage >= 99.5, -c.resolution_rank), reverse=True)

        # Determine recommendations
        best_resolution: Optional[DatasetDiscoveryCandidate] = None
        best_coverage: Optional[DatasetDiscoveryCandidate] = None

        if candidates:
            # Candidate with lowest nominal pixel spacing
            by_res = sorted(candidates, key=lambda c: (c.resolution_rank, -c.coverage_percentage))
            best_resolution = by_res[0]
            best_resolution.recommendation_type = "best_resolution"

            # Candidate with >= 99.5% coverage having the finest resolution
            full_cov = [c for c in candidates if c.overlaps_completely]
            if full_cov:
                best_coverage = sorted(full_cov, key=lambda c: c.resolution_rank)[0]
                best_coverage.recommendation_type = "best_coverage"
            else:
                # If no 100% coverage candidate, pick the highest coverage
                best_coverage = sorted(candidates, key=lambda c: c.coverage_percentage, reverse=True)[0]
                best_coverage.recommendation_type = "best_coverage"

            if best_resolution and not best_resolution.overlaps_completely:
                warnings.append(
                    f"Highest resolution dataset '{best_resolution.dataset.name}' ({best_resolution.dataset.nominal_pixel_spacing_m}m) "
                    f"covers only {best_resolution.coverage_percentage}% of the region. "
                    f"For complete coverage without gaps, use '{best_coverage.dataset.name}' ({best_coverage.dataset.nominal_pixel_spacing_m}m)."
                )

        return DatasetDiscoveryResponse(
            selected_region_geographic={
                "min_lat": min_lat,
                "max_lat": max_lat,
                "min_lon": min_lon,
                "max_lon": max_lon,
            },
            selected_region_area_km2=round(selected_area_km2, 2),
            best_resolution_candidate=best_resolution,
            best_coverage_candidate=best_coverage,
            all_candidates=candidates,
            coverage_warnings=warnings,
        )

discovery_engine = DatasetDiscoveryEngine()
