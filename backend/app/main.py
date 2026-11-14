from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.terrain import router as terrain_router

app = FastAPI(
    title="LUNAVISTA Lunar Terrain Engine API",
    description="High-resolution LOLA DEM elevation, slope, and terrain mesh services for Lunar Landing Sites",
    version="0.2.0",
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
