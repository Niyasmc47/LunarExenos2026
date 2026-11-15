from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from app.api.terrain import router as terrain_router
from app.api.datasets import router as datasets_router
from app.api.regional_analysis import router as regional_router
from app.api.exports import router as exports_router
from app.api.horizon import router as horizon_router
from app.api.ephemeris import router as ephemeris_router
from app.api.visibility import router as visibility_router
from app.api.scenarios import scenarios_router
from app.api.mission_profiles import router as profiles_router
from app.api.screening import screening_router
from app.api.window_planner import window_planner_router
from app.api.terrain_assessment import terrain_assessment_router
from app.api.trade_off import trade_off_router
from app.api.decision_reports import decision_reports_router

tags_metadata = [
    {
        "name": "Health / System",
        "description": "Backend operational health status, telemetry, and service availability checks.",
    },
    {
        "name": "Terrain",
        "description": "NASA LOLA 5 m DEM surface elevation, terrain slope, roughness, 3D mesh geometry, and point inspection.",
    },
    {
        "name": "Datasets",
        "description": "NASA Planetary Data System (PDS) Product 78 multi-region catalogue discovery, spatial bounding boxes, and coverage analysis.",
    },
    {
        "name": "Regional Analysis",
        "description": "Dynamic regional elevation maps, hillshade calculations, colormapping, and transect profile analysis.",
    },
    {
        "name": "Exports",
        "description": "Scientific data product exports including clipped GeoTIFF rasters, CSV elevation transects, and summary statistics.",
    },
    {
        "name": "Horizon",
        "description": "360° topocentric terrain horizon skyline engine: elevation profiles, radial ray-casting, and obstruction angles.",
    },
    {
        "name": "Ephemeris",
        "description": "Planetary ephemerides via CSPICE and DE421 kernels: apparent topocentric azimuth, elevation, and distance for Sun and Earth.",
    },
    {
        "name": "Visibility",
        "description": "Terrain-aware finite celestial disk line-of-sight integration, sunrise/sunset, earthrise/earthset, and solar/Earth visibility durations.",
    },
    {
        "name": "Scenarios",
        "description": "Candidate lunar landing site scenario definitions, persistence, configuration, and multi-scenario comparisons.",
    },
    {
        "name": "Mission Profiles",
        "description": "Mission requirement profiles, operational engineering constraints, validation, and starter templates.",
    },
    {
        "name": "Screening",
        "description": "Multi-candidate screening engine: evaluates sites against profile requirements with scope mismatch detection and data provenance.",
    },
    {
        "name": "Mission Window Planning",
        "description": "Mission launch/start window search: evaluates candidate landing sites across multi-day time intervals for compliant mission windows.",
    },
    {
        "name": "Terrain Assessment",
        "description": "Spatial landing hazard assessment: circular buffer slope statistics, roughness, relief, and touchdown safety verification.",
    },
    {
        "name": "Trade-off Analysis",
        "description": "Multi-criteria decision analysis (MCDA), Pareto-frontier identification, criterion weighting, and sensitivity analysis.",
    },
    {
        "name": "Decision Reports",
        "description": "Structured technical mission evaluation reports, archival JSON schemas, audit trails, and PDF generation.",
    },
]

app = FastAPI(
    title="LUNAVISTA Lunar Mission Architecture & Scientific Analysis API",
    description=(
        "Scientific REST API powering LUNAVISTA: NASA LOLA 5 m DEM terrain analysis, "
        "CSPICE/DE421 planetary ephemerides, 360° topocentric horizon computation, "
        "finite celestial disk visibility integration, candidate screening, "
        "mission window planning, landing hazard assessment, and trade-off analysis."
    ),
    version="0.3.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    openapi_tags=tags_metadata,
)

# Enable CORS for frontend development server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(terrain_router)
app.include_router(datasets_router)
app.include_router(regional_router)
app.include_router(exports_router)
app.include_router(horizon_router)
app.include_router(ephemeris_router)
app.include_router(visibility_router)
app.include_router(scenarios_router)
app.include_router(profiles_router)
app.include_router(screening_router)
app.include_router(window_planner_router)
app.include_router(terrain_assessment_router)
app.include_router(trade_off_router)
app.include_router(decision_reports_router)


class HealthResponse(BaseModel):
    status: str = Field("healthy", description="Operational status of the service")
    service: str = Field("LUNAVISTA Lunar Terrain Engine", description="Service name")
    version: str = Field("0.3.0", description="API version")


@app.get("/", include_in_schema=False)
def root():
    """Redirects root URL directly to Swagger UI."""
    return RedirectResponse(url="/docs")


@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["Health / System"],
    summary="Health check & telemetry status",
    description="Returns operational health status, active service version, and subsystem availability.",
)
def health_check():
    return HealthResponse(
        status="healthy",
        service="LUNAVISTA Lunar Terrain Engine",
        version="0.3.0",
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
