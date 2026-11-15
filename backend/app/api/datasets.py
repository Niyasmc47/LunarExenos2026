"""
API routes for NASA Lunar Dataset Catalogue and Automatic Discovery.
"""

from fastapi import APIRouter, HTTPException, Query
from app.schemas.dataset import (
    DatasetCatalogueResponse,
    DatasetRecord,
    DatasetDiscoveryRequest,
    DatasetDiscoveryResponse,
)
from app.services.dataset_catalogue import catalogue_service
from app.services.dataset_discovery import discovery_engine

router = APIRouter(prefix="/api/datasets", tags=["Datasets"])

@router.get("/catalogue", response_model=DatasetCatalogueResponse)
def get_dataset_catalogue():
    """Returns the complete registry of NASA LOLA datasets."""
    datasets = catalogue_service.list_all()
    return DatasetCatalogueResponse(
        total_datasets=len(datasets),
        datasets=datasets,
    )

@router.get("/{dataset_id}", response_model=DatasetRecord)
def get_dataset_details(dataset_id: str):
    """Returns detailed metadata and citations for a specific dataset."""
    record = catalogue_service.get_by_id(dataset_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Dataset '{dataset_id}' not found in catalogue.")
    return record

@router.post("/discover", response_model=DatasetDiscoveryResponse)
def discover_datasets_for_region(req: DatasetDiscoveryRequest):
    """
    Analyzes the user-selected bounding box and automatically discovers
    the best available NASA LOLA datasets, providing resolution and coverage recommendations.
    """
    return discovery_engine.discover_datasets_for_region(
        min_lat=req.min_latitude,
        max_lat=req.max_latitude,
        min_lon=req.min_longitude,
        max_lon=req.max_longitude,
    )
