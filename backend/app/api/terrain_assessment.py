from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, Response, status

from app.schemas.terrain_assessment import (
    TerrainAssessmentRequest,
    TerrainAssessmentResponse,
    TerrainAssessmentRecord,
    CandidateTerrainAssessment,
)
from app.services.terrain_assessment_service import terrain_assessment_service

terrain_assessment_router = APIRouter(prefix="/api/terrain-assessment", tags=["Terrain Assessment"])

@terrain_assessment_router.post("/assess", response_model=TerrainAssessmentResponse, status_code=status.HTTP_201_CREATED)
def assess_candidates(req: TerrainAssessmentRequest):
    """
    Executes a high-resolution lunar terrain suitability assessment for one or more
    candidate scenarios against configured mission profile terrain requirements.
    """
    try:
        record = terrain_assessment_service.assess_candidates(req)
        return TerrainAssessmentResponse(assessment=record)
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Terrain assessment execution failed: {str(e)}")

@terrain_assessment_router.get("/assessments", response_model=List[TerrainAssessmentRecord])
def list_assessments():
    """Returns all historical terrain assessment records, sorted newest first."""
    return terrain_assessment_service.list_assessments()

@terrain_assessment_router.get("/assessments/{assessment_id}", response_model=TerrainAssessmentRecord)
def get_assessment(assessment_id: str):
    """Retrieves full details of a specific terrain assessment record."""
    record = terrain_assessment_service.get_assessment(assessment_id)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Terrain assessment '{assessment_id}' not found.")
    return record

@terrain_assessment_router.get("/assessments/{assessment_id}/candidates/{candidate_id}", response_model=CandidateTerrainAssessment)
def get_candidate_assessment(assessment_id: str, candidate_id: str):
    """Retrieves detailed terrain metrics and requirement verdicts for a specific candidate."""
    record = terrain_assessment_service.get_assessment(assessment_id)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Terrain assessment '{assessment_id}' not found.")
    for cand in record.candidates:
        if cand.candidate_id == candidate_id:
            return cand
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Candidate '{candidate_id}' not found in assessment '{assessment_id}'.")

@terrain_assessment_router.delete("/assessments/{assessment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_assessment(assessment_id: str):
    """Deletes a historical terrain assessment record."""
    success = terrain_assessment_service.delete_assessment(assessment_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Terrain assessment '{assessment_id}' not found.")
    return None

@terrain_assessment_router.get("/assessments/{assessment_id}/export/json")
def export_assessment_json(assessment_id: str):
    """Exports structured JSON data for a terrain assessment record."""
    try:
        return terrain_assessment_service.export_assessment_json(assessment_id)
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Terrain assessment '{assessment_id}' not found.")

@terrain_assessment_router.get("/assessments/{assessment_id}/export/csv")
def export_assessment_csv(assessment_id: str):
    """Exports CSV tabular report for a terrain assessment record."""
    try:
        csv_content = terrain_assessment_service.export_assessment_csv(assessment_id)
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=lunavista_terrain_assessment_{assessment_id}.csv"
            },
        )
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Terrain assessment '{assessment_id}' not found.")
