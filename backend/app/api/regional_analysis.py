"""
API routes for Regional Lunar Terrain Analysis: Elevation, Slope, Hillshade, Statistics, and Point Inspection.
"""

from typing import Optional
import numpy as np
from fastapi import APIRouter, HTTPException, Query, Response
from app.schemas.region import BoundingBox
from app.schemas.analysis import (
    RegionalMapRequest,
    RegionalSlopeMapRequest,
    HillshadeRequest,
    RegionalStatisticsResponse,
    TerrainInspectionResponse,
)
from app.schemas.profile import ProfileTransectRequest, ProfileTransectResponse
from app.services.dataset_catalogue import catalogue_service
from app.services.raster_window import raster_window_service
from app.services.elevation_service import elevation_rendering_service
from app.services.slope_service import slope_service
from app.services.hillshade_service import hillshade_service
from app.services.regional_statistics import regional_statistics_service
from app.services.profile_service import profile_service
from app.services.raster_export import raster_export_service
from app.services.coordinate_transform import (
    lat_lon_to_stereographic,
    transformer,
)

router = APIRouter(prefix="/api/regional", tags=["regional_analysis"])

@router.get("/elevation-map.png")
def get_regional_elevation_map_get(
    dataset_id: str = Query("site01"),
    colormap_name: str = Query("hypsometric"),
    min_lat: Optional[float] = Query(None),
    max_lat: Optional[float] = Query(None),
    min_lon: Optional[float] = Query(None),
    max_lon: Optional[float] = Query(None),
    output_width: int = Query(512, ge=64, le=2048),
    output_height: int = Query(512, ge=64, le=2048),
):
    """
    Renders and streams a color-coded elevation map PNG via GET (for OpenLayers / browser images).
    """
    dataset = catalogue_service.get_by_id(dataset_id) or catalogue_service.get_by_id("site01")
    if min_lat is None or max_lat is None or min_lon is None or max_lon is None:
        min_lat = dataset.bounds_geographic["min_lat"]
        max_lat = dataset.bounds_geographic["max_lat"]
        min_lon = dataset.bounds_geographic["min_lon"]
        max_lon = dataset.bounds_geographic["max_lon"]

    window = raster_window_service.read_window_geographic(
        dataset_id=dataset.dataset_id,
        min_lat=min_lat,
        max_lat=max_lat,
        min_lon=min_lon,
        max_lon=max_lon,
        target_width=output_width,
        target_height=output_height,
    )

    rgba = elevation_rendering_service.render_elevation_rgba(
        elevation=window["elevation"],
        colormap_name=colormap_name,
    )
    png_bytes = raster_export_service.rgba_to_png_bytes(rgba)
    return Response(content=png_bytes, media_type="image/png")

@router.post("/elevation-map.png")
def get_regional_elevation_map(req: RegionalMapRequest):
    """
    Renders and streams a color-coded elevation map PNG for the specified bounding box.
    """
    window = raster_window_service.read_window_geographic(
        dataset_id=req.dataset_id,
        min_lat=req.bounding_box.min_latitude,
        max_lat=req.bounding_box.max_latitude,
        min_lon=req.bounding_box.min_longitude,
        max_lon=req.bounding_box.max_longitude,
        target_width=req.output_width,
        target_height=req.output_height,
    )

    rgba = elevation_rendering_service.render_elevation_rgba(
        elevation=window["elevation"],
        colormap_name=req.colormap_name,
    )
    png_bytes = raster_export_service.rgba_to_png_bytes(rgba)
    return Response(content=png_bytes, media_type="image/png")

@router.get("/slope-map.png")
def get_regional_slope_map_get(
    dataset_id: str = Query("site01"),
    classified: bool = Query(True),
    min_lat: Optional[float] = Query(None),
    max_lat: Optional[float] = Query(None),
    min_lon: Optional[float] = Query(None),
    max_lon: Optional[float] = Query(None),
    output_width: int = Query(512, ge=64, le=2048),
    output_height: int = Query(512, ge=64, le=2048),
):
    """
    Renders and streams a classified 7-tier slope map PNG via GET (for OpenLayers / browser images).
    """
    dataset = catalogue_service.get_by_id(dataset_id) or catalogue_service.get_by_id("site01")
    if min_lat is None or max_lat is None or min_lon is None or max_lon is None:
        min_lat = dataset.bounds_geographic["min_lat"]
        max_lat = dataset.bounds_geographic["max_lat"]
        min_lon = dataset.bounds_geographic["min_lon"]
        max_lon = dataset.bounds_geographic["max_lon"]

    window = raster_window_service.read_window_geographic(
        dataset_id=dataset.dataset_id,
        min_lat=min_lat,
        max_lat=max_lat,
        min_lon=min_lon,
        max_lon=max_lon,
        target_width=output_width,
        target_height=output_height,
    )

    slope = window["slope"]
    if slope is None:
        slope = slope_service.derive_slope_from_dem(
            dem=window["elevation"],
            pixel_spacing_m=dataset.nominal_pixel_spacing_m,
        )

    rgba = slope_service.render_slope_rgba(
        slope_deg=slope,
        classified=classified,
    )
    png_bytes = raster_export_service.rgba_to_png_bytes(rgba)
    return Response(content=png_bytes, media_type="image/png")

