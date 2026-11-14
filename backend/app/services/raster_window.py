"""
Windowed raster reader supporting local GeoTIFFs and remote Cloud Optimized GeoTIFFs via GDAL /vsicurl/.
"""

import math
from typing import Dict, Optional, Tuple, Any
import numpy as np
import rasterio
from rasterio.windows import Window
from rasterio.enums import Resampling
from rasterio.warp import reproject

from app.services.dataset_catalogue import catalogue_service
from app.services.coordinate_transform import (
    lat_lon_to_stereographic,
    transformer,
    LUNAR_RADIUS_M,
)

class RasterWindowService:
    def __init__(self):
        self.catalogue = catalogue_service

    def _get_dataset_paths(self, dataset_id: str) -> Tuple[str, Optional[str]]:
        """Resolves local file path or /vsicurl/ remote URL for elevation and slope."""
        record = self.catalogue.get_by_id(dataset_id)
        if not record:
            # Default fallback to site01 if unknown
            record = self.catalogue.get_by_id("site01")

        if record.is_local_available and record.local_surf_path:
            surf_path = record.local_surf_path
            slp_path = record.local_slp_path
        else:
            surf_url = record.remote_surf_url or "https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/87S/ldem_87s_5mpp.tif"
            slp_url = record.remote_slp_url
            surf_path = f"/vsicurl/{surf_url}"
            slp_path = f"/vsicurl/{slp_url}" if slp_url else None

        return surf_path, slp_path

    def read_window_geographic(
        self,
        dataset_id: str,
        min_lat: float,
        max_lat: float,
        min_lon: float,
        max_lon: float,
        target_width: int = 512,
        target_height: int = 512,
    ) -> Dict[str, Any]:
        """
        Reads a window corresponding to a geographic bounding box and resamples it to target dimensions.
        Returns elevation array, slope array (if available), actual bounds, and statistics.
        """
        surf_path, slp_path = self._get_dataset_paths(dataset_id)

        # Convert geographic corners to South Polar Stereographic (meters)
        lats = [min_lat, max_lat, (min_lat + max_lat) / 2.0]
        lons = [min_lon, max_lon, (min_lon + max_lon) / 2.0]
        xs = []
        ys = []

        for lat in lats:
            for lon in lons:
                x, y = lat_lon_to_stereographic(lat, lon)
                xs.append(x)
                ys.append(y)

        left = min(xs)
        right = max(xs)
        bottom = min(ys)
        top = max(ys)

        try:
            with rasterio.open(surf_path) as src:
                transform = src.transform
                nodata = src.nodata if src.nodata is not None else -32767.0

                # Convert bounding box to pixel coordinates
                c_min, r_max = transformer.xy_to_pixel(left, bottom, transform)
                c_max, r_min = transformer.xy_to_pixel(right, top, transform)

                col_start = int(math.floor(min(c_min, c_max)))
                col_end = int(math.ceil(max(c_min, c_max)))
                row_start = int(math.floor(min(r_min, r_max)))
                row_end = int(math.ceil(max(r_min, r_max)))

                src_w = src.width
                src_h = src.height

                # Check if region intersects raster at all
                if col_end <= 0 or col_start >= src_w or row_end <= 0 or row_start >= src_h:
                    empty_elev = np.full((target_height, target_width), np.nan, dtype=np.float32)
                    return {
                        "elevation": empty_elev,
                        "slope": None,
                        "is_slope_nasa": False,
                        "nodata_value": nodata,
                        "bounds_projected": {"left": left, "bottom": bottom, "right": right, "top": top},
                        "has_valid_data": False,
                    }

                # Clamp window to raster bounds
                win_col = max(0, col_start)
                win_row = max(0, row_start)
                win_w = max(1, min(src_w, col_end) - win_col)
                win_h = max(1, min(src_h, row_end) - win_row)

                window = Window(win_col, win_row, win_w, win_h)

                # Read elevation with automatic downsampling to target dimension
                elev = src.read(
                    1,
                    window=window,
                    out_shape=(target_height, target_width),
                    resampling=Resampling.bilinear,
                ).astype(np.float32)

                # Mask nodata
                if nodata is not None:
                    elev[elev == nodata] = np.nan
                    elev[elev < -20000.0] = np.nan

        except Exception as e:
            # Fallback for connectivity / range request error
            print(f"[RasterWindowService] Error opening {surf_path}: {e}")
            elev = np.full((target_height, target_width), np.nan, dtype=np.float32)

        # Now attempt to read slope from companion file if available
        slope = None
        is_slope_nasa = False

        if slp_path:
            try:
                with rasterio.open(slp_path) as slp_src:
                    slp_win = Window(win_col, win_row, win_w, win_h)
                    slope_raw = slp_src.read(
                        1,
                        window=slp_win,
                        out_shape=(target_height, target_width),
                        resampling=Resampling.bilinear,
                    ).astype(np.float32)

                    slp_nodata = slp_src.nodata if slp_src.nodata is not None else -32767.0
                    slope_raw[slope_raw == slp_nodata] = np.nan
                    slope_raw[slope_raw < 0.0] = np.nan
                    slope_raw[slope_raw > 90.0] = np.nan
                    slope = slope_raw
                    is_slope_nasa = True
            except Exception as e:
                print(f"[RasterWindowService] Slope read failed from {slp_path}: {e}")
                slope = None

        has_valid = bool(np.any(~np.isnan(elev)))

        return {
            "elevation": elev,
            "slope": slope,
            "is_slope_nasa": is_slope_nasa,
            "nodata_value": nodata,
            "bounds_projected": {"left": left, "bottom": bottom, "right": right, "top": top},
            "has_valid_data": has_valid,
        }

raster_window_service = RasterWindowService()
