"""
Regional Elevation Map Rendering and Hypsometric Tinting Service.
"""

from typing import Tuple, Dict, Any
import numpy as np

COLORMAPS = {
    "hypsometric": [
        (0.00, (29, 14, 64, 255)),    # Deep Basin Purple
        (0.20, (43, 73, 132, 255)),   # Navy Blue
        (0.40, (27, 135, 112, 255)),  # Deep Teal
        (0.60, (77, 177, 80, 255)),   # Emerald Green
        (0.80, (214, 211, 56, 255)),  # Yellow Ridge
        (1.00, (255, 255, 255, 255)), # White Peak
    ],
    "viridis": [
        (0.00, (68, 1, 84, 255)),
        (0.25, (59, 82, 139, 255)),
        (0.50, (33, 145, 140, 255)),
        (0.75, (94, 201, 98, 255)),
        (1.00, (253, 231, 37, 255)),
    ],
    "turbo": [
        (0.00, (48, 18, 59, 255)),
        (0.25, (70, 134, 251, 255)),
        (0.50, (27, 229, 181, 255)),
        (0.75, (251, 185, 56, 255)),
        (1.00, (122, 4, 3, 255)),
    ],
    "magma": [
        (0.00, (0, 0, 4, 255)),
        (0.25, (81, 18, 124, 255)),
        (0.50, (182, 54, 121, 255)),
        (0.75, (251, 136, 97, 255)),
        (1.00, (252, 253, 191, 255)),
    ],
}

class ElevationRenderingService:
    @staticmethod
    def render_elevation_rgba(
        elevation: np.ndarray,
        colormap_name: str = "hypsometric",
        min_elev_clip: float = -600.0,
        max_elev_clip: float = 2100.0,
    ) -> np.ndarray:
        """
        Renders an elevation numpy array into an (H, W, 4) uint8 RGBA array.
        Nodata values (NaN) are rendered fully transparent (A=0).
        """
        h, w = elevation.shape
        rgba = np.zeros((h, w, 4), dtype=np.uint8)

        valid_mask = ~np.isnan(elevation)
        if not np.any(valid_mask):
            return rgba

        valid_vals = elevation[valid_mask]
        min_z = float(np.min(valid_vals))
        max_z = float(np.max(valid_vals))

        # Use local dynamic range if valid range exists, clamped to reasonable lunar limits
        if max_z - min_z < 10.0:
            min_z = min_elev_clip
            max_z = max_elev_clip

        norm = np.clip((elevation - min_z) / max(1.0, (max_z - min_z)), 0.0, 1.0)

        stops = COLORMAPS.get(colormap_name, COLORMAPS["hypsometric"])

        # Piecewise linear interpolation across stops
        r_out = np.zeros((h, w), dtype=np.float32)
        g_out = np.zeros((h, w), dtype=np.float32)
        b_out = np.zeros((h, w), dtype=np.float32)

        for i in range(len(stops) - 1):
            t0, c0 = stops[i]
            t1, c1 = stops[i + 1]
            seg_mask = valid_mask & (norm >= t0) & (norm <= t1)
            if not np.any(seg_mask):
                continue
            factor = (norm[seg_mask] - t0) / (t1 - t0)
            r_out[seg_mask] = c0[0] + factor * (c1[0] - c0[0])
            g_out[seg_mask] = c0[1] + factor * (c1[1] - c0[1])
            b_out[seg_mask] = c0[2] + factor * (c1[2] - c0[2])

        rgba[valid_mask, 0] = np.clip(r_out[valid_mask], 0, 255).astype(np.uint8)
        rgba[valid_mask, 1] = np.clip(g_out[valid_mask], 0, 255).astype(np.uint8)
        rgba[valid_mask, 2] = np.clip(b_out[valid_mask], 0, 255).astype(np.uint8)
        rgba[valid_mask, 3] = 255

        return rgba

elevation_rendering_service = ElevationRenderingService()