@router.post("/slope-map.png")
def get_regional_slope_map(req: RegionalSlopeMapRequest):
    """
    Renders and streams a classified 7-tier lunar landing hazard slope map PNG.
    Uses NASA-provided slope if available, or derives slope from DEM via Horn's method.
    """
    window = raster_window_service.read_window_geographic(
        dataset_id=req.dataset_id,
        min_lat=req.bounding_box.min_latitude,
        max_lat=req.bounding_box.max_latitude,
        min_lon=req.bounding_box.min_longitude,
        max_lon=req.bounding_box.max_longitude,
        target_width=req.output_width,
        target_height=req.output_height,
    )

    dataset = catalogue_service.get_by_id(req.dataset_id) or catalogue_service.get_by_id("site01")
    slope = window["slope"]

    if slope is None:
        slope = slope_service.derive_slope_from_dem(
            dem=window["elevation"],
            pixel_spacing_m=dataset.nominal_pixel_spacing_m,
        )

    rgba = slope_service.render_slope_rgba(
        slope_deg=slope,
        classified=req.classified,
    )
    png_bytes = raster_export_service.rgba_to_png_bytes(rgba)
    return Response(content=png_bytes, media_type="image/png")

@router.get("/hillshade.png")
def get_regional_hillshade_map_get(
    dataset_id: str = Query("site01"),
    azimuth_deg: float = Query(315.0),
    altitude_deg: float = Query(45.0),
    z_factor: float = Query(1.0),
    min_lat: Optional[float] = Query(None),
    max_lat: Optional[float] = Query(None),
    min_lon: Optional[float] = Query(None),
    max_lon: Optional[float] = Query(None),
    output_width: int = Query(512, ge=64, le=2048),
    output_height: int = Query(512, ge=64, le=2048),
):
    """
    Renders and streams a cartographic hillshade PNG via GET.
    """
    dataset = catalogue_service.get_by_id(dataset_id) or catalogue_service.get_by_id("site01")
    if min_lat is None or max_lat is None or min_lon is None or max_lon is None:
        min_lat = dataset.bounds_geographic["min_lat"]
        max_lat = dataset.bounds_geographic["max_lat"]
        min_lon = dataset.bounds_geographic["min_lon"]
        max_lon = dataset.bounds_geographic["max_lon"]

    window = raster_window_service.read_window_geographic(
        dataset_id=dataset.dataset_id,
        min_lat=min_lat,
        max_lat=max_lat,
        min_lon=min_lon,
        max_lon=max_lon,
        target_width=output_width,
        target_height=output_height,
    )

    rgba = hillshade_service.generate_hillshade_rgba(
        dem=window["elevation"],
        pixel_spacing_m=dataset.nominal_pixel_spacing_m,
        azimuth_deg=azimuth_deg,
        altitude_deg=altitude_deg,
        z_factor=z_factor,
    )
    png_bytes = raster_export_service.rgba_to_png_bytes(rgba)
    return Response(content=png_bytes, media_type="image/png")

@router.post("/hillshade.png")
def get_regional_hillshade_map(req: HillshadeRequest):
    """
    Renders and streams a cartographic hillshade PNG with configurable azimuth and altitude.
    Clearly designated as a cartographic tool, not an ephemeris shadow model.
    """
    window = raster_window_service.read_window_geographic(
        dataset_id=req.dataset_id,
        min_lat=req.bounding_box.min_latitude,
        max_lat=req.bounding_box.max_latitude,
        min_lon=req.bounding_box.min_longitude,
        max_lon=req.bounding_box.max_longitude,
        target_width=req.output_width,
        target_height=req.output_height,
    )

    dataset = catalogue_service.get_by_id(req.dataset_id) or catalogue_service.get_by_id("site01")

    rgba = hillshade_service.generate_hillshade_rgba(
        dem=window["elevation"],
        pixel_spacing_m=dataset.nominal_pixel_spacing_m,
        azimuth_deg=req.azimuth_deg,
        altitude_deg=req.altitude_deg,
        z_factor=req.z_factor,
    )
    png_bytes = raster_export_service.rgba_to_png_bytes(rgba)
    return Response(content=png_bytes, media_type="image/png")

