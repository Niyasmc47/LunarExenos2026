from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import JSONResponse, PlainTextResponse

from app.schemas.decision_report import (
    DecisionReportCreateRequest,
    DecisionReportRecord,
    DecisionReportListResponse,
    DecisionReportResponse,
)
from app.services.decision_report_service import decision_report_service

decision_reports_router = APIRouter(prefix="/api/decision-reports", tags=["Decision Reports"])


@decision_reports_router.post("/", response_model=DecisionReportResponse, status_code=201)
def create_report(req: DecisionReportCreateRequest):
    """Generates and persists a structured 12-section technical Mission Decision Report."""
    try:
        report = decision_report_service.create_report(req)
        return DecisionReportResponse(report=report)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate mission decision report: {str(e)}")


@decision_reports_router.get("/", response_model=DecisionReportListResponse)
def list_reports():
    """Lists summary records of all historical mission decision reports."""
    reports = decision_report_service.list_reports()
    return DecisionReportListResponse(reports=reports)


@decision_reports_router.get("/{report_id}", response_model=DecisionReportResponse)
def get_report(report_id: str):
    """Retrieves full details of a specific mission decision report by ID."""
    report = decision_report_service.get_report(report_id)
    if not report:
        raise HTTPException(status_code=404, detail=f"Mission decision report '{report_id}' not found.")
    return DecisionReportResponse(report=report)


@decision_reports_router.delete("/{report_id}")
def delete_report(report_id: str):
    """Deletes a historical mission decision report."""
    success = decision_report_service.delete_report(report_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Mission decision report '{report_id}' not found.")
    return {"status": "deleted", "report_id": report_id}


@decision_reports_router.get("/{report_id}/export/pdf")
def export_report_pdf(report_id: str):
    """Exports the mission decision report as a publication-grade PDF file."""
    try:
        pdf_bytes = decision_report_service.export_pdf(report_id)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={report_id}.pdf"},
        )
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export PDF report: {str(e)}")


@decision_reports_router.get("/{report_id}/export/json")
def export_report_json(report_id: str):
    """Exports the complete frozen mission decision report as a structured JSON object."""
    report = decision_report_service.get_report(report_id)
    if not report:
        raise HTTPException(status_code=404, detail=f"Mission decision report '{report_id}' not found.")
    return JSONResponse(
        content=report.model_dump(mode="json"),
        headers={"Content-Disposition": f"attachment; filename={report_id}.json"},
    )


@decision_reports_router.get("/{report_id}/export/csv")
def export_report_csv(report_id: str):
    """Exports the comprehensive candidate comparison matrix as standard CSV."""
    try:
        csv_str = decision_report_service.export_csv(report_id)
        return PlainTextResponse(
            content=csv_str,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={report_id}_comparison.csv"},
        )
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export CSV: {str(e)}")
