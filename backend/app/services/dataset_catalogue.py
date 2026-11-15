"""
Scientific catalogue and metadata registry for NASA Lunar Reconnaissance Orbiter (LRO)
LOLA elevation and slope products.
"""

import os
from typing import Dict, List, Optional
from app.schemas.dataset import DatasetRecord

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../data/lunar"))

# Official scientific citations
CITATION_BARKER_2021 = (
    "Barker, M. K., et al. (2021). Improved LOLA Elevation Maps for South Pole Landing Sites: "
    "Error Estimates and Their Impact on Illumination Conditions. Planetary and Space Science, 203, 105119. "
    "https://doi.org/10.1016/j.pss.2020.105119"
)

CITATION_BARKER_2023 = (
    "Barker, M. K., et al. (2023). A New View of the Lunar South Pole from LOLA. "
    "The Planetary Science Journal, 4(10), 183. https://doi.org/10.3847/PSJ/acf058"
)

CITATION_MAZARICO_2011 = (
    "Mazarico, E., et al. (2011). Illumination conditions of the lunar polar regions using LOLA topography. "
    "Icarus, 211(2), 1066-1081. https://doi.org/10.1016/j.icarus.2010.10.030"
)

# Registry of verified NASA LOLA datasets
DATASET_REGISTRY: Dict[str, DatasetRecord] = {
    # -------------------------------------------------------------
    # NASA PGDA Product 78: High-Resolution Sites (5 m/pixel)
    # -------------------------------------------------------------
    "site01": DatasetRecord(
        dataset_id="site01",
        product_series="PGDA-78",
        name="Site 01 — Connecting Ridge",
        region_name="Connecting Ridge (Shackleton-de Gerlache)",
        description="NASA candidate Artemis landing site along the ridge connecting Shackleton and de Gerlache craters.",
        source_url="https://pgda.gsfc.nasa.gov/products/78",
        citation=CITATION_BARKER_2021,
        reference_frame="MOON_ME (DE421)",
        projection_crs="+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs",
        nominal_pixel_spacing_m=5.0,
        effective_resolution_note="LOLA laser ground track spacing ~10-20 m; ~90% of raster pixels interpolated via Delaunay triangulation.",
        bounds_projected={"left": -19000.0, "bottom": -20000.0, "right": -3000.0, "top": -4000.0},
        bounds_geographic={"min_lat": -89.8351, "max_lat": -89.0903, "min_lon": -171.4692, "max_lon": -101.8887},
        elevation_datum="Sphere R = 1,737,400 m",
        elevation_units="meters",
        nodata_value=-32767.0,
        file_size_mb=40.98,
        access_method="local",
        is_local_available=True,
        local_surf_path=os.path.join(DATA_DIR, "sites/site01/Site01_final_adj_5mpp_surf.tif") if os.path.exists(os.path.join(DATA_DIR, "sites/site01/Site01_final_adj_5mpp_surf.tif")) else os.path.join(DATA_DIR, "site01/Site01_final_adj_5mpp_surf.tif"),
        local_slp_path=os.path.join(DATA_DIR, "sites/site01/Site01_final_adj_5mpp_slp.tif") if os.path.exists(os.path.join(DATA_DIR, "sites/site01/Site01_final_adj_5mpp_slp.tif")) else os.path.join(DATA_DIR, "site01/Site01_final_adj_5mpp_slp.tif"),
        remote_surf_url="https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site01/Site01_final_adj_5mpp_surf.tif",
        remote_slp_url="https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site01/Site01_final_adj_5mpp_slp.tif",
        companion_layers=["surface", "slope", "count", "toterr", "slperr"],
        quality_notes=[
            "Verified NASA PGDA Product 78 product.",
            "Includes co-registered NASA 5 m/pixel slope GeoTIFF.",
        ],
    ),
    "site04": DatasetRecord(
        dataset_id="site04",
        product_series="PGDA-78",
        name="Site 04 — Shackleton Rim",
        region_name="Shackleton Crater Rim",
        description="Peak of eternal light candidate and permanently shadowed crater interior at the exact South Pole.",
        source_url="https://pgda.gsfc.nasa.gov/products/78",
        citation=CITATION_BARKER_2021,
        reference_frame="MOON_ME (DE421)",
        projection_crs="+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs",
        nominal_pixel_spacing_m=5.0,
        effective_resolution_note="LOLA laser ground track spacing ~10-20 m; interpolated raster grid.",
        bounds_projected={"left": -9000.0, "bottom": -15000.0, "right": 7000.0, "top": 1000.0},
        bounds_geographic={"min_lat": -89.99, "max_lat": -89.4231, "min_lon": -180.0, "max_lon": 180.0},
        elevation_datum="Sphere R = 1,737,400 m",
        elevation_units="meters",
        nodata_value=-32767.0,
        file_size_mb=39.08,
        access_method="local",
        is_local_available=True,
        local_surf_path=os.path.join(DATA_DIR, "sites/site04/Site04_final_adj_5mpp_surf.tif") if os.path.exists(os.path.join(DATA_DIR, "sites/site04/Site04_final_adj_5mpp_surf.tif")) else os.path.join(DATA_DIR, "site04/Site04_final_adj_5mpp_surf.tif"),
        local_slp_path=os.path.join(DATA_DIR, "sites/site04/Site04_final_adj_5mpp_slp.tif") if os.path.exists(os.path.join(DATA_DIR, "sites/site04/Site04_final_adj_5mpp_slp.tif")) else os.path.join(DATA_DIR, "site04/Site04_final_adj_5mpp_slp.tif"),
        remote_surf_url="https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site04/Site04_final_adj_5mpp_surf.tif",
        remote_slp_url="https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site04/Site04_final_adj_5mpp_slp.tif",
        companion_layers=["surface", "slope", "count", "toterr", "slperr"],
        quality_notes=[
            "Verified NASA PGDA Product 78 product.",
            "Includes co-registered NASA 5 m/pixel slope and ROI polygons.",
        ],
    ),
    "site11": DatasetRecord(
        dataset_id="site11",
        product_series="PGDA-78",
        name="Site 11 — de Gerlache Rim",
        region_name="de Gerlache Crater Rim",
        description="High-elevation rim overlooking deep permanently shadowed regions of de Gerlache crater.",
        source_url="https://pgda.gsfc.nasa.gov/products/78",
        citation=CITATION_BARKER_2021,
        reference_frame="MOON_ME (DE421)",
        projection_crs="+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs",
        nominal_pixel_spacing_m=5.0,
        effective_resolution_note="5 m pixel spacing; ~90% interpolated between ground tracks.",
        bounds_projected={"left": -45000.0, "bottom": 7000.0, "right": -29000.0, "top": 23000.0},
        bounds_geographic={"min_lat": -88.7794, "max_lat": -88.4982, "min_lon": -81.1582, "max_lon": -51.5819},
        elevation_datum="Sphere R = 1,737,400 m",
        elevation_units="meters",
        nodata_value=-32767.0,
        file_size_mb=39.08,
        access_method="local",
        is_local_available=True,
        local_surf_path=os.path.join(DATA_DIR, "sites/site11/Site11_final_adj_5mpp_surf.tif") if os.path.exists(os.path.join(DATA_DIR, "sites/site11/Site11_final_adj_5mpp_surf.tif")) else os.path.join(DATA_DIR, "site11/Site11_final_adj_5mpp_surf.tif"),
        local_slp_path=os.path.join(DATA_DIR, "sites/site11/Site11_final_adj_5mpp_slp.tif") if os.path.exists(os.path.join(DATA_DIR, "sites/site11/Site11_final_adj_5mpp_slp.tif")) else os.path.join(DATA_DIR, "site11/Site11_final_adj_5mpp_slp.tif"),
        remote_surf_url="https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site11/Site11_final_adj_5mpp_surf.tif",
        remote_slp_url="https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site11/Site11_final_adj_5mpp_slp.tif",
        companion_layers=["surface", "slope", "count", "toterr", "slperr"],
        quality_notes=[
            "Verified NASA PGDA Product 78 product.",
            "Includes co-registered NASA 5 m/pixel slope and ROI polygons.",
        ],
    ),
    "site23": DatasetRecord(
        dataset_id="site23",
        product_series="PGDA-78",
        name="Site 23 — Malapert Massif",
        region_name="Malapert Mountain (Massif)",
        description="Prominent 5,000 m mountain with direct, continuous line-of-sight communication to Earth.",
        source_url="https://pgda.gsfc.nasa.gov/products/78",
        citation=CITATION_BARKER_2021,
        reference_frame="MOON_ME (DE421)",
        projection_crs="+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs",
        nominal_pixel_spacing_m=5.0,
        effective_resolution_note="5 m grid spacing with high density near Artemis candidate landing zones.",
        bounds_projected={"left": -10000.0, "bottom": 85000.0, "right": 25000.0, "top": 120000.0},
        bounds_geographic={"min_lat": -86.50, "max_lat": -85.10, "min_lon": -5.0, "max_lon": 25.0},
        elevation_datum="Sphere R = 1,737,400 m",
        elevation_units="meters",
        nodata_value=-32767.0,
        file_size_mb=67.3,
        access_method="cog_range",
        is_local_available=False,
        remote_surf_url="https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site23/Site23_final_adj_5mpp_surf.tif",
        remote_slp_url="https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site23/Site23_final_adj_5mpp_slp.tif",
        companion_layers=["surface", "slope"],
        quality_notes=["Massif terrain, primary Earth-direct line of sight."],
    ),
    # -------------------------------------------------------------
    # NASA PGDA Product 81: South Pole 87–90°S Mosaic (5 m/pixel)
    # -------------------------------------------------------------
    "spole_87s_5mpp": DatasetRecord(
        dataset_id="spole_87s_5mpp",
        product_series="PGDA-81",
        name="South Pole 87–90°S LOLA Mosaic (5m/px)",
        region_name="Circumpolar South Pole Cap (87°S to 90°S)",
        description="Comprehensive 5 m/pixel Cloud Optimized GeoTIFF mosaic covering 200 km × 200 km around the South Pole.",
        source_url="https://pgda.gsfc.nasa.gov/products/81",
        citation=CITATION_BARKER_2021,
        reference_frame="MOON_ME (DE421)",
        projection_crs="+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs",
        nominal_pixel_spacing_m=5.0,
        effective_resolution_note="Nominal 5 m grid; ~90% interpolated between track orbits. Streamed on demand via HTTP range requests.",
        bounds_projected={"left": -100000.0, "bottom": -100000.0, "right": 100000.0, "top": 100000.0},
        bounds_geographic={"min_lat": -90.0, "max_lat": -86.70, "min_lon": -180.0, "max_lon": 180.0},
        elevation_datum="Sphere R = 1,737,400 m",
        elevation_units="meters",
        nodata_value=-32767.0,
        file_size_mb=3304.0,  # 3.3 GB
        access_method="cog_range",
        is_local_available=False,
        remote_surf_url="https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/87S/ldem_87s_5mpp.tif",
        remote_slp_url="https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/87S/ldsm_87s_5mpp.tif",
        companion_layers=["surface", "slope", "hillshade", "count"],
        quality_notes=[
            "Large 3.3 GB mosaic accessed via windowed Cloud-Optimized GeoTIFF HTTP byte-range requests.",
            "Complete coverage for all regions south of 86.7°S.",
        ],
    ),
    # -------------------------------------------------------------
    # NASA PGDA Product 90: Regional South Pole (20 m/pixel)
    # -------------------------------------------------------------
    "spole_80s_20mpp": DatasetRecord(
        dataset_id="spole_80s_20mpp",
        product_series="PGDA-90",
        name="South Pole 80–90°S Regional LOLA DEM (20m/px)",
        region_name="Circumpolar South Pole Region (80°S to 90°S)",
        description="Broad coverage South Pole DEM covering all terrain from 80°S to 90°S at 20 m/pixel nominal resolution.",
        source_url="https://pgda.gsfc.nasa.gov/products/90",
        citation=CITATION_BARKER_2023,
        reference_frame="MOON_ME (DE421)",
        projection_crs="+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs",
        nominal_pixel_spacing_m=20.0,
        effective_resolution_note="20 m/pixel grid spacing. Provides guaranteed continuous regional coverage.",
        bounds_projected={"left": -305000.0, "bottom": -305000.0, "right": 305000.0, "top": 305000.0},
        bounds_geographic={"min_lat": -90.0, "max_lat": -80.0, "min_lon": -180.0, "max_lon": 180.0},
        elevation_datum="Sphere R = 1,737,400 m",
        elevation_units="meters",
        nodata_value=-32767.0,
        file_size_mb=1820.0,
        access_method="cog_range",
        is_local_available=False,
        remote_surf_url="https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF",
        remote_slp_url="https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDSM_80S_20MPP_ADJ.TIF",
        companion_layers=["surface", "slope", "roughness", "count", "toterr"],
        quality_notes=[
            "Barker et al. (2023) updated track-adjusted DEM.",
            "Best choice for regional analysis extending north of 86.7°S.",
        ],
    ),
}

