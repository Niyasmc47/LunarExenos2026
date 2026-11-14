"""
Scientific Regional Statistics and Lunar Area Calculation Service.
"""

from typing import Dict, Any, Optional
import numpy as np
from app.schemas.analysis import RegionalStatisticsResponse
from app.schemas.region import BoundingBox
from app.schemas.dataset import DatasetRecord
from app.services.slope_service import slope_service
from app.services.dataset_discovery import compute_spherical_box_area_km2

class RegionalStatisticsService:
    @staticmethod
    def compute_statistics(
        dataset: DatasetRecord,
        bbox: BoundingBox,
        elevation: np.ndarray,
        slope: Optional[np.ndarray],
    ) -> RegionalStatisticsResponse:
        """
        Computes comprehensive physical terrain and slope statistics,
        excluding nodata pixels and using spherical lunar area calculations.
        """
        total_pixels = int(elevation.size)
        valid_elev_mask = ~np.isnan(elevation)
        valid_pixels = int(np.sum(valid_elev_mask))
        nodata_pixels = total_pixels - valid_pixels

        coverage_pct = round((valid_pixels / total_pixels) * 100.0, 2) if total_pixels > 0 else 0.0

        # Spherical area of the bounding box
        total_area_km2 = compute_spherical_box_area_km2(
            bbox.min_latitude, bbox.max_latitude, bbox.min_longitude, bbox.max_longitude
        )
        valid_data_area_km2 = round(total_area_km2 * (coverage_pct / 100.0), 2)

        elev_min = None
        elev_max = None
        elev_mean = None
        elev_median = None
        elev_std = None
        elev_range = None

        if valid_pixels > 0:
            valid_elev = elevation[valid_elev_mask]
            elev_min = round(float(np.min(valid_elev)), 2)
            elev_max = round(float(np.max(valid_elev)), 2)
            elev_mean = round(float(np.mean(valid_elev)), 2)
            elev_median = round(float(np.median(valid_elev)), 2)
            elev_std = round(float(np.std(valid_elev)), 2)
            elev_range = round(elev_max - elev_min, 2)

        # Slope statistics
        slp_min = None
        slp_max = None
        slp_mean = None
        slp_median = None
        slope_dist: Dict[str, float] = {}

        if slope is not None:
            valid_slp_mask = ~np.isnan(slope)
            if np.any(valid_slp_mask):
                valid_slp = slope[valid_slp_mask]
                slp_min = round(float(np.min(valid_slp)), 2)
                slp_max = round(float(np.max(valid_slp)), 2)
                slp_mean = round(float(np.mean(valid_slp)), 2)
                slp_median = round(float(np.median(valid_slp)), 2)
                slope_dist = slope_service.compute_slope_distribution(slope)

        scientific_notes = [
            f"Dataset: {dataset.name} ({dataset.product_series})",
            f"Nominal grid spacing: {dataset.nominal_pixel_spacing_m} m/pixel.",
            f"Reference frame: {dataset.reference_frame} | Datum: {dataset.elevation_datum}.",
            dataset.effective_resolution_note,
        ]

        if nodata_pixels > 0:
            scientific_notes.append(
                f"Contains {nodata_pixels} nodata/interpolated edge pixels ({100.0 - coverage_pct:.1f}% of bounding box)."
            )

        return RegionalStatisticsResponse(
            dataset_id=dataset.dataset_id,
            dataset_name=dataset.name,
            bounding_box=bbox,
            nominal_pixel_spacing_m=dataset.nominal_pixel_spacing_m,
            total_pixels=total_pixels,
            valid_pixels=valid_pixels,
            nodata_pixels=nodata_pixels,
            data_coverage_percentage=coverage_pct,
            total_area_km2=round(total_area_km2, 2),
            valid_data_area_km2=valid_data_area_km2,
            elevation_min_m=elev_min,
            elevation_max_m=elev_max,
            elevation_mean_m=elev_mean,
            elevation_median_m=elev_median,
            elevation_std_m=elev_std,
            elevation_range_m=elev_range,
            slope_min_deg=slp_min,
            slope_max_deg=slp_max,
            slope_mean_deg=slp_mean,
            slope_median_deg=slp_median,
            slope_distribution_percentage=slope_dist,
            citation=dataset.citation,
            scientific_notes=scientific_notes,
        )

regional_statistics_service = RegionalStatisticsService()
