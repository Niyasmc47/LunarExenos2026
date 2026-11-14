from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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

app = FastAPI(
    title="LUNAVISTA Dynamic Lunar Terrain Analysis API",
    description="High-resolution NASA LOLA DEM discovery, regional elevation, slope, hillshading, transects, and scientific statistics",
    version="0.3.0",
)

# Enable CORS for frontend Vite development server
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

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "LUNAVISTA Terrain Engine",
        "version": "0.2.0"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
