"""
Scientific Slope Calculation and Lunar Landing Hazard Classification Service.
"""

from typing import Tuple, Dict, Any
import numpy as np
from scipy.ndimage import sobel

# 7 Standard Lunar Landing Slope Hazard Categories
# (Based on NASA Apollo, Artemis, and robotic lander tilt limit thresholds)
SLOPE_BINS = [
    (0.0, 5.0, "0° – 5°: Safe Landing (Low Tilt Risk)", (16, 185, 129, 255)),     # Emerald
    (5.0, 10.0, "5° – 10°: Favorable Terrain", (52, 211, 153, 255)),              # Light Emerald
    (10.0, 15.0, "10° – 15°: Moderate Slope (Caution)", (234, 179, 8, 255)),      # Amber
    (15.0, 20.0, "15° – 20°: Steep Slope (Lander Hazard)", (249, 115, 22, 255)), # Orange
    (20.0, 25.0, "20° – 25°: High Tilt Risk", (239, 68, 68, 255)),               # Red
    (25.0, 30.0, "25° – 30°: Severe Slope Hazard", (185, 28, 28, 255)),          # Dark Red
    (30.0, 90.0, "> 30°: Extreme Crater Wall", (136, 19, 55, 255)),              # Deep Wine/Magenta
]

class SlopeService:
    @staticmethod
    def derive_slope_from_dem(
        dem: np.ndarray,
        pixel_spacing_m: float,
    ) -> np.ndarray:
        """
        Derives surface slope in degrees using 3x3 Sobel/Horn kernels
        accounting for metric horizontal pixel spacing.
        """
        # Replace NaNs with nearest or border values temporarily for convolution
        nan_mask = np.isnan(dem)
        clean_dem = dem.copy()
        if np.all(nan_mask):
            return np.full_like(dem, np.nan, dtype=np.float32)

        valid_mean = float(np.nanmean(dem))
        clean_dem[nan_mask] = valid_mean

        # Horn's algorithm uses 8 * spacing normalization
        # sobel in scipy applies [ -1 0 1, -2 0 2, -1 0 1 ]
        dz_dx = sobel(clean_dem, axis=1) / (8.0 * pixel_spacing_m)
        dz_dy = sobel(clean_dem, axis=0) / (8.0 * pixel_spacing_m)

        gradient_magnitude = np.hypot(dz_dx, dz_dy)
        slope_deg = np.arctan(gradient_magnitude) * (180.0 / np.pi)

        slope_deg[nan_mask] = np.nan
        return slope_deg.astype(np.float32)

    @staticmethod
    def render_slope_rgba(
        slope_deg: np.ndarray,
        classified: bool = True,
    ) -> np.ndarray:
        """
        Renders slope array to an (H, W, 4) uint8 RGBA image array.
        Nodata pixels are rendered fully transparent (A=0).
        """
        h, w = slope_deg.shape
        rgba = np.zeros((h, w, 4), dtype=np.uint8)

        valid_mask = ~np.isnan(slope_deg)
        if not np.any(valid_mask):
            return rgba

        if classified:
            # 7-category lunar landing hazard classification
            for min_s, max_s, _, color in SLOPE_BINS:
                mask = valid_mask & (slope_deg >= min_s) & (slope_deg < max_s)
                rgba[mask] = color
            # Upper bound edge case (>= 90°)
            mask_90 = valid_mask & (slope_deg >= 90.0)
            rgba[mask_90] = SLOPE_BINS[-1][3]
        else:
            # Continuous gradient from Green (0°) -> Yellow (15°) -> Red (30°+)
            clamped = np.clip(slope_deg[valid_mask], 0.0, 35.0) / 35.0
            r = np.clip(clamped * 2.0 * 255.0, 0, 255).astype(np.uint8)
            g = np.clip((2.0 - clamped * 2.0) * 255.0, 0, 255).astype(np.uint8)
            b = np.full_like(r, 30)

            rgba[valid_mask, 0] = r
            rgba[valid_mask, 1] = g
            rgba[valid_mask, 2] = b
            rgba[valid_mask, 3] = 230

        return rgba

    @staticmethod
    def compute_slope_distribution(slope_deg: np.ndarray) -> Dict[str, float]:
        """Calculates percentage of valid terrain falling into each landing slope category."""
        valid = slope_deg[~np.isnan(slope_deg)]
        if len(valid) == 0:
            return {}

        total = float(len(valid))
        dist = {}
        for min_s, max_s, label, _ in SLOPE_BINS:
            count = np.sum((valid >= min_s) & (valid < max_s))
            dist[label] = round((count / total) * 100.0, 2)
        return dist

slope_service = SlopeService()
