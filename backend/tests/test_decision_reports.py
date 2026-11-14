import json
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.mission_profile import MissionProfileCreateRequest
from app.schemas.trade_off import TradeOffStudyCreateRequest, MissionAlternativeInput
from app.services.mission_profile_service import mission_profile_service
from app.services.scenario_service import scenario_service
from app.services.trade_off_service import trade_off_service
from app.services.decision_report_service import decision_report_service

client = TestClient(app)


@pytest.fixture
def report_fixtures():
    """Sets up mission profile, scenarios, and a trade-off study for report tests."""
    profile_req = MissionProfileCreateRequest(
        name="Report Verification Profile",
        description="Profile used for verifying technical mission decision report generation",
        mission_type="robotic_lander",
        duration_days=3.0,
        intended_analysis_start_iso="2026-10-04T12:00:00Z",
        intended_analysis_end_iso="2026-10-07T12:00:00Z",
        observer_height_m=2.0,
        requirements_config={
            "solar": {
                "min_total_sunlight_hours": {
                    "id": "solar-total-hours",
                    "name": "Minimum Total Sunlight Duration",
                    "classification": "HARD_CONSTRAINT",
                    "operator": ">=",
                    "value": 20.0,
                    "unit": "hours",
                    "enabled": True,
                }
            }
        },
    )
    profile = mission_profile_service.create_profile(profile_req)
    scenarios = scenario_service.list_scenarios()

    # Create a trade-off study
    study_req = TradeOffStudyCreateRequest(
        name="Study for Report Testing",
        profile_id=profile.id,
        nominal_duration_days=3.0,
        alternatives=[
            MissionAlternativeInput(name="Site Alpha", scenario_id=scenarios[0].id),
            MissionAlternativeInput(name="Site Beta", scenario_id=scenarios[1].id),
        ],
    )
    study = trade_off_service.create_study(study_req)

    return {"profile": profile, "scenarios": scenarios, "study": study}


def test_create_and_read_decision_report(report_fixtures):
    """
    Verifies that a comprehensive 12-section technical decision report is created,
    persisted, and retrieved with full fidelity and immutable snapshots.
    """
    profile = report_fixtures["profile"]
    study = report_fixtures["study"]

    req_data = {
        "title": "Artemis Polar Landing Evaluation Report",
        "mission_name": "Artemis Polar Scout-1",
        "description": "Comprehensive decision support synthesis for south polar candidate selection.",
        "author_organization": "NASA / LUNAVISTA Directorate",
        "profile_id": profile.id,
        "trade_off_study_id": study.id,
        "executive_summary_notes": "Preliminary analysis indicates high solar illumination along the ridge.",
    }

    res = client.post("/api/decision-reports/", json=req_data)
    assert res.status_code == 201
    rep = res.json()["report"]

    assert rep["id"].startswith("rep-")
    assert rep["title"] == "Artemis Polar Landing Evaluation Report"
    assert rep["mission_name"] == "Artemis Polar Scout-1"
    assert rep["profile_snapshot"]["id"] == profile.id
    assert rep["total_candidates_evaluated"] >= 2

    # Verify all 12 canonical technical sections exist
    sections = rep["sections"]
    assert len(sections) == 12
    sec_ids = [s["section_id"] for s in sections]
    assert "sec-cover-overview" in sec_ids
    assert "sec-exec-summary" in sec_ids
    assert "sec-requirements" in sec_ids
    assert "sec-candidates" in sec_ids
    assert "sec-screening-results" in sec_ids
    assert "sec-window-analysis" in sec_ids
    assert "sec-terrain-assessment" in sec_ids
    assert "sec-horizon-celestial" in sec_ids
    assert "sec-trade-off-analysis" in sec_ids
    assert "sec-comparison-matrix" in sec_ids
    assert "sec-uncertainty-limitations" in sec_ids
    assert "sec-final-findings" in sec_ids

    # Check human decision checklist
    assert len(rep["human_decision_checklist"]) >= 4

    # Check GET /api/decision-reports/{id}
    get_res = client.get(f"/api/decision-reports/{rep['id']}")
    assert get_res.status_code == 200
    assert get_res.json()["report"]["id"] == rep["id"]

    # Check GET /api/decision-reports/ list
    list_res = client.get("/api/decision-reports/")
    assert list_res.status_code == 200
    reports_list = list_res.json()["reports"]
    assert any(r["id"] == rep["id"] for r in reports_list)


