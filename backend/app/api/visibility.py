from fastapi import APIRouter, HTTPException
from typing import Dict, Any

from app.schemas.visibility import (
    VisibilityInstantRequest,
    VisibilityInstantResponse,
    VisibilityAnalysisRequest,
    VisibilityAnalysisResponse,
)
from app.services.visibility_service import visibility_service
from app.services.kernel_manager import kernel_manager

router = APIRouter(prefix="/api/visibility", tags=["Terrain-Aware Visibility & Illumination Engine"])

@router.post("/instant", response_model=VisibilityInstantResponse)
def compute_instant_visibility(request: VisibilityInstantRequest) -> VisibilityInstantResponse:
    """
    Calculate terrain-aware Sun and Earth visibility at a specific observation epoch.
    Integrates the finite apparent celestial disk against the local terrain horizon.
    """
    try:
        return visibility_service.compute_instant_visibility(request)
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=f"Required data source missing: {str(e)}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Visibility computation error: {str(e)}")

@router.post("/analyze", response_model=VisibilityAnalysisResponse)
def compute_visibility_analysis(request: VisibilityAnalysisRequest) -> VisibilityAnalysisResponse:
    """
    Perform terrain-aware Sun and Earth visibility analysis across a defined time interval.
    Outputs time series, transition detections (sunrise/sunset, earthrise/earthset), and mission metrics.
    """
    try:
        return visibility_service.compute_visibility_analysis(request)
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=f"Required data source missing: {str(e)}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Visibility analysis error: {str(e)}")

@router.get("/status")
def get_visibility_status() -> Dict[str, Any]:
    """
    Return operational status of the visibility engine, DEM availability, and kernel status.
    """
    try:
        kernel_manager.ensure_kernels_loaded()
        k_status = kernel_manager.get_status()
        return {
            "service_name": "LUNAVISTA MVP 5 — Terrain-Aware Visibility & Illumination Engine",
            "status": "operational",
            "spice_status": k_status.get("service_status"),
            "primary_lunar_frame": "MOON_ME (DE421)",
            "disk_integration_method": "SLICED_SPHERICAL_DISK_INTEGRATION (31 horizontal slices)",
            "supported_bodies": ["Sun", "Earth"],
            "features": [
                "Finite disk partial visibility",
                "Terrain skyline obstruction",
                "Transition refinement (sunrise/sunset/earthrise/earthset)",
                "Uninterrupted darkness & blackout run-lengths",
                "Combined mission metrics",
            ],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error checking visibility status: {str(e)}")

@router.get("/provenance")
def get_visibility_provenance() -> Dict[str, Any]:
    """
    Return complete scientific provenance, mathematical models, and data citations.
    """
    return {
        "engine": "LUNAVISTA Terrain-Aware Visibility & Illumination Engine (MVP 5)",
        "lunar_reference_frame": "MOON_ME (DE421 Mean Earth/Polar Axis realization)",
        "lunar_datum": "IAU Moon 2000 Sphere (R = 1,737,400 m, flattening f = 0)",
        "terrain_data": "NASA LOLA 5m/px DEM (Barker et al., 2021)",
        "ephemeris_kernels": kernel_manager.get_provenance_metadata(),
        "mathematical_model": {
            "skyline_coordinate_system": "Topocentric Local East-North-Up (ENU) tangent basis",
            "azimuth_convention": "0°=North, 90°=East, 180°=South, 270°=West",
            "disk_geometry": "Spherical angular disk integrated across horizontal slices against local skyline",
            "transition_detection": "Bisection root-finding on limb clearance",
        },
        "scientific_caveats": [
            "Solar visibility and actual electrical power generation are different measurements. Terrain obstruction and solar-panel system parameters have not yet been evaluated.",
            "Geometric Earth visibility does not guarantee an operational radio link. Terrain obstruction and RF link-budget analysis have not yet been evaluated.",
            "If terrain horizon rays exit the active DEM boundary before the maximum search distance, visibility certainty is tagged as INDETERMINATE_PARTIAL_DEM for low-elevation bodies.",
        ],
    }
