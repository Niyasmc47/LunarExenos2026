from datetime import datetime, timezone
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, Response, status

from app.schemas.trade_off import (
    TradeOffStudyCreateRequest,
    TradeOffStudyUpdateRequest,
    TradeOffStudyRecord,
    TradeOffStudyResponse,
    AlternativeScoreBreakdown,
    AlternativeParetoResult,
    SensitivityAnalysisResponse,
)
from app.services.trade_off_service import trade_off_service

trade_off_router = APIRouter(prefix="/api/trade-off", tags=["Trade-off Analysis"])


@trade_off_router.post("/studies", response_model=TradeOffStudyResponse, status_code=status.HTTP_201_CREATED)
def create_study(req: TradeOffStudyCreateRequest):
    """
    Creates and immediately evaluates a multi-criteria mission trade-off study.
    Validates profile compatibility, alternative consistency, and non-negative weights.
    """
    try:
        study = trade_off_service.create_study(req)
        return TradeOffStudyResponse(study=study)
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to create trade-off study: {str(e)}")


@trade_off_router.get("/studies", response_model=List[TradeOffStudyRecord])
def list_studies():
    """Lists all saved trade-off studies sorted newest first."""
    return trade_off_service.list_studies()


@trade_off_router.get("/studies/{study_id}", response_model=TradeOffStudyRecord)
def get_study(study_id: str):
    """Retrieves full details of a specific trade-off study."""
    study = trade_off_service.get_study(study_id)
    if not study:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Trade-off study '{study_id}' not found.")
    return study


@trade_off_router.put("/studies/{study_id}", response_model=TradeOffStudyRecord)
def update_study(study_id: str, req: TradeOffStudyUpdateRequest):
    """Updates study alternatives, custom weights, or notes, and triggers re-analysis."""
    try:
        updated = trade_off_service.update_study(study_id, req)
        return updated
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to update trade-off study: {str(e)}")


@trade_off_router.delete("/studies/{study_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_study(study_id: str):
    """Permanently deletes a saved trade-off study."""
    success = trade_off_service.delete_study(study_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Trade-off study '{study_id}' not found.")
    return None


@trade_off_router.post("/studies/{study_id}/analyze", response_model=TradeOffStudyRecord)
def analyze_study(study_id: str):
    """Explicitly re-runs composite scoring and Pareto frontier calculation."""
    try:
        analyzed = trade_off_service.run_analysis(study_id)
        return analyzed
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to analyze trade-off study: {str(e)}")


@trade_off_router.get("/studies/{study_id}/results")
def get_study_results(study_id: str) -> Dict[str, Any]:
    """Retrieves computed composite scores, Pareto dominance results, and explanations."""
    study = trade_off_service.get_study(study_id)
    if not study:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Trade-off study '{study_id}' not found.")
    return {
        "study_id": study.id,
        "study_name": study.name,
        "scores": {k: v.model_dump() for k, v in study.scores.items()},
        "pareto_results": {k: v.model_dump() for k, v in study.pareto_results.items()},
        "analysis_timestamp_iso": study.analysis_timestamp_iso,
    }


@trade_off_router.post("/studies/{study_id}/sensitivity", response_model=SensitivityAnalysisResponse)
def execute_sensitivity_analysis(study_id: str):
    """Runs a multi-scenario weight sensitivity analysis."""
    try:
        res = trade_off_service.run_sensitivity(study_id)
        return res
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to execute sensitivity analysis: {str(e)}")


@trade_off_router.get("/studies/{study_id}/export/json")
def export_study_json(study_id: str):
    """Exports full trade-off study snapshot, provenance, scores, and Pareto results as JSON."""
    study = trade_off_service.get_study(study_id)
    if not study:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Trade-off study '{study_id}' not found.")

    filename = f"lunavista_tradeoff_{study.id}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.json"
    content = study.model_dump_json(indent=2)
    return Response(
        content=content,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@trade_off_router.get("/studies/{study_id}/export/csv")
def export_study_csv(study_id: str):
    """Exports structured alternative comparison matrix as standard CSV."""
    try:
        csv_data = trade_off_service.export_csv(study_id)
        filename = f"lunavista_tradeoff_{study_id}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"
        return Response(
            content=csv_data,
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"CSV export failed: {str(e)}")
