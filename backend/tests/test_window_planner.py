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
from app.schemas.window_planner import (
    MissionWindowSearchRequest,
    WindowClassification,
)
from app.services.mission_profile_service import mission_profile_service
from app.services.scenario_service import scenario_service
from app.services.window_planner_service import window_planner_service

client = TestClient(app)

@pytest.fixture(scope="module")
def setup_window_fixtures():
    """Sets up a profile and candidate scenario for window planner tests."""
    prof_req = MissionProfileCreateRequest(
        name="Window Planner Test Profile",
        description="Profile used for mission window planner testing.",
        mission_type=MissionType.ROBOTIC_EXPLORATION,
        duration_days=1.0,  # 24 hours
        start_timestamp_iso="2026-10-04T00:00:00Z",
        end_timestamp_iso="2026-10-06T00:00:00Z",
        observer_height_m=2.0,
        requirements=MissionRequirementsSet(
            solar=SolarRequirementsConfig(
                min_total_sunlight_hours=SingleRequirement(
                    id="min_total_sunlight_hours",
                    name="Minimum Total Geometric Sunlight",
                    classification=RequirementClassification.HARD_CONSTRAINT,
                    enabled=True,
                    value=10.0,
                    unit="hours",
                    operator="ge",
                    description="Solar energy requirement.",
                ),
                max_continuous_darkness_hours=SingleRequirement(
                    id="max_continuous_darkness_hours",
                    name="Maximum Continuous Darkness",
                    classification=RequirementClassification.HARD_CONSTRAINT,
                    enabled=True,
                    value=14.0,
                    unit="hours",
                    operator="le",
                    description="Max darkness survival limit.",
                ),
            ),
            earth=EarthRequirementsConfig(
                min_total_earth_visible_hours=SingleRequirement(
                    id="min_total_earth_visible_hours",
                    name="Minimum Earth Comm Visibility",
                    classification=RequirementClassification.SOFT_PREFERENCE,
                    enabled=True,
                    value=12.0,
                    unit="hours",
                    operator="ge",
                    description="Desired comm pass duration.",
                ),
            ),
            terrain=TerrainRequirementsConfig(
                max_slope_deg=SingleRequirement(
                    id="max_slope_deg",
                    name="Maximum Local Slope",
                    classification=RequirementClassification.HARD_CONSTRAINT,
                    enabled=True,
                    value=15.0,
                    unit="degrees",
                    operator="le",
                    description="Slope safety requirement.",
                ),
            ),
        ),
    )
    profile = mission_profile_service.create_profile(prof_req)

    scenarios = scenario_service.list_scenarios()
    target_scenario = None
    for s in scenarios:
        if s.site_id == "shackleton_connecting_ridge":
            target_scenario = s
            break
    if not target_scenario:
        target_scenario = scenarios[0]

    return {
        "profile": profile,
        "scenario": target_scenario,
    }


def test_window_search_validation_errors(setup_window_fixtures):
    """Verifies that invalid window search configurations are rejected with clear errors."""
    profile = setup_window_fixtures["profile"]
    scenario = setup_window_fixtures["scenario"]

    # 1. search_start_iso >= search_end_iso
    bad_dates = MissionWindowSearchRequest(
        profile_id=profile.id,
        scenario_id=scenario.id,
        search_start_iso="2026-10-06T00:00:00Z",
        search_end_iso="2026-10-04T00:00:00Z",
        mission_duration_days=1.0,
        search_step_hours=12.0,
        analysis_step_hours=2.0,
    )
    res = client.post("/api/window-planner/search", json=bad_dates.model_dump())
    assert res.status_code == 400
    assert "strictly after" in res.json()["detail"].lower()

    # 2. mission_duration_days > search_span_days
    bad_duration = MissionWindowSearchRequest(
        profile_id=profile.id,
        scenario_id=scenario.id,
        search_start_iso="2026-10-04T00:00:00Z",
        search_end_iso="2026-10-05T00:00:00Z",
        mission_duration_days=2.0,  # 2 days duration in 1 day search span
        search_step_hours=12.0,
        analysis_step_hours=2.0,
    )
    res = client.post("/api/window-planner/search", json=bad_duration.model_dump())
    assert res.status_code == 400
    assert "exceeds the total search span" in res.json()["detail"].lower()

    # 3. Step resolution too granular leading to > 200 windows
    huge_search = MissionWindowSearchRequest(
        profile_id=profile.id,
        scenario_id=scenario.id,
        search_start_iso="2026-10-01T00:00:00Z",
        search_end_iso="2026-10-25T00:00:00Z",
        mission_duration_days=0.5,
        search_step_hours=1.0,  # 24 * 24.5 = ~588 windows > 200
        analysis_step_hours=2.0,
    )
    res = client.post("/api/window-planner/search", json=huge_search.model_dump())
    assert res.status_code == 400
    assert "exceeding maximum allowable limit" in res.json()["detail"].lower()


