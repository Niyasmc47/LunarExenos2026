from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.terrain import router as terrain_router
from app.api.datasets import router as datasets_router
from app.api.regional_analysis import router as regional_router
from app.api.exports import router as exports_router

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
