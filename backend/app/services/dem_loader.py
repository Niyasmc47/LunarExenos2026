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
LUNAR_BASE_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "lunar"

SITE_CONFIGS = {
    "site01": {
        "nasa_name": "Site01",
        "name": "Site 01 (Connecting Ridge)",
        "region_name": "Connecting Ridge (Shackleton-de Gerlache)",
        "description": (
            "High-resolution 5 m/pixel LOLA digital elevation model for candidate "
            "Artemis landing site 01 (Connecting Ridge). Co-adjusted LOLA ground tracks "
            "with horizontal geolocation uncertainty ~10-20 cm and vertical ~2-4 cm."
        ),
        "citation": "Barker et al. (2021), Planetary and Space Science, 203, 105119",
    },
    "site04": {
        "nasa_name": "Site04",
        "name": "Site 04 (Shackleton Rim)",
        "region_name": "Shackleton Crater Rim",
        "description": (
            "High-resolution 5 m/pixel LOLA digital elevation model for candidate "
            "Artemis landing site 04 (Shackleton Rim). Includes deep permanently shadowed "
            "regions and peaks of prolonged solar illumination at the lunar South Pole."
        ),
        "citation": "Barker et al. (2021), Planetary and Space Science, 203, 105119",
    },
    "site11": {
        "nasa_name": "Site11",
        "name": "Site 11 (de Gerlache Rim)",
        "region_name": "de Gerlache Crater Rim",
        "description": (
            "High-resolution 5 m/pixel LOLA digital elevation model for candidate "
            "Artemis landing site 11 (de Gerlache Rim). High-elevation rim overlooking "
            "crater interior permanently shadowed areas."
        ),
        "citation": "Barker et al. (2021), Planetary and Space Science, 203, 105119",
    },
}

