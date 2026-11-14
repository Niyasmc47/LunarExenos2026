from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Response
from app.schemas.terrain import (
    DatasetMetadata,
    ElevationPointResponse,
    TerrainGridResponse,
    ElevationProfileResponse,
)
from app.services.dem_loader import dem_loader
from app.services.terrain_mesh import terrain_mesh_service
from app.services.terrain_visualizer import terrain_visualizer
from app.services.terrain_profile import extract_elevation_profile
from app.services.terrain_quality import get_terrain_quality_report

router = APIRouter(prefix="/api/terrain", tags=["terrain"])

@router.get("/datasets")
def get_datasets():
    """
    Lists available LOLA terrain datasets.
    """
    is_avail = dem_loader.is_available()
    return {
        "datasets": [
            {
                "id": "site01",
                "name": "Site 01 — Connecting Ridge",
                "region": "Lunar South Pole (Shackleton-de Gerlache)",
                "resolution": "5 m/pixel",
                "reference_frame": "MOON_ME (DE421)",
                "source": "NASA LOLA (PGDA Product 78)",
                "available": is_avail,
            }
        ]
    }

@router.get("/site01/metadata", response_model=DatasetMetadata)
def get_site01_metadata():
    """
    Returns complete scientific metadata and statistics for Site01.
    """
    if not dem_loader.is_available():
        raise HTTPException(
            status_code=503,
            detail="Site01 DEM file is currently downloading or not available on server.",
        )
    return dem_loader.get_metadata()

@router.get("/elevation", response_model=ElevationPointResponse)
def get_elevation_at_point(
    latitude: Optional[float] = Query(None, ge=-90.0, le=90.0, description="Lunar Latitude"),
    longitude: Optional[float] = Query(None, ge=-180.0, le=180.0, description="Lunar Longitude"),
    lat: Optional[float] = Query(None, ge=-90.0, le=90.0, description="Lunar Latitude alias"),
    lon: Optional[float] = Query(None, ge=-180.0, le=180.0, description="Lunar Longitude alias"),
):
    """
    Returns exact elevation, slope, LOLA count, and uncertainty for any lunar coordinate.
    Properly flags coordinates outside the high-resolution DEM.
    """
    actual_lat = latitude if latitude is not None else lat
    actual_lon = longitude if longitude is not None else lon
    if actual_lat is None or actual_lon is None:
        raise HTTPException(
            status_code=400,
            detail="Must provide latitude & longitude (or lat & lon)",
        )

    sample = dem_loader.sample_point(actual_lat, actual_lon)
    return ElevationPointResponse(
        latitude=actual_lat,
        longitude=actual_lon,
        **sample
    )

@router.get("/site01/grid", response_model=TerrainGridResponse)
def get_site01_grid(
    lod: str = Query("medium", pattern="^(low|medium|high)$", description="Level of detail (low=64, medium=128, high=256)"),
    max_dim: Optional[int] = Query(None, ge=16, le=512, description="Optional override for maximum grid dimension"),
):
    """
    Returns a bounded, downsampled terrain grid for 2D visualization.
    """
    if not dem_loader.is_available():
        raise HTTPException(
            status_code=503,
            detail="Site01 DEM file is currently downloading or not available on server.",
        )
    return dem_loader.get_downsampled_grid(lod=lod, max_dim=max_dim)

@router.get("/site01/mesh")
def get_site01_mesh(
    lod: str = Query("medium", pattern="^(low|medium|high)$", description="Level of detail"),
    exaggeration: float = Query(1.0, ge=0.5, le=10.0, description="Vertical exaggeration multiplier (default 1.0)"),
    max_dim: Optional[int] = Query(None, ge=16, le=256),
):
    """
    Returns BufferGeometry-ready 3D mesh data directly mapped onto the
    spherical lunar coordinate system of the Three.js globe.
    """
    if not dem_loader.is_available():
        raise HTTPException(
            status_code=503,
            detail="Site01 DEM file is currently downloading or not available on server.",
        )
    return terrain_mesh_service.generate_mesh_data(
        lod=lod,
        vertical_exaggeration=exaggeration,
        max_dim=max_dim,
    )

@router.get("/site01/overlay/elevation.png")
def get_site01_elevation_overlay(
    width: int = Query(512, ge=128, le=1024),
    height: int = Query(512, ge=128, le=1024),
):
    """
    Returns an RGBA PNG overlay of Site01 elevation with transparency outside DEM.
    """
    if not dem_loader.is_available():
        raise HTTPException(status_code=503, detail="DEM not loaded")
    png_bytes = terrain_visualizer.get_elevation_overlay_png(width=width, height=height)
    return Response(content=png_bytes, media_type="image/png")

@router.get("/site01/overlay/slope.png")
def get_site01_slope_overlay(
    width: int = Query(512, ge=128, le=1024),
    height: int = Query(512, ge=128, le=1024),
):
    """
    Returns an RGBA PNG overlay of Site01 slope with landing safety colormap.
    """
    if not dem_loader.is_available():
        raise HTTPException(status_code=503, detail="DEM not loaded")
    png_bytes = terrain_visualizer.get_slope_overlay_png(width=width, height=height)
    return Response(content=png_bytes, media_type="image/png")

@router.get("/profile", response_model=ElevationProfileResponse)
def get_elevation_profile(
    dataset_id: str = Query("site01", description="Dataset identifier"),
    start_lat: Optional[float] = Query(None, description="Start latitude"),
    start_lon: Optional[float] = Query(None, description="Start longitude"),
    end_lat: Optional[float] = Query(None, description="End latitude"),
    end_lon: Optional[float] = Query(None, description="End longitude"),
    start_latitude: Optional[float] = Query(None, description="Start latitude alias"),
    start_longitude: Optional[float] = Query(None, description="Start longitude alias"),
    end_latitude: Optional[float] = Query(None, description="End latitude alias"),
    end_longitude: Optional[float] = Query(None, description="End longitude alias"),
    num_samples: int = Query(100, ge=10, le=500, description="Number of sample points along transect"),
):
    """
    Returns sampled elevation and slope along a straight transect line between two lunar coordinates.
    """
    s_lat = start_lat if start_lat is not None else start_latitude
    s_lon = start_lon if start_lon is not None else start_longitude
    e_lat = end_lat if end_lat is not None else end_latitude
    e_lon = end_lon if end_lon is not None else end_longitude

    if s_lat is None or s_lon is None or e_lat is None or e_lon is None:
        raise HTTPException(
            status_code=400,
            detail="Must provide start_lat/start_lon and end_lat/end_lon (or start_latitude/start_longitude and end_latitude/end_longitude)",
        )

    if not dem_loader.is_available():
        raise HTTPException(status_code=503, detail="DEM not loaded")

    return extract_elevation_profile(
        dataset_id=dataset_id,
        start_lat=s_lat,
        start_lon=s_lon,
        end_lat=e_lat,
        end_lon=e_lon,
        num_samples=num_samples,
    )

@router.get("/site01/quality")
def get_site01_quality():
    """
    Returns scientific data quality, reference frames, and interpolation disclosures for Site01.
    """
    return get_terrain_quality_report("site01")