def test_window_search_execution_and_metrics(setup_window_fixtures):
    """Executes a search run and tests candidate start times, metrics, and deterministic precedence."""
    profile = setup_window_fixtures["profile"]
    scenario = setup_window_fixtures["scenario"]

    req = MissionWindowSearchRequest(
        profile_id=profile.id,
        scenario_id=scenario.id,
        search_start_iso="2026-10-04T00:00:00Z",
        search_end_iso="2026-10-06T00:00:00Z",  # 48 hours span
        mission_duration_days=1.0,               # 24 hours duration
        search_step_hours=12.0,                  # Candidate start step = 12h -> starts: +0h, +12h, +24h (3 windows)
        analysis_step_hours=2.0,
        name="Test Shackleton 48h Search",
    )

    res = client.post("/api/window-planner/search", json=req.model_dump())
    assert res.status_code == 201
    data = res.json()["search"]

    assert data["profile_id"] == profile.id
    assert data["scenario_id"] == scenario.id
    assert data["total_windows_evaluated"] == 3
    assert len(data["windows"]) == 3

    # Check first window
    w0 = data["windows"][0]
    assert w0["window_id"] == "win-001"
    assert w0["start_timestamp_iso"] == "2026-10-04T00:00:00Z"
    assert w0["duration_days"] == 1.0
    assert w0["duration_hours"] == 24.0

    # Solar & Earth summary present
    solar = w0["solar_summary"]
    earth = w0["earth_summary"]
    assert "total_sunlight_hours" in solar
    assert "full_sunlight_hours" in solar
    assert "darkness_hours" in solar
    assert "longest_darkness_hours" in solar
    assert "total_earth_visible_hours" in earth
    assert "longest_earth_blackout_hours" in earth

    # Check classification enum validity
    for w in data["windows"]:
        assert w["classification"] in ["COMPLIANT", "NON_COMPLIANT", "INDETERMINATE"]
        # Precedence check: if any hard constraint failed, must be NON_COMPLIANT
        if w["hard_constraints_failed"] > 0:
            assert w["classification"] == "NON_COMPLIANT"
        elif w["hard_constraints_indeterminate"] > 0:
            assert w["classification"] == "INDETERMINATE"
        else:
            assert w["classification"] == "COMPLIANT"


def test_window_comparison_endpoint(setup_window_fixtures):
    """Tests the side-by-side comparison endpoint for 2 to 4 windows."""
    # List searches to get the created search record
    searches = client.get("/api/window-planner/searches").json()
    assert len(searches) > 0
    search_id = searches[0]["id"]

    # Successful comparison between win-001 and win-002
    compare_res = client.post(
        f"/api/window-planner/searches/{search_id}/compare",
        json={"window_ids": ["win-001", "win-002"]}
    )
    assert compare_res.status_code == 200
    comp_data = compare_res.json()
    assert comp_data["search_id"] == search_id
    assert comp_data["reference_window_id"] == "win-001"
    assert len(comp_data["compared_windows"]) == 2
    assert comp_data["is_fully_consistent"] is True

    # Bad request: fewer than 2 windows
    bad_comp = client.post(
        f"/api/window-planner/searches/{search_id}/compare",
        json={"window_ids": ["win-001"]}
    )
    assert bad_comp.status_code in (400, 422)

    # Bad request: non-existent window ID
    missing_win = client.post(
        f"/api/window-planner/searches/{search_id}/compare",
        json={"window_ids": ["win-001", "non-existent-win"]}
    )
    assert missing_win.status_code == 404