def test_export_pdf_report(report_fixtures):
    """Verifies that the PDF export endpoint generates a valid, standard PDF 1.4 byte stream."""
    profile = report_fixtures["profile"]
    study = report_fixtures["study"]

    req_data = {
        "title": "PDF Technical Report Export Test",
        "mission_name": "Artemis VII",
        "profile_id": profile.id,
        "trade_off_study_id": study.id,
    }
    create_res = client.post("/api/decision-reports/", json=req_data)
    rep_id = create_res.json()["report"]["id"]

    pdf_res = client.get(f"/api/decision-reports/{rep_id}/export/pdf")
    assert pdf_res.status_code == 200
    assert pdf_res.headers["content-type"] == "application/pdf"
    assert f"{rep_id}.pdf" in pdf_res.headers["content-disposition"]

    pdf_bytes = pdf_res.content
    assert pdf_bytes.startswith(b"%PDF-1.4")
    assert b"%%EOF" in pdf_bytes
    assert len(pdf_bytes) > 2000  # Multi-page technical report


def test_export_json_and_csv_report(report_fixtures):
    """Verifies that JSON and CSV exports contain full structured data and table rows."""
    profile = report_fixtures["profile"]
    study = report_fixtures["study"]

    req_data = {
        "title": "Export Verification Report",
        "mission_name": "Artemis VIII",
        "profile_id": profile.id,
        "trade_off_study_id": study.id,
    }
    create_res = client.post("/api/decision-reports/", json=req_data)
    rep_id = create_res.json()["report"]["id"]

    # 1. JSON Export
    json_res = client.get(f"/api/decision-reports/{rep_id}/export/json")
    assert json_res.status_code == 200
    assert "application/json" in json_res.headers["content-type"]
    exported_data = json_res.json()
    assert exported_data["id"] == rep_id
    assert "sections" in exported_data
    assert "scientific_disclaimers" in exported_data

    # 2. CSV Export
    csv_res = client.get(f"/api/decision-reports/{rep_id}/export/csv")
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.headers["content-type"]
    csv_text = csv_res.text
    assert "# LUNAVISTA Mission Decision Analysis Report" in csv_text
    assert "Candidate ID" in csv_text
    assert "Latitude (deg)" in csv_text
    assert "Mandatory Scientific Disclaimers" in csv_text


def test_report_immutability_across_profile_updates(report_fixtures):
    """
    Verifies that updating the source mission profile after report creation
    does NOT alter the historical report's frozen profile snapshot.
    """
    profile = report_fixtures["profile"]
    study = report_fixtures["study"]

    req_data = {
        "title": "Immutability Test Report",
        "mission_name": "Frozen Profile Test",
        "profile_id": profile.id,
        "trade_off_study_id": study.id,
    }
    create_res = client.post("/api/decision-reports/", json=req_data)
    rep_id = create_res.json()["report"]["id"]

    # Mutate the original profile
    from app.schemas.mission_profile import MissionProfileUpdateRequest
    update_req = MissionProfileUpdateRequest(
        name="Mutated Profile Name That Must Not Leak",
        description="Updated description",
    )
    mission_profile_service.update_profile(profile.id, update_req)

    # Re-fetch report and assert frozen profile snapshot is untouched
    fetch_res = client.get(f"/api/decision-reports/{rep_id}")
    fetched_rep = fetch_res.json()["report"]
    assert fetched_rep["profile_snapshot"]["name"] == "Report Verification Profile"
    assert fetched_rep["profile_snapshot"]["name"] != "Mutated Profile Name That Must Not Leak"


def test_delete_report(report_fixtures):
    """Verifies report deletion."""
    profile = report_fixtures["profile"]
    study = report_fixtures["study"]

    req_data = {
        "title": "Delete Test Report",
        "mission_name": "Deletable Mission",
        "profile_id": profile.id,
        "trade_off_study_id": study.id,
    }
    create_res = client.post("/api/decision-reports/", json=req_data)
    rep_id = create_res.json()["report"]["id"]

    del_res = client.delete(f"/api/decision-reports/{rep_id}")
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "deleted"

    get_res = client.get(f"/api/decision-reports/{rep_id}")
    assert get_res.status_code == 404
