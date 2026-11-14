import pytest
import json
from concurrent.futures import ThreadPoolExecutor
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.mission_profile import (
    MissionType,
    RequirementClassification,
    MissionRequirementsSet,
    SolarRequirementsConfig,
    EarthRequirementsConfig,
    TerrainRequirementsConfig,
    SingleRequirement,
    MissionProfileCreateRequest,
)
from app.schemas.screening import (
    CandidateScreeningRequest,
    ScreeningVerdict,
    OverallCandidateStatus,
)
from app.services.mission_profile_service import mission_profile_service
from app.services.scenario_service import scenario_service
from app.services.screening_service import CandidateScreeningService

client = TestClient(app)

@pytest.fixture(scope="module")
def setup_screening_fixtures():
    """Sets up a known valid profile and candidate scenarios for screening tests."""
    # Create test mission profile with strict hard constraints
    prof_req = MissionProfileCreateRequest(
        name="Screening Test Rover Profile",
        description="Profile used for candidate screening test suite.",
        mission_type=MissionType.ROBOTIC_EXPLORATION,
        duration_days=3.0,  # 72 hours
        start_timestamp_iso="2026-10-04T12:00:00Z",
        end_timestamp_iso="2026-10-07T12:00:00Z",
        observer_height_m=2.0,
        requirements=MissionRequirementsSet(
            solar=SolarRequirementsConfig(
                min_total_sunlight_hours=SingleRequirement(
                    id="min_total_sunlight_hours",
                    name="Minimum Total Geometric Sunlight",
                    classification=RequirementClassification.HARD_CONSTRAINT,
                    enabled=True,
                    value=40.0,
                    unit="hours",
                    operator="ge",
                    description="Battery energy harvesting minimum.",
                ),
                max_continuous_darkness_hours=SingleRequirement(
                    id="max_continuous_darkness_hours",
                    name="Maximum Continuous Darkness",
                    classification=RequirementClassification.HARD_CONSTRAINT,
                    enabled=True,
                    value=20.0,
                    unit="hours",
                    operator="le",
                    description="Secondary battery survival limit.",
                ),
                min_sunlight_percentage=SingleRequirement(
                    id="min_sunlight_percentage",
                    name="Minimum Sunlight Percentage",
                    classification=RequirementClassification.SOFT_PREFERENCE,
                    enabled=True,
                    value=60.0,
                    unit="%",
                    operator="ge",
                    description="Preference for overall illumination.",
                ),
                min_daily_sunlight_hours=SingleRequirement(
                    id="min_daily_sunlight_hours",
                    name="Minimum Daily Sunlight",
                    classification=RequirementClassification.HARD_CONSTRAINT,
                    enabled=True,
                    value=8.0,
                    unit="hours/day",
                    operator="ge",
                    description="Daily 24h operational floor.",
                ),
            ),
            earth=EarthRequirementsConfig(
                min_total_earth_visible_hours=SingleRequirement(
                    id="min_total_earth_visible_hours",
                    name="Minimum Earth Line-of-Sight",
                    classification=RequirementClassification.HARD_CONSTRAINT,
                    enabled=True,
                    value=30.0,
                    unit="hours",
                    operator="ge",
                    description="Direct-to-Earth communication pass minimum.",
                ),
                max_continuous_earth_blackout_hours=SingleRequirement(
                    id="max_continuous_earth_blackout_hours",
                    name="Maximum Continuous Blackout",
                    classification=RequirementClassification.SOFT_PREFERENCE,
                    enabled=True,
                    value=12.0,
                    unit="hours",
                    operator="le",
                    description="Desirable LOS interval.",
                ),
            ),
            terrain=TerrainRequirementsConfig(
                max_local_slope_deg=SingleRequirement(
                    id="max_local_slope_deg",
                    name="Maximum Allowable Landing Site Slope",
                    classification=RequirementClassification.HARD_CONSTRAINT,
                    enabled=True,
                    value=15.0,
                    unit="deg",
                    operator="le",
                    description="Rover wheel slip safety limit.",
                ),
                max_roughness_factor=SingleRequirement(
                    id="max_roughness_factor",
                    name="Maximum Roughness Factor",
                    classification=RequirementClassification.HARD_CONSTRAINT,
                    enabled=True,
                    value=4.0,
                    unit="deg_std",
                    operator="le",
                    description="Roughness test.",
                ),
            ),
        ),
    )
    profile = mission_profile_service.create_profile(prof_req)
    yield profile.id
    # Teardown
    try:
        mission_profile_service.delete_profile(profile.id)
    except Exception:
        pass

