import os
from pathlib import Path
from typing import Dict, Any, Optional, Tuple, List
import numpy as np
import rasterio
from rasterio.windows import Window
from rasterio.enums import Resampling

from app.schemas.terrain import (
    DatasetMetadata,
    ProjectedBounds,
    GeographicBounds,
    GeographicCoordinate,
    ElevationStats,
    CompanionProductInfo,
)
from app.services.coordinate_transform import transformer

SITE01_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "lunar" / "site01"

class DemLoaderService:
    def __init__(self, data_dir: Path = SITE01_DIR):
        self.data_dir = data_dir
        self.dataset_id = "site01"
        self.surf_path = data_dir / "Site01_final_adj_5mpp_surf.tif"
        self.ldec_path = data_dir / "Site01_final_adj_5mpp_ldec.tif"
        self.slp_path = data_dir / "Site01_final_adj_5mpp_slp.tif"
        self.toterr_path = data_dir / "Site01_final_adj_5mpp_toterr.tif"
        self.slperr_path = data_dir / "Site01_final_adj_5mpp_slperr.tif"

        self._surf_src = None
        self._ldec_src = None
        self._slp_src = None
        self._toterr_src = None
        self._slperr_src = None

        self._metadata_cache: Optional[DatasetMetadata] = None

    def is_available(self) -> bool:
        return self.surf_path.exists() and self.surf_path.stat().st_size > 1000

    def _ensure_open(self):
        if self._surf_src is None and self.is_available():
            self._surf_src = rasterio.open(self.surf_path)

        if self._ldec_src is None and self.ldec_path.exists():
            self._ldec_src = rasterio.open(self.ldec_path)

        if self._slp_src is None and self.slp_path.exists():
            self._slp_src = rasterio.open(self.slp_path)

        if self._toterr_src is None and self.toterr_path.exists():
            self._toterr_src = rasterio.open(self.toterr_path)

        if self._slperr_src is None and self.slperr_path.exists():
            self._slperr_src = rasterio.open(self.slperr_path)

    def get_metadata(self) -> DatasetMetadata:
        if self._metadata_cache is not None:
            return self._metadata_cache

        self._ensure_open()
        if self._surf_src is None:
            raise FileNotFoundError(f"Site01 surface DEM not found at {self.surf_path}")

        src = self._surf_src
        bounds = src.bounds
        res = src.res

        # Convert 4 corners to geographic lat/lon to compute geographic bounds
        corners_xy = [
            (bounds.left, bounds.bottom),
            (bounds.left, bounds.top),
            (bounds.right, bounds.bottom),
            (bounds.right, bounds.top),
        ]
        corners_geo = [transformer.xy_to_lat_lon(x, y) for x, y in corners_xy]

        min_lat = min(c[0] for c in corners_geo)
        max_lat = max(c[0] for c in corners_geo)
        min_lon = min(c[1] for c in corners_geo)
        max_lon = max(c[1] for c in corners_geo)

        center_x = (bounds.left + bounds.right) / 2.0
        center_y = (bounds.bottom + bounds.top) / 2.0
        center_lat, center_lon = transformer.xy_to_lat_lon(center_x, center_y)

        # Read downsampled slice (1/8th resolution) for quick robust statistics
        downsampled = src.read(
            1,
            out_shape=(src.height // 8, src.width // 8),
            resampling=Resampling.bilinear,
        )
        nodata = src.nodata
        if nodata is not None:
            valid = downsampled[downsampled != nodata]
        else:
            valid = downsampled

        if valid.size > 0:
            min_m = float(np.min(valid))
            max_m = float(np.max(valid))
            mean_m = float(np.mean(valid))
            std_m = float(np.std(valid))
        else:
            min_m, max_m, mean_m, std_m = 0.0, 0.0, 0.0, 0.0

        companions = [
            CompanionProductInfo(
                type="surf",
                filename=self.surf_path.name,
                available=self.surf_path.exists(),
                description="Surface height Z (m) above reference sphere (1737.4 km)",
            ),
            CompanionProductInfo(
                type="ldec",
                filename=self.ldec_path.name,
                available=self.ldec_path.exists(),
                description="Number of LOLA laser returns in each pixel (measurement support)",
            ),
            CompanionProductInfo(
                type="slp",
                filename=self.slp_path.name,
                available=self.slp_path.exists(),
                description="Topographic slope in degrees",
            ),
            CompanionProductInfo(
                type="toterr",
                filename=self.toterr_path.name,
                available=self.toterr_path.exists(),
                description="Total Z uncertainty in meters (RMS error)",
            ),
            CompanionProductInfo(
                type="slperr",
                filename=self.slperr_path.name,
                available=self.slperr_path.exists(),
                description="Slope uncertainty in degrees (RMS error)",
            ),
        ]

        metadata = DatasetMetadata(
            dataset_id=self.dataset_id,
            name="Site 01 (Connecting Ridge)",
            region_name="Lunar South Pole / Shackleton-de Gerlache Connecting Ridge",
            description=(
                "High-resolution 5 m/pixel LOLA digital elevation model for candidate "
                "Artemis landing site 01 (Connecting Ridge). Co-adjusted LOLA ground tracks "
                "with horizontal geolocation uncertainty ~10-20 cm and vertical ~2-4 cm."
            ),
            source_url="https://pgda.gsfc.nasa.gov/products/78",
            publication_ref="Barker et al. (2021), Planetary and Space Science, 203, 105119",
            reference_frame="MOON_ME (Mean Earth / Polar Axis) DE421",
            projection_crs="South Polar Stereographic (Lat_0=-90, Lon_0=0, R=1,737,400 m)",
            pixel_spacing_m=res[0],
            effective_resolution_note=(
                "5 m/pixel grid spacing. ~90% of pixels in LOLA polar grids are interpolated "
                "between tracks. Refer to the LDEC product for laser return counts."
            ),
            dimensions={"width": src.width, "height": src.height, "bands": src.count},
            bounds_projected=ProjectedBounds(
                left=bounds.left,
                bottom=bounds.bottom,
                right=bounds.right,
                top=bounds.top,
            ),
            bounds_geographic=GeographicBounds(
                min_latitude=min_lat,
                max_latitude=max_lat,
                min_longitude=min_lon,
                max_longitude=max_lon,
            ),
            center_geographic=GeographicCoordinate(
                latitude=center_lat,
                longitude=center_lon,
            ),
            elevation_stats=ElevationStats(
                min_m=min_m,
                max_m=max_m,
                mean_m=mean_m,
                std_m=std_m,
                range_m=max_m - min_m,
            ),
            companions=companions,
            quality_summary={
                "interpolation_ratio": "~90%",
                "track_vertical_accuracy_cm": "2 - 4 cm",
                "track_horizontal_accuracy_cm": "10 - 20 cm",
                "data_source": "LRO Lunar Orbiter Laser Altimeter (LOLA)",
            },
        )

        self._metadata_cache = metadata
        return metadata

    def sample_point(self, lat: float, lon: float) -> Dict[str, Any]:
        """
        Samples elevation, slope, count, and uncertainty for given lat/lon.
        """
        self._ensure_open()
        if self._surf_src is None:
            return {
                "in_bounds": False,
                "elevation_m": None,
                "slope_deg": None,
                "lola_count": None,
                "elevation_uncertainty_m": None,
                "slope_uncertainty_deg": None,
                "quality_status": "nodata",
                "note": "DEM file not loaded",
            }

        x, y = transformer.lat_lon_to_xy(lat, lon)
        bounds = self._surf_src.bounds

        if not (bounds.left <= x <= bounds.right and bounds.bottom <= y <= bounds.top):
            return {
                "in_bounds": False,
                "projected_x": x,
                "projected_y": y,
                "elevation_m": None,
                "slope_deg": None,
                "lola_count": None,
                "elevation_uncertainty_m": None,
                "slope_uncertainty_deg": None,
                "quality_status": "out_of_bounds",
                "note": "Coordinate is outside Site01 DEM extent",
            }

        # Sample pixel
        col, row = transformer.xy_to_pixel(x, y, self._surf_src.transform)
        icol, irow = int(round(col)), int(round(row))

        # Clamp to raster boundaries
        icol = max(0, min(self._surf_src.width - 1, icol))
        irow = max(0, min(self._surf_src.height - 1, irow))

        # Read 1x1 window
        w = Window(icol, irow, 1, 1)

        elev_arr = self._surf_src.read(1, window=w)
        elev_val = float(elev_arr[0, 0])
        nodata = self._surf_src.nodata

        if nodata is not None and (elev_val == nodata or np.isnan(elev_val)):
            return {
                "in_bounds": True,
                "projected_x": x,
                "projected_y": y,
                "elevation_m": None,
                "slope_deg": None,
                "lola_count": None,
                "elevation_uncertainty_m": None,
                "slope_uncertainty_deg": None,
                "quality_status": "nodata",
                "note": "Pixel contains NoData",
            }

        # Companion values (with safe try-except guards)
        slope_val = None
        if self._slp_src is not None:
            try:
                slp_arr = self._slp_src.read(1, window=w)
                if slp_arr.size > 0 and slp_arr[0, 0] != self._slp_src.nodata and not np.isnan(slp_arr[0, 0]):
                    slope_val = round(float(slp_arr[0, 0]), 2)
            except Exception:
                slope_val = None

        count_val = None
        if self._ldec_src is not None:
            try:
                ldec_arr = self._ldec_src.read(1, window=w)
                if ldec_arr.size > 0 and ldec_arr[0, 0] != self._ldec_src.nodata and not np.isnan(ldec_arr[0, 0]):
                    count_val = int(ldec_arr[0, 0])
            except Exception:
                count_val = None

        toterr_val = None
        if self._toterr_src is not None:
            try:
                toterr_arr = self._toterr_src.read(1, window=w)
                if toterr_arr.size > 0 and toterr_arr[0, 0] != self._toterr_src.nodata and not np.isnan(toterr_arr[0, 0]):
                    toterr_val = round(float(toterr_arr[0, 0]), 3)
            except Exception:
                toterr_val = None

        slperr_val = None
        if self._slperr_src is not None:
            try:
                slperr_arr = self._slperr_src.read(1, window=w)
                if slperr_arr.size > 0 and slperr_arr[0, 0] != self._slperr_src.nodata and not np.isnan(slperr_arr[0, 0]):
                    slperr_val = round(float(slperr_arr[0, 0]), 3)
            except Exception:
                slperr_val = None

        quality_status = "measured" if (count_val is not None and count_val > 0) else "interpolated"

        return {
            "in_bounds": True,
            "projected_x": round(x, 2),
            "projected_y": round(y, 2),
            "elevation_m": round(elev_val, 3),
            "slope_deg": slope_val,
            "lola_count": count_val,
            "elevation_uncertainty_m": toterr_val,
            "slope_uncertainty_deg": slperr_val,
            "quality_status": quality_status,
            "note": f"Site01 {quality_status} elevation data",
        }

    def get_downsampled_grid(
        self,
        lod: str = "medium",
        max_dim: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Extracts bounded, downsampled elevation grid.
        LODs:
        - 'low': ~64x64 grid (fast overview)
        - 'medium': ~128x128 grid (balanced)
        - 'high': ~256x256 grid (high detail inspection)
        """
        self._ensure_open()
        if self._surf_src is None:
            raise FileNotFoundError("Site01 surface DEM is not loaded.")

        src = self._surf_src
        target_size = 128
        if lod == "low":
            target_size = 64
        elif lod == "high":
            target_size = 256

        if max_dim is not None:
            target_size = min(max_dim, target_size)

        # Aspect ratio preservation
        aspect = src.width / src.height
        if aspect >= 1.0:
            out_w = target_size
            out_h = max(16, int(target_size / aspect))
        else:
            out_h = target_size
            out_w = max(16, int(target_size * aspect))

        data = src.read(
            1,
            out_shape=(out_h, out_w),
            resampling=Resampling.bilinear,
        )

        nodata = src.nodata
        valid_mask = np.ones_like(data, dtype=bool)
        if nodata is not None:
            valid_mask = (data != nodata) & (~np.isnan(data))

        # Convert to serializable nested list with None for nodata
        elevations: List[List[Optional[float]]] = []
        for r in range(out_h):
            row_vals: List[Optional[float]] = []
            for c in range(out_w):
                if valid_mask[r, c]:
                    row_vals.append(round(float(data[r, c]), 2))
                else:
                    row_vals.append(None)
            elevations.append(row_vals)

        valid_elevs = data[valid_mask]
        min_elev = float(np.min(valid_elevs)) if valid_elevs.size > 0 else 0.0
        max_elev = float(np.max(valid_elevs)) if valid_elevs.size > 0 else 0.0

        meta = self.get_metadata()

        return {
            "dataset_id": self.dataset_id,
            "lod": lod,
            "grid_width": out_w,
            "grid_height": out_h,
            "bounds_projected": meta.bounds_projected.model_dump(),
            "bounds_geographic": meta.bounds_geographic.model_dump(),
            "center_geographic": meta.center_geographic.model_dump(),
            "elevations": elevations,
            "min_elevation": min_elev,
            "max_elevation": max_elev,
            "reference_radius_m": 1737400.0,
            "quality_summary": meta.quality_summary,
        }

dem_loader = DemLoaderService()