@router.get("/statistics", response_model=RegionalStatisticsResponse)
@router.post("/statistics", response_model=RegionalStatisticsResponse)
def get_regional_statistics(
    dataset_id: str = Query("site01"),
    min_lat: float = Query(-89.8),
    max_lat: float = Query(-89.1),
    min_lon: float = Query(-170.0),
    max_lon: float = Query(-105.0),
):
    """
    Computes rigorous physical statistics and surface area for the selected lunar region.
    """
    dataset = catalogue_service.get_by_id(dataset_id) or catalogue_service.get_by_id("site01")
    bbox = BoundingBox(
        min_latitude=min_lat,
        max_latitude=max_lat,
        min_longitude=min_lon,
        max_longitude=max_lon,
    )

    window = raster_window_service.read_window_geographic(
        dataset_id=dataset.dataset_id,
        min_lat=min_lat,
        max_lat=max_lat,
        min_lon=min_lon,
        max_lon=max_lon,
        target_width=256,
        target_height=256,
    )

    slope = window["slope"]
    if slope is None:
        slope = slope_service.derive_slope_from_dem(
            dem=window["elevation"],
            pixel_spacing_m=dataset.nominal_pixel_spacing_m,
        )

    return regional_statistics_service.compute_statistics(
        dataset=dataset,
        bbox=bbox,
        elevation=window["elevation"],
        slope=slope,
    )

@router.post("/profile", response_model=ProfileTransectResponse)
def get_transect_profile(req: ProfileTransectRequest):
    """
    Samples real DEM elevation and slope along a straight transect line.
    """
    return profile_service.sample_transect(
        dataset_id=req.dataset_id,
        start_lat=req.start_latitude,
        start_lon=req.start_longitude,
        end_lat=req.end_latitude,
        end_lon=req.end_longitude,
        num_samples=req.num_samples,
    )

@router.get("/inspect", response_model=TerrainInspectionResponse)
def inspect_lunar_point(
    lat: float = Query(..., ge=-90.0, le=90.0),
    lon: float = Query(..., ge=-180.0, le=180.0),
    dataset_id: str = Query("site01"),
):
    """
    Returns point elevation, slope, coverage status, and scientific provenance.
    Never substitutes zero for missing data.
    """
    dataset = catalogue_service.get_by_id(dataset_id) or catalogue_service.get_by_id("site01")
    x, y = lat_lon_to_stereographic(lat, lon)

    # Check bounds
    ds_b = dataset.bounds_projected
    in_bounds = (ds_b["left"] <= x <= ds_b["right"] and ds_b["bottom"] <= y <= ds_b["top"])

    if not in_bounds:
        return TerrainInspectionResponse(
            latitude=lat,
            longitude=lon,
            projected_x=round(x, 2),
            projected_y=round(y, 2),
            in_bounds=False,
            elevation_m=None,
            slope_deg=None,
            quality_status="out_of_bounds",
            dataset_id=dataset.dataset_id,
            dataset_name=dataset.name,
            slope_source="none",
            effective_resolution_note=dataset.effective_resolution_note,
            citation=dataset.citation,
        )

    # Sample small 3x3 window around point
    window = raster_window_service.read_window_geographic(
        dataset_id=dataset.dataset_id,
        min_lat=lat - 0.01,
        max_lat=lat + 0.01,
        min_lon=lon - 0.02,
        max_lon=lon + 0.02,
        target_width=16,
        target_height=16,
    )

    elev_grid = window["elevation"]
    slp_grid = window["slope"]

    center_val = float(elev_grid[8, 8])
    elev_val = None
    quality = "nodata"

    if not np.isnan(center_val) and center_val > -20000.0:
        elev_val = round(center_val, 2)
        quality = "interpolated"

    slope_val = None
    slope_source = "none"

    if slp_grid is not None:
        s_center = float(slp_grid[8, 8])
        if not np.isnan(s_center) and 0.0 <= s_center <= 90.0:
            slope_val = round(s_center, 2)
            slope_source = "nasa_provided"
    elif elev_val is not None:
        derived_slp = slope_service.derive_slope_from_dem(elev_grid, dataset.nominal_pixel_spacing_m)
        s_center = float(derived_slp[8, 8])
        if not np.isnan(s_center):
            slope_val = round(s_center, 2)
            slope_source = "lunavista_derived"

    return TerrainInspectionResponse(
        latitude=lat,
        longitude=lon,
        projected_x=round(x, 2),
        projected_y=round(y, 2),
        in_bounds=True,
        elevation_m=elev_val,
        slope_deg=slope_val,
        quality_status=quality,
        dataset_id=dataset.dataset_id,
        dataset_name=dataset.name,
        slope_source=slope_source,
        effective_resolution_note=dataset.effective_resolution_note,
        citation=dataset.citation,
    )
