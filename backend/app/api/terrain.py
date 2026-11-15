from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query, Response
from app.schemas.terrain import (
    DatasetMetadata,
    ElevationPointResponse,
    TerrainGridResponse,
    ElevationProfileResponse,
)
from app.services.dem_loader import dem_loader, get_dem_loader, list_available_sites
from app.services.terrain_mesh import terrain_mesh_service
from app.services.terrain_visualizer import terrain_visualizer
from app.services.terrain_profile import extract_elevation_profile
from app.services.terrain_quality import get_terrain_quality_report
from app.services.dataset_catalogue import catalogue_service

router = APIRouter(prefix="/api/terrain", tags=["Terrain"])

@router.get("/datasets")
def get_datasets():
    """
    Lists all available authentic NASA LOLA terrain regional datasets.
    """
    records = catalogue_service.list_all()
    # Filter to high-res Product 78 sites first
    results = []
    for r in records:
        loader = get_dem_loader(r.dataset_id)
        is_avail = loader.is_available()
        results.append({
            "id": r.dataset_id,
            "name": r.name,
            "region": r.region_name,
            "description": r.description,
            "resolution": f"{r.nominal_pixel_spacing_m:.1f} m/pixel",
            "reference_frame": r.reference_frame,
            "source": f"NASA LOLA ({r.product_series})",
            "available": is_avail,
            "is_local_available": is_avail,
            "citation": r.citation,
            "bounds_geographic": r.bounds_geographic,
            "bounds_projected": r.bounds_projected,
        })
    return {"datasets": results}

@router.get("/elevation", response_model=ElevationPointResponse)
def get_elevation_at_point(
    latitude: Optional[float] = Query(None, ge=-90.0, le=90.0, description="Lunar Latitude"),
    longitude: Optional[float] = Query(None, ge=-180.0, le=180.0, description="Lunar Longitude"),
    lat: Optional[float] = Query(None, ge=-90.0, le=90.0, description="Lunar Latitude alias"),
    lon: Optional[float] = Query(None, ge=-180.0, le=180.0, description="Lunar Longitude alias"),
    site_id: Optional[str] = Query(None, description="Optional target site identifier (site01, site04, site11)"),
):
    """
    Returns exact elevation, slope, LOLA count, and uncertainty for any lunar coordinate.
    Seamlessly routes to the correct NASA regional DEM based on candidate site or coordinates.
    """
    actual_lat = latitude if latitude is not None else lat
    actual_lon = longitude if longitude is not None else lon
    if actual_lat is None or actual_lon is None:
        raise HTTPException(
            status_code=400,
            detail="Must provide latitude & longitude (or lat & lon)",
        )

    loader = get_dem_loader(site_id) if site_id else dem_loader
    sample = loader.sample_point(actual_lat, actual_lon, site_id=site_id)
    return ElevationPointResponse(
        latitude=actual_lat,
        longitude=actual_lon,
        **sample
    )

@router.get("/{site_id}/metadata", response_model=DatasetMetadata)
def get_site_metadata(site_id: str):
    """
    Returns complete scientific metadata and statistics for any requested site (site01, site04, site11).
    """
    loader = get_dem_loader(site_id)
    if not loader.is_available():
        raise HTTPException(
            status_code=503,
            detail=f"{site_id.capitalize()} DEM file is currently not available on server.",
        )
    return loader.get_metadata()

@router.get("/{site_id}/grid", response_model=TerrainGridResponse)
def get_site_grid(
    site_id: str,
    lod: str = Query("medium", pattern="^(low|medium|high)$", description="Level of detail (low=64, medium=128, high=256)"),
    max_dim: Optional[int] = Query(None, ge=16, le=512, description="Optional override for maximum grid dimension"),
):
    """
    Returns a bounded, downsampled terrain grid for 2D visualization of the requested site.
    """
    loader = get_dem_loader(site_id)
    if not loader.is_available():
        raise HTTPException(
            status_code=503,
            detail=f"{site_id.capitalize()} DEM file is currently not available on server.",
        )
    return loader.get_downsampled_grid(lod=lod, max_dim=max_dim)

@router.get("/{site_id}/mesh")
def get_site_mesh(
    site_id: str,
    lod: str = Query("medium", pattern="^(low|medium|high)$", description="Level of detail"),
    exaggeration: float = Query(1.0, ge=0.5, le=10.0, description="Vertical exaggeration multiplier (default 1.0)"),
    max_dim: Optional[int] = Query(None, ge=16, le=256),
):
    """
    Returns BufferGeometry-ready 3D mesh data directly mapped onto the
    spherical lunar coordinate system of the Three.js globe for the requested site.
    """
    loader = get_dem_loader(site_id)
    if not loader.is_available():
        raise HTTPException(
            status_code=503,
            detail=f"{site_id.capitalize()} DEM file is currently not available on server.",
        )
    return terrain_mesh_service.generate_mesh_data(
        lod=lod,
        vertical_exaggeration=exaggeration,
        max_dim=max_dim,
        site_id=site_id,
    )

@router.get("/{site_id}/overlay/elevation.png")
def get_site_elevation_overlay(
    site_id: str,
    width: int = Query(512, ge=128, le=1024),
    height: int = Query(512, ge=128, le=1024),
):
    """
    Returns an RGBA PNG overlay of elevation for the requested site.
    """
    loader = get_dem_loader(site_id)
    if not loader.is_available():
        raise HTTPException(status_code=503, detail=f"DEM not loaded for {site_id}")
    png_bytes = terrain_visualizer.get_elevation_overlay_png(width=width, height=height, site_id=site_id)
    return Response(content=png_bytes, media_type="image/png")

@router.get("/{site_id}/overlay/slope.png")
def get_site_slope_overlay(
    site_id: str,
    width: int = Query(512, ge=128, le=1024),
    height: int = Query(512, ge=128, le=1024),
):
    """
    Returns an RGBA PNG overlay of slope for the requested site with landing hazard colormap.
    """
    loader = get_dem_loader(site_id)
    if not loader.is_available():
        raise HTTPException(status_code=503, detail=f"DEM not loaded for {site_id}")
    png_bytes = terrain_visualizer.get_slope_overlay_png(width=width, height=height, site_id=site_id)
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

    loader = get_dem_loader(dataset_id)
    if not loader.is_available():
        raise HTTPException(status_code=503, detail=f"DEM not loaded for {dataset_id}")

    return extract_elevation_profile(
        dataset_id=dataset_id,
        start_lat=s_lat,
        start_lon=s_lon,
        end_lat=e_lat,
        end_lon=e_lon,
        num_samples=num_samples,
    )

@router.get("/{site_id}/quality")
def get_site_quality(site_id: str):
    """
    Returns scientific data quality, reference frames, and interpolation disclosures for any site.
    """
    return get_terrain_quality_report(site_id)
