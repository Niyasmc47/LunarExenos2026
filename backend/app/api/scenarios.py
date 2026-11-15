from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, Response
from app.schemas.scenario import (
    ScenarioRecord,
    ScenarioCreateRequest,
    ScenarioUpdateRequest,
    MultiScenarioComparisonRequest,
    MultiScenarioComparisonResponse,
    ScenarioExportRequest,
)
from app.services.scenario_service import scenario_service

scenarios_router = APIRouter(prefix="/api/scenarios", tags=["Scenarios"])

@scenarios_router.get("", response_model=List[ScenarioRecord])
def list_scenarios():
    """Returns all available candidate mission scenarios."""
    return scenario_service.list_scenarios()

@scenarios_router.post("", response_model=ScenarioRecord, status_code=201)
def create_scenario(req: ScenarioCreateRequest):
    """Creates a new mission scenario with validated DEM bounds and dates."""
    try:
        return scenario_service.create_scenario(req)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# Static POST routes MUST come before /{scenario_id} routes to avoid path conflicts
@scenarios_router.post("/compare", response_model=MultiScenarioComparisonResponse)
def compare_scenarios(req: MultiScenarioComparisonRequest):
    """
    Executes a multi-scenario comparison across 2 to 4 candidate scenarios,
    evaluating solar illumination, Earth line-of-sight, terrain characteristics,
    and user-defined mission constraints.
    """
    try:
        return scenario_service.compare_scenarios(req)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scenario comparison failed: {str(e)}")

@scenarios_router.post("/export")
def export_comparison(req: ScenarioExportRequest):
    """
    Exports a completed multi-scenario comparison report in CSV or JSON format.
    """
    exported_content = scenario_service.export_comparison(req.comparison_response, req.format)
    if req.format == "csv":
        return Response(
            content=exported_content,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=lunavista_comparison_{req.comparison_response.comparison_id}.csv"},
        )
    return Response(
        content=exported_content,
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=lunavista_comparison_{req.comparison_response.comparison_id}.json"},
    )

@scenarios_router.get("/{scenario_id}", response_model=ScenarioRecord)
def get_scenario(scenario_id: str):
    """Retrieves a single mission scenario by ID."""
    sc = scenario_service.get_scenario(scenario_id)
    if not sc:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found.")
    return sc

@scenarios_router.put("/{scenario_id}", response_model=ScenarioRecord)
def update_scenario(scenario_id: str, req: ScenarioUpdateRequest):
    """Updates an existing mission scenario with re-validation."""
    try:
        return scenario_service.update_scenario(scenario_id, req)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found.")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@scenarios_router.delete("/{scenario_id}")
def delete_scenario(scenario_id: str):
    """Deletes a mission scenario."""
    deleted = scenario_service.delete_scenario(scenario_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found.")
    return {"status": "success", "deleted_scenario_id": scenario_id}

@scenarios_router.post("/{scenario_id}/duplicate", response_model=ScenarioRecord, status_code=201)
def duplicate_scenario(scenario_id: str):
    """Duplicates an existing mission scenario."""
    try:
        return scenario_service.duplicate_scenario(scenario_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found.")