def test_export_json_and_csv(setup_window_fixtures):
    """Tests JSON and CSV data exports for a mission window search."""
    searches = client.get("/api/window-planner/searches").json()
    search_id = searches[0]["id"]

    # JSON export
    res_json = client.get(f"/api/window-planner/searches/{search_id}/export/json")
    assert res_json.status_code == 200
    export_obj = res_json.json()
    assert export_obj["id"] == search_id
    assert "profile_snapshot" in export_obj
    assert "windows" in export_obj
    assert "scientific_disclaimers" in export_obj

    # CSV export
    res_csv = client.get(f"/api/window-planner/searches/{search_id}/export/csv")
    assert res_csv.status_code == 200
    assert "text/csv" in res_csv.headers["content-type"]
    csv_text = res_csv.text
    assert "Window ID,Start Epoch (UTC),End Epoch (UTC),Duration (h),Classification" in csv_text
    assert "win-001" in csv_text


def test_snapshot_immutability(setup_window_fixtures):
    """Verifies that subsequent mission profile mutations do not modify existing search snapshots."""
    profile = setup_window_fixtures["profile"]
    scenario = setup_window_fixtures["scenario"]

    req = MissionWindowSearchRequest(
        profile_id=profile.id,
        scenario_id=scenario.id,
        search_start_iso="2026-10-04T00:00:00Z",
        search_end_iso="2026-10-05T12:00:00Z",
        mission_duration_days=0.5,
        search_step_hours=12.0,
        analysis_step_hours=2.0,
    )
    search_res = client.post("/api/window-planner/search", json=req.model_dump())
    assert search_res.status_code == 201
    search_id = search_res.json()["search"]["id"]

    # Now mutate the original profile name and requirements
    try:
        mission_profile_service.update_profile(
            profile.id,
            MissionProfileCreateRequest(
                name="MUTATED PROFILE NAME",
                description="Mutated description",
                mission_type=MissionType.CREWED_SURFACE,
                duration_days=5.0,
                start_timestamp_iso="2026-10-04T00:00:00Z",
                end_timestamp_iso="2026-10-09T00:00:00Z",
                requirements=profile.requirements,
            )
        )

        # Check search record snapshot retains original name and properties
        frozen_search = client.get(f"/api/window-planner/searches/{search_id}").json()
        assert frozen_search["profile_name"] == "Window Planner Test Profile"
        assert frozen_search["profile_snapshot"]["name"] == "Window Planner Test Profile"
    finally:
        mission_profile_service.update_profile(
            profile.id,
            MissionProfileCreateRequest(
                name=profile.name,
                description=profile.description,
                mission_type=profile.mission_type,
                duration_days=profile.duration_days,
                start_timestamp_iso=profile.start_timestamp_iso,
                end_timestamp_iso=profile.end_timestamp_iso,
                requirements=profile.requirements,
            )
        )


def test_concurrent_window_searches(setup_window_fixtures):
    """Verifies thread-safe execution of concurrent window planner searches without SPICE errors."""
    profile = setup_window_fixtures["profile"]
    scenario = setup_window_fixtures["scenario"]

    req = MissionWindowSearchRequest(
        profile_id=profile.id,
        scenario_id=scenario.id,
        search_start_iso="2026-10-04T00:00:00Z",
        search_end_iso="2026-10-05T06:00:00Z",
        mission_duration_days=0.25,  # 6h duration
        search_step_hours=6.0,
        analysis_step_hours=2.0,
    )

    def run_concurrent_search(idx: int):
        r = client.post("/api/window-planner/search", json=req.model_dump())
        return r.status_code, r.json()

    with ThreadPoolExecutor(max_workers=3) as executor:
        results = list(executor.map(run_concurrent_search, range(3)))

    for status_code, data in results:
        assert status_code == 201
        assert "search" in data
        assert data["search"]["total_windows_evaluated"] >= 1