class DatasetCatalogueService:
    def __init__(self):
        self._catalogue = DATASET_REGISTRY
        self._check_local_availability()

    def _check_local_availability(self):
        """Updates availability based on files existing in local storage."""
        for ds in self._catalogue.values():
            if ds.local_surf_path and os.path.exists(ds.local_surf_path):
                ds.is_local_available = True
                ds.access_method = "local"
            else:
                ds.is_local_available = False

    def list_all(self) -> List[DatasetRecord]:
        self._check_local_availability()
        return list(self._catalogue.values())

    def get_by_id(self, dataset_id: str) -> Optional[DatasetRecord]:
        self._check_local_availability()
        return self._catalogue.get(dataset_id.lower().strip() if dataset_id else "")

    def find_site_for_coordinates(self, lat: float, lon: float) -> Optional[DatasetRecord]:
        """Resolves the most specific local lunar regional dataset covering given lat/lon."""
        self._check_local_availability()
        from app.services.coordinate_transform import transformer
        x, y = transformer.lat_lon_to_xy(lat, lon)
        # Check high-res regional sites first (site01, site04, site11)
        for sid in ["site01", "site04", "site11", "site23"]:
            ds = self._catalogue.get(sid)
            if ds and ds.is_local_available and ds.bounds_projected:
                b = ds.bounds_projected
                if b["left"] <= x <= b["right"] and b["bottom"] <= y <= b["top"]:
                    return ds
        return None

catalogue_service = DatasetCatalogueService()
