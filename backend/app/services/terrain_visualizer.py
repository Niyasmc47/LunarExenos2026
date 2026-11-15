import io
from pathlib import Path
from typing import Optional, Dict
import numpy as np
from PIL import Image
from app.services.dem_loader import dem_loader, get_dem_loader

class TerrainVisualizerService:
    def __init__(self):
        self._elevation_cache: Dict[str, bytes] = {}
        self._slope_cache: Dict[str, bytes] = {}

    def get_elevation_overlay_png(self, width: int = 512, height: int = 512, site_id: str = "site01") -> bytes:
        cache_key = f"{site_id}_{width}_{height}"
        if cache_key in self._elevation_cache:
            return self._elevation_cache[cache_key]

        loader = get_dem_loader(site_id)
        loader._ensure_open()
        if loader._surf_src is None:
            raise FileNotFoundError(f"{site_id.capitalize()} surface DEM is not loaded.")

        src = loader._surf_src
        data = src.read(1, out_shape=(height, width))
        nodata = src.nodata

        valid_mask = np.ones_like(data, dtype=bool)
        if nodata is not None:
            valid_mask = (data != nodata) & (~np.isnan(data))
        else:
            valid_mask = ~np.isnan(data)

        valid_vals = data[valid_mask]
        if valid_vals.size == 0:
            min_val, max_val = 0.0, 1.0
        else:
            min_val = float(np.min(valid_vals))
            max_val = float(np.max(valid_vals))

        norm = np.clip((data - min_val) / (max_val - min_val + 1e-6), 0.0, 1.0)

        # Scientific lunar elevation colormap: deep violet/blue (low basin) -> cyan -> emerald -> golden yellow -> white (ridge peaks)
        rgba = np.zeros((height, width, 4), dtype=np.uint8)

        # RGB interpolation
        r = np.clip(1.5 * norm - 0.2, 0.0, 1.0)
        g = np.clip(np.sin(norm * np.pi), 0.0, 1.0)
        b = np.clip(1.0 - 1.2 * norm, 0.0, 1.0)

        # High peaks get brighter
        r = np.where(norm > 0.8, 1.0, r)
        g = np.where(norm > 0.8, 0.8 + 0.2 * norm, g)
        b = np.where(norm > 0.8, 0.8 + 0.2 * norm, b)

        rgba[:, :, 0] = (r * 255).astype(np.uint8)
        rgba[:, :, 1] = (g * 255).astype(np.uint8)
        rgba[:, :, 2] = (b * 255).astype(np.uint8)
        rgba[:, :, 3] = np.where(valid_mask, 210, 0).astype(np.uint8) # 82% opacity on valid data, 0 on nodata

        img = Image.fromarray(rgba, "RGBA")
        buf = io.BytesIO()
        img.save(buf, format="PNG", optimize=True)
        png_bytes = buf.getvalue()
        self._elevation_cache[cache_key] = png_bytes
        return png_bytes

    def get_slope_overlay_png(self, width: int = 512, height: int = 512, site_id: str = "site01") -> bytes:
        cache_key = f"{site_id}_{width}_{height}"
        if cache_key in self._slope_cache:
            return self._slope_cache[cache_key]

        loader = get_dem_loader(site_id)
        loader._ensure_open()
        if loader._slp_src is None:
            if loader._surf_src is None:
                raise FileNotFoundError(f"{site_id.capitalize()} DEM is not loaded.")
            # If slope file not downloaded, derive slope gradient from elevation
            elev_data = loader._surf_src.read(1, out_shape=(height, width))
            dy, dx = np.gradient(elev_data, 5.0)
            slope_rad = np.arctan(np.sqrt(dx**2 + dy**2))
            slope_deg = np.degrees(slope_rad)
        else:
            slope_deg = loader._slp_src.read(1, out_shape=(height, width))

        # Landing hazard colormap:
        # 0° - 5°: Safe (Green)
        # 5° - 15°: Moderate caution (Yellow/Orange)
        # > 15°: Hazardous landing slope (Red/Dark Red)
        rgba = np.zeros((height, width, 4), dtype=np.uint8)
        valid_mask = ~np.isnan(slope_deg) & (slope_deg >= 0) & (slope_deg <= 90)

        r = np.clip(slope_deg / 15.0, 0.0, 1.0)
        g = np.clip(1.0 - (slope_deg - 5.0) / 15.0, 0.0, 1.0)
        b = np.zeros_like(r)

        rgba[:, :, 0] = (r * 255).astype(np.uint8)
        rgba[:, :, 1] = (g * 255).astype(np.uint8)
        rgba[:, :, 2] = (b * 255).astype(np.uint8)
        rgba[:, :, 3] = np.where(valid_mask, 200, 0).astype(np.uint8)

        img = Image.fromarray(rgba, "RGBA")
        buf = io.BytesIO()
        img.save(buf, format="PNG", optimize=True)
        png_bytes = buf.getvalue()
        self._slope_png_cache = png_bytes
        return png_bytes

terrain_visualizer = TerrainVisualizerService()
