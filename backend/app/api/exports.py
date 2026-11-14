"""
API routes for Scientific Product Exports: CSVs, GeoTIFFs, and JSON Metadata.
"""

from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query, Response
from app.schemas.profile import ProfileTransectRequest
from app.schemas.region import BoundingBox
from app.schemas.export import ExportMetadata
from app.services.dataset_catalogue import catalogue_service
from app.services.raster_window import raster_window_service
from app.services.profile_service import profile_service
from app.services.regional_statistics import regional_statistics_service
from app.services.raster_export import raster_export_service
from app.services.slope_service import slope_service

router = APIRouter(prefix="/api/exports", tags=["exports"])

@router.post("/profile-csv")
def export_profile_csv(req: ProfileTransectRequest):
    """
    Exports sampled elevation transect to scientific CSV format.
    """
    res = profile_service.sample_transect(
        dataset_id=req.dataset_id,
        start_lat=req.start_latitude,
        start_lon=req.start_longitude,
        end_lat=req.end_latitude,
        end_lon=req.end_longitude,
        num_samples=req.num_samples,
    )
    csv_text = raster_export_service.profile_to_csv(
        points=res.samples,
        dataset_name=res.dataset_name,
        citation=res.citation,
    )
    filename = f"lunavista_transect_{req.dataset_id}.csv"
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )

@router.get("/statistics-csv")
def export_statistics_csv(
    dataset_id: str = Query("site01"),
    min_lat: float = Query(-89.8),
    max_lat: float = Query(-89.1),
    min_lon: float = Query(-170.0),
    max_lon: float = Query(-105.0),
):
    """
    Exports regional terrain and slope statistics to CSV format.
    """
    dataset = catalogue_service.get_by_id(dataset_id) or catalogue_service.get_by_id("site01")
    bbox = BoundingBox(min_latitude=min_lat, max_latitude=max_lat, min_longitude=min_lon, max_longitude=max_lon)

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
        slope = slope_service.derive_slope_from_dem(window["elevation"], dataset.nominal_pixel_spacing_m)

    stats = regional_statistics_service.compute_statistics(dataset, bbox, window["elevation"], slope)
    csv_text = raster_export_service.statistics_to_csv(stats)
    filename = f"lunavista_statistics_{dataset_id}.csv"
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )

@router.get("/geotiff")
def export_clipped_geotiff(
    dataset_id: str = Query("site01"),
    min_lat: float = Query(-89.8),
    max_lat: float = Query(-89.1),
    min_lon: float = Query(-170.0),
    max_lon: float = Query(-105.0),
):
    """
    Exports a clipped GeoTIFF containing raw scientific float32 elevations with CRS & geotransform.
    """
    dataset = catalogue_service.get_by_id(dataset_id) or catalogue_service.get_by_id("site01")
    window = raster_window_service.read_window_geographic(
        dataset_id=dataset.dataset_id,
        min_lat=min_lat,
        max_lat=max_lat,
        min_lon=min_lon,
        max_lon=max_lon,
        target_width=256,
        target_height=256,
    )

    tiff_bytes = raster_export_service.create_clipped_geotiff(
        dem=window["elevation"],
        bounds_projected=window["bounds_projected"],
        dataset=dataset,
    )

    filename = f"lunavista_{dataset_id}_clipped.tif"
    return Response(
        content=tiff_bytes,
        media_type="image/tiff",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
