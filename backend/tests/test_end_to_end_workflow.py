import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_full_mission_lifecycle_end_to_end():
    """
    Validates the complete end-to-end scientific and decision support lifecycle:
    1. Create mission profile with hard constraints (MVP 7.1)
    2. Inspect available candidate scenarios (MVP 6)
    3. Run candidate screening (MVP 7.2)
    4. Plan mission start windows (MVP 7.3)
    5. Evaluate terrain suitability (MVP 7.4)
    6. Conduct multi-criteria trade-off analysis (MVP 7.5 & 7.5.1)
    7. Generate comprehensive technical mission decision report (MVP 7.6)
    8. Export publication PDF, CSV matrix, and structured JSON report
    """
    # Step 1: Create Mission Profile
    profile_payload = {
        "name": "Artemis E2E Validation Profile",
        "description": "Profile verifying end-to-end integration across all 12 LUNAVISTA modules",
        "mission_type": "robotic_lander",
        "duration_days": 3.0,
        "intended_analysis_start_iso": "2026-10-04T12:00:00Z",
        "intended_analysis_end_iso": "2026-10-07T12:00:00Z",
        "observer_height_m": 2.0,
        "requirements_config": {
            "solar": {
                "min_total_sunlight_hours": {
                    "id": "solar-total-hours",
                    "name": "Minimum Total Sunlight Duration",
                    "classification": "HARD_CONSTRAINT",
                    "operator": ">=",
                    "value": 15.0,
                    "unit": "hours",
                    "enabled": True,
                }
            },
            "terrain": {
                "max_local_slope_deg": {
                    "id": "trn-max-slope",
                    "name": "Maximum Local Slope",
                    "classification": "HARD_CONSTRAINT",
                    "operator": "<=",
                    "value": 20.0,
                    "unit": "deg",
                    "enabled": True,
                }
            },
        },
    }
    p_res = client.post("/api/profiles/", json=profile_payload)
    assert p_res.status_code == 201
    profile = p_res.json()
    profile_id = profile["id"]

    # Step 2: Retrieve Scenarios
    scen_res = client.get("/api/scenarios/")
    assert scen_res.status_code == 200
    scenarios = scen_res.json()
    assert len(scenarios) >= 2
    scen_a = scenarios[0]
    scen_b = scenarios[1]

    # Step 3: Run Candidate Screening
    screen_payload = {
        "profile_id": profile_id,
        "scenario_ids": [scen_a["id"], scen_b["id"]],
        "name": "E2E Screening Run",
    }
    screen_res = client.post("/api/screening/run", json=screen_payload)
    assert screen_res.status_code == 201
    screening_run = screen_res.json()["run"]
    screening_id = screening_run["id"]
    assert len(screening_run["candidates"]) == 2

    # Step 4: Search Mission Windows
    win_payload = {
        "profile_id": profile_id,
        "scenario_id": scen_a["id"],
        "search_start_iso": "2026-10-04T12:00:00Z",
        "search_end_iso": "2026-10-08T12:00:00Z",
        "mission_duration_days": 3.0,
        "search_step_hours": 12.0,
    }
    win_res = client.post("/api/window-planner/search", json=win_payload)
    assert win_res.status_code == 201
    win_search = win_res.json()["search"]
    win_search_id = win_search["id"]
    assert len(win_search["windows"]) >= 1

    # Step 5: Assess Terrain Suitability
    trn_payload = {
        "profile_id": profile_id,
        "scenario_ids": [scen_a["id"], scen_b["id"]],
        "assessment_radius_m": 50.0,
        "name": "E2E Terrain Assessment",
    }
    trn_res = client.post("/api/terrain-assessment/assess", json=trn_payload)
    assert trn_res.status_code == 201
    terrain_assessment = trn_res.json()["assessment"]
    terrain_id = terrain_assessment["id"]
    assert len(terrain_assessment["candidates"]) == 2

    # Step 6: Multi-Criteria Trade-off Analysis
    trade_payload = {
        "name": "E2E Multi-Criteria Trade-Off Study",
        "profile_id": profile_id,
        "nominal_duration_days": 3.0,
        "alternatives": [
            {
                "name": f"{scen_a['name']} (Window 1)",
                "scenario_id": scen_a["id"],
                "window_search_id": win_search_id,
                "window_id": win_search["windows"][0]["window_id"],
                "terrain_assessment_id": terrain_id,
            },
            {
                "name": f"{scen_b['name']} (Direct)",
                "scenario_id": scen_b["id"],
                "terrain_assessment_id": terrain_id,
            },
        ],
    }
    trade_res = client.post("/api/trade-off/studies", json=trade_payload)
    assert trade_res.status_code == 201
    trade_study = trade_res.json()["study"]
    trade_study_id = trade_study["id"]
    assert len(trade_study["alternatives"]) == 2
    assert len(trade_study["scores"]) == 2
    assert len(trade_study["pareto_results"]) == 2

    # Step 7: Generate Mission Decision Report
    report_payload = {
        "title": "Comprehensive E2E Mission Decision Report",
        "mission_name": "Artemis Polar Integration Mission",
        "description": "Final synthesis covering all domains for lunar south polar landing.",
        "author_organization": "LUNAVISTA Flight Operations",
        "profile_id": profile_id,
        "trade_off_study_id": trade_study_id,
        "screening_run_id": screening_id,
        "window_search_id": win_search_id,
        "terrain_assessment_id": terrain_id,
        "executive_summary_notes": "All technical clearances verified against NASA LOLA 5m DEM and DE421 ephemeris.",
    }
    rep_res = client.post("/api/reports/", json=report_payload)
    assert rep_res.status_code == 201
    report = rep_res.json()["report"]
    report_id = report["id"]

    assert len(report["sections"]) == 12
    assert report["total_candidates_evaluated"] >= 2
    assert report["has_recommended_winner"] is False  # Human decision authority preserved

    # Step 8: Verify Exports
    # PDF
    pdf_res = client.get(f"/api/reports/{report_id}/export/pdf")
    assert pdf_res.status_code == 200
    assert pdf_res.headers["content-type"] == "application/pdf"
    assert pdf_res.content.startswith(b"%PDF-1.4")

    # JSON
    json_res = client.get(f"/api/reports/{report_id}/export/json")
    assert json_res.status_code == 200
    assert json_res.headers["content-type"] == "application/json"
    assert json_res.json()["id"] == report_id

    # CSV
    csv_res = client.get(f"/api/reports/{report_id}/export/csv")
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.headers["content-type"]
    assert "Candidate ID" in csv_res.text