class DemLoaderService:
    def __init__(self, site_id: str = "site01", data_dir: Optional[Path] = None):
        self.site_id = site_id.lower().strip()
        self.dataset_id = self.site_id
        
        cfg = SITE_CONFIGS.get(self.site_id, {
            "nasa_name": self.site_id.capitalize(),
            "name": f"Site {self.site_id}",
            "region_name": f"Lunar South Pole ({self.site_id})",
            "description": f"NASA LOLA 5 m/pixel DEM product for {self.site_id}",
            "citation": "Barker et al. (2021), PSS 203, 105119",
        })
        self.cfg = cfg
        nasa_pfx = cfg["nasa_name"]

        if data_dir is not None:
            self.data_dir = Path(data_dir)
        else:
            sites_path = LUNAR_BASE_DIR / "sites" / self.site_id
            legacy_path = LUNAR_BASE_DIR / self.site_id
            self.data_dir = sites_path if sites_path.exists() else legacy_path

        prefix = f"{nasa_pfx}_final_adj_5mpp_"
        self.surf_path = self._resolve_file(f"{prefix}surf.tif")
        self.ldec_path = self._resolve_file(f"{prefix}ldec.tif")
        self.slp_path = self._resolve_file(f"{prefix}slp.tif")
        self.toterr_path = self._resolve_file(f"{prefix}toterr.tif")
        self.slperr_path = self._resolve_file(f"{prefix}slperr.tif")

        self._surf_src = None
        self._ldec_src = None
        self._slp_src = None
        self._toterr_src = None
        self._slperr_src = None

        self._metadata_cache: Optional[DatasetMetadata] = None

    def _resolve_file(self, filename: str) -> Path:
        """Finds file in sites/{site_id} or legacy {site_id} directory."""
        p1 = LUNAR_BASE_DIR / "sites" / self.site_id / filename
        if p1.exists():
            return p1
        p2 = LUNAR_BASE_DIR / self.site_id / filename
        if p2.exists():
            return p2
        return p1

    def is_available(self) -> bool:
        return self.surf_path.exists() and self.surf_path.stat().st_size > 1000

    def _ensure_open(self):
        if self._surf_src is None and self.is_available():
            self._surf_src = rasterio.open(self.surf_path)

        if self._ldec_src is None and self.ldec_path.exists() and self.ldec_path.stat().st_size > 1000:
            try:
                self._ldec_src = rasterio.open(self.ldec_path)
            except Exception:
                self._ldec_src = None

        if self._slp_src is None and self.slp_path.exists() and self.slp_path.stat().st_size > 1000:
            try:
                self._slp_src = rasterio.open(self.slp_path)
            except Exception:
                self._slp_src = None

        if self._toterr_src is None and self.toterr_path.exists() and self.toterr_path.stat().st_size > 1000:
            try:
                self._toterr_src = rasterio.open(self.toterr_path)
            except Exception:
                self._toterr_src = None

        if self._slperr_src is None and self.slperr_path.exists() and self.slperr_path.stat().st_size > 1000:
            try:
                self._slperr_src = rasterio.open(self.slperr_path)
            except Exception:
                self._slperr_src = None

    def contains_coord(self, lat: float, lon: float) -> bool:
        """Returns True if the lat/lon coordinate falls within this site's projected DEM bounds."""
        if not self.is_available():
            return False
        self._ensure_open()
        if self._surf_src is None:
            return False
        x, y = transformer.lat_lon_to_xy(lat, lon)
        b = self._surf_src.bounds
        return (b.left <= x <= b.right) and (b.bottom <= y <= b.top)

    def get_metadata(self) -> DatasetMetadata:
        if self._metadata_cache is not None:
            return self._metadata_cache

        self._ensure_open()
        if self._surf_src is None:
            raise FileNotFoundError(f"{self.site_id.capitalize()} surface DEM not found at {self.surf_path}")

        src = self._surf_src
        bounds = src.bounds
        res = src.res

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
            valid = downsampled[(downsampled != nodata) & (~np.isnan(downsampled))]
        else:
            valid = downsampled[~np.isnan(downsampled)]

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
                available=self.ldec_path.exists() and self.ldec_path.stat().st_size > 1000,
                description="Number of LOLA laser returns in each pixel (measurement support)",
            ),
            CompanionProductInfo(
                type="slp",
                filename=self.slp_path.name,
                available=self.slp_path.exists() and self.slp_path.stat().st_size > 1000,
                description="Topographic slope in degrees",
            ),
            CompanionProductInfo(
                type="toterr",
                filename=self.toterr_path.name,
                available=self.toterr_path.exists() and self.toterr_path.stat().st_size > 1000,
                description="Total Z uncertainty in meters (RMS error)",
            ),
            CompanionProductInfo(
                type="slperr",
                filename=self.slperr_path.name,
                available=self.slperr_path.exists() and self.slperr_path.stat().st_size > 1000,
                description="Slope uncertainty in degrees (RMS error)",
            ),
        ]

        metadata = DatasetMetadata(
            dataset_id=self.dataset_id,
            name=self.cfg["name"],
            region_name=self.cfg["region_name"],
            description=self.cfg["description"],
            source_url="https://pgda.gsfc.nasa.gov/products/78",
            publication_ref=self.cfg["citation"],
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
                "data_source": "LRO Lunar Orbiter Laser Altimeter (LOLA) Product 78",
                "plain_language_vertical_datum": "Elevation is relative to IAU Moon 2000 reference sphere (R=1,737,400 m). Not spacecraft altitude.",
                "plain_language_slope": "Ground inclination in degrees. Steeper terrain increases landing risk.",
            },
        )

        self._metadata_cache = metadata
        return metadata

    def sample_point(self, lat: float, lon: float, site_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Samples elevation, slope, count, and uncertainty for given lat/lon.
        Supports multi-site routing: if requested site differs or coordinates lie
        inside another registered site, automatically delegates.
        """
        if site_id:
            normalized_site = site_id.lower().strip()
            if normalized_site != self.dataset_id:
                return get_dem_loader(normalized_site).sample_point(lat, lon)

        self._ensure_open()
        if self._surf_src is None:
            return {
                "in_bounds": False,
                "site_id": self.dataset_id,
                "elevation_m": None,
                "slope_deg": None,
                "lola_count": None,
                "elevation_uncertainty_m": None,
                "slope_uncertainty_deg": None,
                "quality_status": "nodata",
                "note": f"DEM file not loaded for {self.dataset_id}",
            }

        # Check if point falls inside this site
        if not self.contains_coord(lat, lon):
            # Check if another registered site contains this point
            for sid in ["site01", "site04", "site11"]:
                if sid != self.dataset_id:
                    other_loader = get_dem_loader(sid)
                    if other_loader.is_available() and other_loader.contains_coord(lat, lon):
                        return other_loader.sample_point(lat, lon)

            x, y = transformer.lat_lon_to_xy(lat, lon)
            return {
                "in_bounds": False,
                "site_id": self.dataset_id,
                "projected_x": x,
                "projected_y": y,
                "elevation_m": None,
                "slope_deg": None,
                "lola_count": None,
                "elevation_uncertainty_m": None,
                "slope_uncertainty_deg": None,
                "quality_status": "out_of_bounds",
                "note": f"Coordinate ({lat:.4f}°, {lon:.4f}°) is outside {self.cfg['name']} DEM coverage",
            }

        x, y = transformer.lat_lon_to_xy(lat, lon)
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
                "site_id": self.dataset_id,
                "projected_x": round(x, 2),
                "projected_y": round(y, 2),
                "elevation_m": None,
                "slope_deg": None,
                "lola_count": None,
                "elevation_uncertainty_m": None,
                "slope_uncertainty_deg": None,
                "quality_status": "nodata",
                "note": "Pixel contains NoData",
            }

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
            "site_id": self.dataset_id,
            "site_name": self.cfg["name"],
            "projected_x": round(x, 2),
            "projected_y": round(y, 2),
            "elevation_m": round(elev_val, 3),
            "slope_deg": slope_val,
            "lola_count": count_val,
            "elevation_uncertainty_m": toterr_val,
            "slope_uncertainty_deg": slperr_val,
            "quality_status": quality_status,
            "plain_language_elevation": f"Surface is {round(elev_val / 1000, 2)} km relative to lunar reference sphere. Not spacecraft altitude.",
            "plain_language_slope": f"Ground inclination is {slope_val}°." if slope_val is not None else "Slope unavailable.",
            "note": f"{self.cfg['name']} {quality_status} elevation data",
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
            raise FileNotFoundError(f"{self.site_id.capitalize()} surface DEM is not loaded.")

        src = self._surf_src
        target_size = 128
        if lod == "low":
            target_size = 64
        elif lod == "high":
            target_size = 256

        if max_dim is not None:
            target_size = min(max_dim, target_size)

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
        else:
            valid_mask = ~np.isnan(data)

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
            "site_id": self.dataset_id,
            "site_name": self.cfg["name"],
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

# Global loaders cache
_LOADERS: Dict[str, DemLoaderService] = {}

def get_dem_loader(site_id: str = "site01") -> DemLoaderService:
    sid = site_id.lower().strip() if site_id else "site01"
    if sid not in _LOADERS:
        _LOADERS[sid] = DemLoaderService(site_id=sid)
    return _LOADERS[sid]

def find_dem_loader_for_coords(lat: float, lon: float) -> Optional[DemLoaderService]:
    for sid in ["site01", "site04", "site11"]:
        loader = get_dem_loader(sid)
        if loader.is_available() and loader.contains_coord(lat, lon):
            return loader
    return None

def list_available_sites() -> List[str]:
    avail = []
    for sid in ["site01", "site04", "site11"]:
        loader = get_dem_loader(sid)
        if loader.is_available():
            avail.append(sid)
    return avail

# Primary backward-compatible singleton
dem_loader = get_dem_loader("site01")