def test_single_candidate_screening(setup_screening_fixtures):
    profile_id = setup_screening_fixtures
    req = {
        "profile_id": profile_id,
        "scenario_ids": ["scenario-cr-crest"],
        "step_interval_hours": 2.0,
        "azimuth_resolution_deg": 3.0,
        "max_search_distance_m": 5000.0,
    }
    resp = client.post("/api/screening/run", json=req)
    assert resp.status_code == 201
    data = resp.json()["run"]

    assert data["profile_id"] == profile_id
    assert len(data["candidates"]) == 1

    cand = data["candidates"][0]
    assert cand["candidate_id"] == "scenario-cr-crest"
    assert cand["overall_status"] in ["COMPLIANT", "NON_COMPLIANT", "INDETERMINATE"]
    assert cand["total_hard_constraints"] > 0
    assert len(cand["hard_constraint_results"]) > 0

    # Roughness requirement should be INDETERMINATE because layer is unloaded
    rough_res = next((r for r in cand["hard_constraint_results"] if r["requirement_id"] == "max_roughness_factor"), None)
    assert rough_res is not None
    assert rough_res["verdict"] == "INDETERMINATE"
    assert "unavailable" in rough_res["explanation"].lower()

def test_multi_candidate_screening_and_reproducibility(setup_screening_fixtures):
    profile_id = setup_screening_fixtures
    req = {
        "profile_id": profile_id,
        "scenario_ids": ["scenario-cr-crest", "scenario-cr-alpha"],
        "step_interval_hours": 2.0,
        "azimuth_resolution_deg": 3.0,
        "max_search_distance_m": 5000.0,
    }
    resp = client.post("/api/screening/run", json=req)
    assert resp.status_code == 201
    run_data = resp.json()["run"]
    run_id = run_data["id"]

    assert len(run_data["candidates"]) == 2
    assert run_data["overall_summary"]["total_candidates"] == 2

    # Snapshot verification: profile snapshot is stored in the record
    snapshot = run_data["profile_snapshot"]
    assert snapshot["id"] == profile_id
    assert snapshot["version"] == 1

    # Verify retrieval
    get_resp = client.get(f"/api/screening/runs/{run_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == run_id

    # Verify list
    list_resp = client.get("/api/screening/runs")
    assert list_resp.status_code == 200
    all_runs = list_resp.json()
    assert any(r["id"] == run_id for r in all_runs)

def test_hard_constraint_pass_fail_indeterminate_semantics():
    """Tests evaluation of PASS, FAIL, and INDETERMINATE with various operators."""
    svc = CandidateScreeningService()

    # Operator >=
    assert svc._compare_values(50.0, "ge", 40.0) is True
    assert svc._compare_values(40.0, "ge", 40.0) is True
    assert svc._compare_values(39.9, "ge", 40.0) is False

    # Operator >
    assert svc._compare_values(40.1, "gt", 40.0) is True
    assert svc._compare_values(40.0, "gt", 40.0) is False

    # Operator <=
    assert svc._compare_values(10.0, "le", 12.0) is True
    assert svc._compare_values(12.0, "le", 12.0) is True
    assert svc._compare_values(12.1, "le", 12.0) is False

    # Operator <
    assert svc._compare_values(11.9, "lt", 12.0) is True
    assert svc._compare_values(12.0, "lt", 12.0) is False

    # Operator ==
    assert svc._compare_values(10.0, "eq", 10.0) is True
    assert svc._compare_values(10.000001, "eq", 10.0) is True
    assert svc._compare_values(10.1, "eq", 10.0) is False

def test_daily_illumination_and_earth_semantics():
    """Verifies that daily sunlight evaluates 24.0h Earth day intervals."""
    svc = CandidateScreeningService()

    # Mock time series points (3 days: 72 hours, step 2h = 36 points)
    class MockPoint:
        def __init__(self, t_iso, sun_frac, earth_frac):
            self.timestamp_iso = t_iso
            self.sun_visible_fraction = sun_frac
            self.earth_visible_fraction = earth_frac

    start_iso = "2026-10-04T12:00:00Z"
    end_iso = "2026-10-07T12:00:00Z"
    series = []
    from datetime import datetime, timezone, timedelta
    st = datetime.fromisoformat(start_iso.replace("Z", "+00:00"))
    for i in range(36):
        cur = st + timedelta(hours=i*2)
        # Give high illumination in day 1 and 2, but 0 in day 3
        sun_f = 1.0 if i < 24 else 0.0
        earth_f = 1.0
        series.append(MockPoint(cur.isoformat().replace("+00:00", "Z"), sun_f, earth_f))

    res_sun = svc._compute_daily_sunlight_metrics(series, start_iso, end_iso, 3.0)
    assert res_sun["day_count"] == 3
    assert len(res_sun["daily_hours_list"]) == 3
    assert res_sun["daily_hours_list"][0] > 0
    assert res_sun["daily_hours_list"][2] == 0.0
    assert res_sun["min_daily_hours"] == 0.0

def test_soft_preference_preservation_no_scoring(setup_screening_fixtures):
    profile_id = setup_screening_fixtures
    req = {
        "profile_id": profile_id,
        "scenario_ids": ["scenario-cr-crest"],
        "step_interval_hours": 2.0,
        "azimuth_resolution_deg": 3.0,
        "max_search_distance_m": 5000.0,
    }
    resp = client.post("/api/screening/run", json=req)
    assert resp.status_code == 201
    cand = resp.json()["run"]["candidates"][0]

    # Verify soft preferences are present and have threshold and actual value, but no score/weight
    softs = cand["soft_preference_results"]
    assert len(softs) >= 2
    for s in softs:
        assert "score" not in s
        assert "weight" not in s
        assert s["threshold_str"] is not None
        assert s["actual_value_str"] is not None

def test_exports_json_and_csv(setup_screening_fixtures):
    profile_id = setup_screening_fixtures
    req = {
        "profile_id": profile_id,
        "scenario_ids": ["scenario-cr-crest"],
        "step_interval_hours": 2.0,
        "azimuth_resolution_deg": 3.0,
        "max_search_distance_m": 5000.0,
    }
    resp = client.post("/api/screening/run", json=req)
    run_id = resp.json()["run"]["id"]

    # 1. JSON Export
    json_resp = client.get(f"/api/screening/runs/{run_id}/export/json")
    assert json_resp.status_code == 200
    j_data = json_resp.json()
    assert j_data["id"] == run_id
    assert "candidates" in j_data
    assert "scientific_disclaimers" in j_data["candidates"][0]

    # 2. CSV Export
    csv_resp = client.get(f"/api/screening/runs/{run_id}/export/csv")
    assert csv_resp.status_code == 200
    assert csv_resp.headers["content-type"].startswith("text/csv")
    csv_text = csv_resp.text
    assert "LUNAVISTA CANDIDATE SCREENING REPORT" in csv_text
    assert "scenario-cr-crest" in csv_text
    assert "MANDATORY SCIENTIFIC DISCLAIMERS" in csv_text

def test_invalid_profile_and_missing_scenario():
    # Invalid profile ID
    resp1 = client.post("/api/screening/run", json={
        "profile_id": "nonexistent-profile-xyz",
        "scenario_ids": ["scenario-cr-crest"],
    })
    assert resp1.status_code == 404

    # Missing scenario
    resp2 = client.post("/api/screening/run", json={
        "profile_id": "template-robotic-rover",
        "scenario_ids": ["nonexistent-scenario-abc"],
    })
    assert resp2.status_code == 404

    # Empty scenarios
    resp3 = client.post("/api/screening/run", json={
        "profile_id": "template-robotic-rover",
        "scenario_ids": [],
    })
    assert resp3.status_code == 422  # Pydantic min_length=1

def test_concurrent_screening_requests(tmp_path):
    """Verifies thread-safe execution of multiple simultaneous screening calls."""
    test_storage = tmp_path / "concurrent_screening.json"
    svc = CandidateScreeningService(storage_path=test_storage)

    req = CandidateScreeningRequest(
        profile_id="template-robotic-rover",
        scenario_ids=["scenario-cr-crest"],
        step_interval_hours=4.0,
        azimuth_resolution_deg=4.0,
        max_search_distance_m=3000.0,
    )

    def worker(idx):
        r = req.model_copy()
        r.name = f"Concurrent Screening Run {idx}"
        return svc.run_screening(r)

    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = [executor.submit(worker, i) for i in range(4)]
        results = [f.result() for f in futures]

    assert len(results) == 4
    unique_ids = set(r.id for r in results)
    assert len(unique_ids) == 4
    assert len(svc.list_runs()) == 4

def test_profile_snapshot_immutability(setup_screening_fixtures):
    """
    Verifies that mutating or updating a mission profile AFTER a screening run
    does NOT alter the historical snapshot preserved in the screening run.
    """
    profile_id = setup_screening_fixtures
    req = {
        "profile_id": profile_id,
        "scenario_ids": ["scenario-cr-crest"],
        "step_interval_hours": 2.0,
        "azimuth_resolution_deg": 3.0,
        "max_search_distance_m": 5000.0,
    }
    resp = client.post("/api/screening/run", json=req)
    assert resp.status_code == 201
    run_id = resp.json()["run"]["id"]
    orig_name = resp.json()["run"]["profile_snapshot"]["name"]

    # Mutate the profile in profile service
    from app.schemas.mission_profile import MissionProfileUpdateRequest
    mission_profile_service.update_profile(
        profile_id,
        MissionProfileUpdateRequest(name="Mutated Name After Screening Run")
    )

    # Re-fetch screening run: snapshot must be untouched
    fetched = client.get(f"/api/screening/runs/{run_id}").json()
    assert fetched["profile_snapshot"]["name"] == orig_name
    assert fetched["profile_snapshot"]["name"] != "Mutated Name After Screening Run"

def test_partial_dem_coverage_indeterminate_handling():
    """
    Verifies that when coverage certainty is indeterminate, solar and Earth
    requirements produce INDETERMINATE verdicts instead of false PASS/FAIL.
    """
    svc = CandidateScreeningService()
    req = SingleRequirement(
        id="min_total_sunlight_hours",
        name="Minimum Total Sunlight",
        classification=RequirementClassification.HARD_CONSTRAINT,
        enabled=True,
        value=50.0,
        unit="hours",
        operator="ge",
    )
    hard_results = []
    soft_results = []
    info_metrics = []

    # Case 1: Coverage is indeterminate
    svc._eval_requirement(
        req=req,
        measured=80.0,  # 80 >= 50 would pass if coverage were complete
        category="solar",
        is_coverage_indeterminate=True,  # but coverage is indeterminate!
        source="Test Source",
        analysis_period="2026-10-04 to 2026-10-07",
        hard_results=hard_results,
        soft_results=soft_results,
        info_metrics=info_metrics,
    )
    assert len(hard_results) == 1
    assert hard_results[0].verdict == ScreeningVerdict.INDETERMINATE
    assert "cannot be certified" in hard_results[0].explanation

    # Case 2: Coverage is complete
    hard_results.clear()
    svc._eval_requirement(
        req=req,
        measured=80.0,
        category="solar",
        is_coverage_indeterminate=False,
        source="Test Source",
        analysis_period="2026-10-04 to 2026-10-07",
        hard_results=hard_results,
        soft_results=soft_results,
        info_metrics=info_metrics,
    )
    assert len(hard_results) == 1
    assert hard_results[0].verdict == ScreeningVerdict.PASS

