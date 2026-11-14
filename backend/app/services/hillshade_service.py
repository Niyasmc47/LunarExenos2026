"""
Cartographic Hillshade Generation Service from NASA Lunar DEMs.
Clearly distinguished from time-dependent lunar ephemeris solar shadow calculations.
"""

import math
import numpy as np
from scipy.ndimage import sobel

class HillshadeService:
    @staticmethod
    def generate_hillshade_rgba(
        dem: np.ndarray,
        pixel_spacing_m: float = 5.0,
        azimuth_deg: float = 315.0,
        altitude_deg: float = 45.0,
        z_factor: float = 1.0,
    ) -> np.ndarray:
        """
        Generates an RGBA hillshade raster with transparent nodata pixels.
        """
        h, w = dem.shape
        rgba = np.zeros((h, w, 4), dtype=np.uint8)

        valid_mask = ~np.isnan(dem)
        if not np.any(valid_mask):
            return rgba

        clean_dem = dem.copy()
        clean_dem[~valid_mask] = float(np.nanmean(dem))

        # Sobel gradients
        dz_dx = (sobel(clean_dem, axis=1) / (8.0 * pixel_spacing_m)) * z_factor
        dz_dy = (sobel(clean_dem, axis=0) / (8.0 * pixel_spacing_m)) * z_factor

        slope_rad = np.arctan(np.hypot(dz_dx, dz_dy))
        aspect_rad = np.arctan2(dz_dy, -dz_dx)

        # Solar angles converted to radians
        zenith_rad = math.radians(90.0 - altitude_deg)
        # Azimuth converted to mathematical angle
        azimuth_math_rad = math.radians((360.0 - azimuth_deg + 90.0) % 360.0)

        # Hillshade equation
        shaded = (
            math.cos(zenith_rad) * np.cos(slope_rad)
            + math.sin(zenith_rad) * np.sin(slope_rad) * np.cos(azimuth_math_rad - aspect_rad)
        )

        shaded = np.clip(shaded, 0.0, 1.0)
        shaded_uint8 = (shaded * 255.0).astype(np.uint8)

        # Set RGB to grayscale shaded value, Alpha to 255 for valid pixels
        rgba[valid_mask, 0] = shaded_uint8[valid_mask]
        rgba[valid_mask, 1] = shaded_uint8[valid_mask]
        rgba[valid_mask, 2] = shaded_uint8[valid_mask]
        rgba[valid_mask, 3] = 240

        return rgba

hillshade_service = HillshadeService()
