from fastapi import APIRouter, HTTPException, Query
from app.schemas.ephemeris import (
    EphemerisPositionRequest,
    EphemerisPositionResponse,
    EphemerisTimeSeriesRequest,
    EphemerisTimeSeriesResponse,
    EphemerisStatusResponse,
)
from app.services.ephemeris_service import ephemeris_service
from app.services.kernel_manager import kernel_manager

router = APIRouter(prefix="/api/ephemeris", tags=["Sun & Earth Ephemeris Engine"])

@router.post("/position", response_model=EphemerisPositionResponse)
def calculate_position(request: EphemerisPositionRequest) -> EphemerisPositionResponse:
    """
    Calculate topocentric apparent positions of Sun and Earth as observed from
    a specified lunar surface location at a specific epoch (ISO 8601).
    """
    try:
        return ephemeris_service.calculate_position(request)
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=f"Required SPICE kernel missing: {str(e)}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ephemeris calculation error: {str(e)}")

@router.post("/timeseries", response_model=EphemerisTimeSeriesResponse)
def calculate_timeseries(request: EphemerisTimeSeriesRequest) -> EphemerisTimeSeriesResponse:
    """
    Calculate topocentric positions of Sun and Earth over a time interval.
    """
    try:
        return ephemeris_service.calculate_timeseries(request)
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=f"Required SPICE kernel missing: {str(e)}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ephemeris time-series error: {str(e)}")

@router.get("/status", response_model=EphemerisStatusResponse)
def get_ephemeris_status() -> EphemerisStatusResponse:
    """
    Return kernel inventory, loaded SPICE frames, toolkit version, and health status.
    """
    try:
        kernel_manager.ensure_kernels_loaded()
        status_dict = kernel_manager.get_status()
        return EphemerisStatusResponse(**status_dict)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error checking ephemeris status: {str(e)}")

@router.get("/provenance")
def get_ephemeris_provenance():
    """
    Return scientific provenance, reference frames, and ephemeris source models.
    """
    return {
        "status": "operational",
        "provenance": kernel_manager.get_provenance_metadata(),
        "coordinate_conventions": {
            "lunar_reference_frame": "MOON_ME (DE421)",
            "azimuth_zero": "Local North (0°)",
            "azimuth_direction": "Clockwise (0°=N, 90°=E, 180°=S, 270°=W)",
            "elevation_zero": "Local Horizontal Tangent Plane (0°)",
            "elevation_positive": "Above horizon plane toward zenith (+90°)",
            "vertical_datum": "IAU Moon 2000 Sphere R = 1,737,400 m",
        },
    }
