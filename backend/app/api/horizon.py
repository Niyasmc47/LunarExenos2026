from fastapi import APIRouter, HTTPException, Query
from app.schemas.horizon import HorizonAnalysisRequest, HorizonAnalysisResponse
from app.services.horizon_service import horizon_service

router = APIRouter(prefix="/api/horizon", tags=["Horizon"])

@router.post("/analyze", response_model=HorizonAnalysisResponse)
def analyze_horizon_post(request: HorizonAnalysisRequest) -> HorizonAnalysisResponse:
    """
    Calculate the 360-degree terrain horizon elevation profile from an observer location
    on the lunar surface, taking into account lunar spherical curvature and observer height.
    """
    try:
        return horizon_service.calculate_horizon(request)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Horizon calculation error: {str(e)}")

@router.get("/analyze", response_model=HorizonAnalysisResponse)
def analyze_horizon_get(
    latitude: float = Query(..., ge=-90.0, le=90.0, description="Observer lunar latitude in degrees"),
    longitude: float = Query(..., ge=-180.0, le=360.0, description="Observer lunar longitude in degrees"),
    observer_height_m: float = Query(2.0, ge=0.0, le=100.0, description="Observer height above surface in meters"),
    azimuth_resolution_deg: float = Query(1.0, ge=0.1, le=10.0, description="Azimuth resolution in degrees"),
    max_search_distance_m: float = Query(15000.0, ge=100.0, le=100000.0, description="Max search radius in meters"),
    sampling_interval_m: float = Query(15.0, ge=2.0, le=200.0, description="Radial step in meters"),
    dataset_id: str = Query("site01", description="DEM dataset identifier"),
) -> HorizonAnalysisResponse:
    """
    GET endpoint for horizon calculation with query parameters.
    """
    req = HorizonAnalysisRequest(
        latitude=latitude,
        longitude=longitude,
        observer_height_m=observer_height_m,
        azimuth_resolution_deg=azimuth_resolution_deg,
        max_search_distance_m=max_search_distance_m,
        sampling_interval_m=sampling_interval_m,
        dataset_id=dataset_id,
    )
    try:
        return horizon_service.calculate_horizon(req)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Horizon calculation error: {str(e)}")
