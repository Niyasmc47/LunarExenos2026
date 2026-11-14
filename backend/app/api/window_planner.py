from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel, Field

from app.schemas.window_planner import (
    MissionWindowSearchRequest,
    MissionWindowSearchResponse,
    MissionWindowSearchRecord,
    EvaluatedMissionWindow,
    WindowComparisonResponse,
)
from app.services.window_planner_service import window_planner_service

class CompareWindowsPayload(BaseModel):
    window_ids: List[str] = Field(..., min_length=2, max_length=4, description="List of 2 to 4 window IDs to compare")

window_planner_router = APIRouter(prefix="/api/window-planner", tags=["mission-window-planner"])

@window_planner_router.post("/search", response_model=MissionWindowSearchResponse, status_code=status.HTTP_201_CREATED)
def execute_window_search(req: MissionWindowSearchRequest):
    """
    Executes a high-resolution lunar mission start-window search over the specified
    date range [search_start_iso, search_end_iso] for a candidate scenario and mission profile.
    """
    try:
        record = window_planner_service.execute_window_search(req)
        return MissionWindowSearchResponse(search=record)
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Window search failed: {str(e)}")

@window_planner_router.get("/searches", response_model=List[MissionWindowSearchRecord])
def list_window_searches():
    """Returns all historical mission window searches, sorted newest first."""
    return window_planner_service.list_searches()

@window_planner_router.get("/searches/{search_id}", response_model=MissionWindowSearchRecord)
def get_window_search(search_id: str):
    """Retrieves full details of a specific mission window search record."""
    record = window_planner_service.get_search(search_id)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Search record '{search_id}' not found.")
    return record

@window_planner_router.delete("/searches/{search_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_window_search(search_id: str):
    """Deletes a historical mission window search."""
    success = window_planner_service.delete_search(search_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Search record '{search_id}' not found.")
    return None

@window_planner_router.get("/searches/{search_id}/windows/{window_id}", response_model=EvaluatedMissionWindow)
def get_window_detail(search_id: str, window_id: str):
    """Retrieves detailed constraint evaluation and metrics for a specific window in a search."""
    search = window_planner_service.get_search(search_id)
    if not search:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Search record '{search_id}' not found.")
    for w in search.windows:
        if w.window_id == window_id:
            return w
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Window '{window_id}' not found in search '{search_id}'.")

@window_planner_router.post("/searches/{search_id}/compare", response_model=WindowComparisonResponse)
def compare_windows(search_id: str, payload: CompareWindowsPayload):
    """Compares 2 to 4 windows within the same search record side-by-side."""
    try:
        return window_planner_service.compare_windows(search_id, payload.window_ids)
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Window comparison failed: {str(e)}")

@window_planner_router.get("/searches/{search_id}/export/json")
def export_search_json(search_id: str):
    """Exports structured JSON data for a mission window search."""
    try:
        return window_planner_service.export_search_json(search_id)
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Search record '{search_id}' not found.")

@window_planner_router.get("/searches/{search_id}/export/csv")
def export_search_csv(search_id: str):
    """Exports CSV tabular format for a mission window search."""
    try:
        csv_content = window_planner_service.export_search_csv(search_id)
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=lunavista_windows_{search_id}.csv"
            },
        )
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Search record '{search_id}' not found.")
