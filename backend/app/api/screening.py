from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, Response, status

from app.schemas.screening import (
    CandidateScreeningRequest,
    CandidateScreeningResponse,
    ScreeningRunRecord,
)
from app.services.screening_service import screening_service

screening_router = APIRouter(prefix="/api/screening", tags=["Screening"])

@screening_router.post("/run", response_model=CandidateScreeningResponse, status_code=status.HTTP_201_CREATED)
def run_candidate_screening(req: CandidateScreeningRequest):
    """
    Executes a deterministic scientific screening run for one or more candidate scenarios
    against the specified mission profile requirements.
    """
    try:
        record = screening_service.run_screening(req)
        return CandidateScreeningResponse(run=record)
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Screening execution failed: {str(e)}")

@screening_router.get("/runs", response_model=List[ScreeningRunRecord])
def list_screening_runs():
    """Returns all historical candidate screening runs, sorted newest first."""
    return screening_service.list_runs()

@screening_router.get("/runs/{run_id}", response_model=ScreeningRunRecord)
def get_screening_run(run_id: str):
    """Retrieves full details of a specific screening run."""
    run = screening_service.get_run(run_id)
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Screening run '{run_id}' not found.")
    return run

@screening_router.delete("/runs/{run_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_screening_run(run_id: str):
    """Deletes a historical screening run."""
    success = screening_service.delete_run(run_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Screening run '{run_id}' not found.")
    return None

@screening_router.get("/runs/{run_id}/export/json")
def export_screening_json(run_id: str):
    """Exports structured JSON data for a screening run."""
    try:
        data = screening_service.export_run_json(run_id)
        return data
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Screening run '{run_id}' not found.")

@screening_router.get("/runs/{run_id}/export/csv")
def export_screening_csv(run_id: str):
    """Exports CSV table representation for a screening run."""
    try:
        csv_content = screening_service.export_run_csv(run_id)
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=lunavista_screening_{run_id}.csv"
            },
        )
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Screening run '{run_id}' not found.")
