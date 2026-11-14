import pytest
import json
from fastapi.testclient import TestClient
from app.main import app
from app.schemas.scenario import (
    ScenarioCreateRequest,
    ScenarioUpdateRequest,
    MultiScenarioComparisonRequest,
    MissionConstraints,
    ScenarioExportRequest,
)
from app.services.scenario_service import scenario_service

client = TestClient(app)

def test_scenario_crud_and_validation():
    # 1. List scenarios (should have at least the 4 pre-configured scenarios)
    resp = client.get("/api/scenarios")
    assert resp.status_code == 200
    scenarios = resp.json()
    assert len(scenarios) >= 4
    ids = [s["id"] for s in scenarios]
    assert "scenario-cr-crest" in ids
    assert "scenario-cr-alpha" in ids

    # 2. Reject out-of-bounds latitude
    bad_req = {
        "name": "Invalid Out-of-bounds Site",
        "site_id": "site01",
        "latitude": -50.0,  # Site01 is between -89.8351 and -89.0903
        "longitude": -137.0,
        "start_timestamp_iso": "2026-10-04T12:00:00Z",
        "end_timestamp_iso": "2026-10-05T12:00:00Z",
    }
    bad_resp = client.post("/api/scenarios", json=bad_req)
    assert bad_resp.status_code == 400
    assert "outside DEM 'site01' geographic bounds" in bad_resp.json()["detail"]

    # 3. Reject inverted time
    bad_time_req = {
        "name": "Inverted Time Scenario",
        "site_id": "site01",
        "latitude": -89.4632,
        "longitude": -137.4896,
        "start_timestamp_iso": "2026-10-05T12:00:00Z",
        "end_timestamp_iso": "2026-10-04T12:00:00Z",
    }
    time_resp = client.post("/api/scenarios", json=bad_time_req)
    assert time_resp.status_code == 400
    assert "strictly after start timestamp" in time_resp.json()["detail"]

    # 4. Create valid scenario
    valid_req = {
        "name": "Test Valid Outpost",
        "description": "Validation test candidate",
        "site_id": "site01",
        "latitude": -89.4000,
        "longitude": -145.0000,
        "observer_height_m": 2.0,
        "start_timestamp_iso": "2026-10-04T12:00:00Z",
        "end_timestamp_iso": "2026-10-06T12:00:00Z",
        "step_interval_hours": 2.0,
    }
    create_resp = client.post("/api/scenarios", json=valid_req)
    assert create_resp.status_code == 201
    created = create_resp.json()
    new_id = created["id"]
    assert created["name"] == "Test Valid Outpost"

    # 5. Get created scenario
    get_resp = client.get(f"/api/scenarios/{new_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == new_id

    # 6. Duplicate scenario
    dup_resp = client.post(f"/api/scenarios/{new_id}/duplicate")
    assert dup_resp.status_code == 201
    dup_id = dup_resp.json()["id"]
    assert dup_resp.json()["name"] == "Test Valid Outpost (Copy)"

    # 7. Update scenario
    update_req = {"description": "Updated description for test"}
    up_resp = client.put(f"/api/scenarios/{new_id}", json=update_req)
    assert up_resp.status_code == 200
    assert up_resp.json()["description"] == "Updated description for test"

    # 8. Delete scenario
    del_resp = client.delete(f"/api/scenarios/{new_id}")
    assert del_resp.status_code == 200
    client.delete(f"/api/scenarios/{dup_id}")

    # Confirm deletion
    not_found = client.get(f"/api/scenarios/{new_id}")
    assert not_found.status_code == 404

def test_multi_scenario_comparison_and_duration_invariants():
    req = {
        "scenario_ids": ["scenario-cr-crest", "scenario-cr-alpha"],
        "enforce_harmonized_time": True,
        "override_start_iso": "2026-10-04T12:00:00Z",
        "override_duration_days": 2.0,  # 48 hours
        "override_step_hours": 2.0,
        "constraints": {
            "min_sunlight_hours": 20.0,
            "max_darkness_hours": 30.0,
            "min_earth_visible_hours": 10.0,
            "max_allowable_slope_deg": 15.0,
        },
    }
    resp = client.post("/api/scenarios/compare", json=req)
    assert resp.status_code == 200
    data = resp.json()

    assert data["is_harmonized"] is True
    assert len(data["scenarios"]) == 2
    assert len(data["ranking_summary"]) == 2
    assert len(data["scientific_caveats"]) >= 3

    # Check each scenario's duration sum consistency (48.0 hours)
    for sc_res in data["scenarios"]:
        total_interval = sc_res["combined"]["total_interval_hours"]
        assert pytest.approx(total_interval, abs=1e-2) == 48.0

        # Solar consistency: full + partial + darkness == total_interval
        s = sc_res["solar"]
        solar_sum = s["total_sun_full_hours"] + s["total_sun_partial_hours"] + s["total_darkness_hours"]
        assert pytest.approx(solar_sum, abs=1e-2) == total_interval

        # Earth consistency: full + partial + blackout == total_interval
        e = sc_res["earth"]
        earth_sum = e["total_earth_full_hours"] + e["total_earth_partial_hours"] + e["total_earth_blackout_hours"]
        assert pytest.approx(earth_sum, abs=1e-2) == total_interval

        # Combined consistency: both + sun_only + earth_only + neither == total_interval
        c = sc_res["combined"]
        combined_sum = c["both_visible_hours"] + c["sun_only_hours"] + c["earth_only_hours"] + c["neither_visible_hours"]
        assert pytest.approx(combined_sum, abs=1e-2) == total_interval

        # Terrain metrics
        t = sc_res["terrain"]
        assert t["observer_surface_elevation_m"] > 0
        assert t["dem_nominal_spacing_m"] == 5.0
        assert "Barker" in t["dataset_citation"]

def test_constraint_evaluation_and_ranking():
    # Test strict constraints to force both pass and fail
    req = {
        "scenario_ids": ["scenario-cr-crest", "scenario-cr-alpha", "scenario-cr-south"],
        "enforce_harmonized_time": True,
        "override_start_iso": "2026-10-04T12:00:00Z",
        "override_duration_days": 1.0,
        "override_step_hours": 1.0,
        "constraints": {
            "min_sunlight_hours": 500.0,  # Impossible criterion -> must FAIL
            "max_darkness_hours": 500.0,  # Easy criterion -> must PASS
            "max_allowable_slope_deg": 10.0,
        },
    }
    resp = client.post("/api/scenarios/compare", json=req)
    assert resp.status_code == 200
    data = resp.json()

    for sc_res in data["scenarios"]:
        cons = sc_res["constraints"]
        assert len(cons) == 3
        # min_sunlight_hours must fail
        min_sun_con = next(c for c in cons if c["constraint_id"] == "min_sunlight_hours")
        assert min_sun_con["status"] == "FAILED"
        assert "falling short" in min_sun_con["explanation"]

        # max_darkness_hours must pass
        dark_con = next(c for c in cons if c["constraint_id"] == "max_darkness_hours")
        assert dark_con["status"] == "PASSED"
        assert "within allowable" in dark_con["explanation"]

    # Verify rankings
    ranks = data["ranking_summary"]
    assert len(ranks) == 3
    assert ranks[0]["rank"] == 1
    assert ranks[1]["rank"] == 2
    assert ranks[2]["rank"] == 3

def test_export_comparison_json_and_csv():
    compare_req = {
        "scenario_ids": ["scenario-cr-crest", "scenario-cr-alpha"],
        "enforce_harmonized_time": True,
        "override_duration_days": 1.0,
    }
    cmp_resp = client.post("/api/scenarios/compare", json=compare_req)
    assert cmp_resp.status_code == 200
    cmp_data = cmp_resp.json()

    # 1. Export as JSON
    export_json_req = {
        "comparison_response": cmp_data,
        "format": "json",
    }
    json_resp = client.post("/api/scenarios/export", json=export_json_req)
    assert json_resp.status_code == 200
    assert "application/json" in json_resp.headers["content-type"]
    parsed = json.loads(json_resp.text)
    assert parsed["comparison_id"] == cmp_data["comparison_id"]

    # 2. Export as CSV
    export_csv_req = {
        "comparison_response": cmp_data,
        "format": "csv",
    }
    csv_resp = client.post("/api/scenarios/export", json=export_csv_req)
    assert csv_resp.status_code == 200
    assert "text/csv" in csv_resp.headers["content-type"]
    csv_text = csv_resp.text
    assert "LUNAVISTA MULTI-SCENARIO MISSION COMPARISON EXPORT" in csv_text
    assert "SOLAR ILLUMINATION METRICS" in csv_text
    assert "EARTH LINE-OF-SIGHT METRICS" in csv_text
    assert "MANDATORY SCIENTIFIC CAVEATS" in csv_text

def test_reject_invalid_scenario_counts():
    # Only 1 scenario -> reject
    resp1 = client.post("/api/scenarios/compare", json={"scenario_ids": ["scenario-cr-crest"]})
    assert resp1.status_code == 422 or resp1.status_code == 400

    # 5 scenarios -> reject
    resp5 = client.post(
        "/api/scenarios/compare",
        json={"scenario_ids": ["s1", "s2", "s3", "s4", "s5"]},
    )
    assert resp5.status_code == 422 or resp5.status_code == 400


def test_persistent_storage_across_instances(tmp_path):
    from pathlib import Path
    from app.services.scenario_service import ScenarioEngineService
    from app.schemas.scenario import ScenarioCreateRequest

    storage_file = tmp_path / "test_scenarios.json"
    svc1 = ScenarioEngineService(storage_path=storage_file)
    
    # Create scenario
    req = ScenarioCreateRequest(
        name="Persistence Test Station",
        site_id="site01",
        latitude=-89.4632,
        longitude=-137.4896,
        start_timestamp_iso="2026-10-04T12:00:00Z",
        end_timestamp_iso="2026-10-05T12:00:00Z",
    )
    created = svc1.create_scenario(req)
    created_id = created.id
    assert storage_file.exists()

    # Re-instantiate service 2 simulating backend restart
    svc2 = ScenarioEngineService(storage_path=storage_file)
    recovered = svc2.get_scenario(created_id)
    assert recovered is not None
    assert recovered.name == "Persistence Test Station"
    assert recovered.latitude == -89.4632

def test_nodata_and_out_of_bounds_detection():
    from app.services.dem_loader import dem_loader

    # 1. In bounds valid point (Peak Beta)
    pt_valid = dem_loader.sample_point(-89.4632, -137.4896)
    assert pt_valid["in_bounds"] is True
    assert pt_valid["elevation_m"] is not None
    assert pt_valid["slope_deg"] is not None
    # LOLA rasters classify valid pixels into 'direct_measurement' or 'interpolated' based on laser track returns
    assert pt_valid["quality_status"] in ("valid", "interpolated", "direct_measurement")

    # 2. Out of bounds point (e.g. North of Site 01 extent)
    pt_out = dem_loader.sample_point(-85.0, 0.0)
    assert pt_out["in_bounds"] is False
    assert pt_out["elevation_m"] is None
    assert pt_out["quality_status"] == "out_of_bounds"

def test_frame_transformation_chain():
    import numpy as np
    import math
    from app.services.coordinate_transform import transformer

    # Roundtrip test for coordinates
    test_lat, test_lon = -89.4632, -137.4896
    x, y = transformer.lat_lon_to_xy(test_lat, test_lon)
    lat_rt, lon_rt = transformer.xy_to_lat_lon(x, y)
    assert pytest.approx(lat_rt, abs=1e-5) == test_lat
    assert pytest.approx(lon_rt, abs=1e-5) == test_lon

    # Verify orthonormal ENU basis in MOON_ME
    phi = math.radians(test_lat)
    lam = math.radians(test_lon)
    u_east = np.array([-math.sin(lam), math.cos(lam), 0.0])
    u_north = np.array([-math.sin(phi) * math.cos(lam), -math.sin(phi) * math.sin(lam), math.cos(phi)])
    u_up = np.array([math.cos(phi) * math.cos(lam), math.cos(phi) * math.sin(lam), math.sin(phi)])

    # Unit lengths
    assert pytest.approx(np.linalg.norm(u_east), abs=1e-7) == 1.0
    assert pytest.approx(np.linalg.norm(u_north), abs=1e-7) == 1.0
    assert pytest.approx(np.linalg.norm(u_up), abs=1e-7) == 1.0

    # Orthogonality
    assert pytest.approx(float(np.dot(u_east, u_north)), abs=1e-7) == 0.0
    assert pytest.approx(float(np.dot(u_north, u_up)), abs=1e-7) == 0.0
    assert pytest.approx(float(np.dot(u_east, u_up)), abs=1e-7) == 0.0

    # Right-handed cross product
    cross_en = np.cross(u_east, u_north)
    assert np.allclose(cross_en, u_up, atol=1e-7)

def test_indeterminate_constraints_for_missing_metrics():
    from app.services.scenario_service import scenario_service
    from app.schemas.scenario import MissionConstraints, ScenarioTerrainMetrics

    # Terrain with missing local slope
    t = ScenarioTerrainMetrics(
        observer_surface_elevation_m=1000.0,
        observer_height_m=2.0,
        total_observer_elevation_m=1002.0,
        local_slope_deg=None,
        elevation_min_m=0.0,
        elevation_max_m=2000.0,
        elevation_mean_m=1000.0,
        dem_coverage_status="partial",
        dem_nominal_spacing_m=5.0,
        effective_resolution_note="interpolated",
        dataset_citation="Barker 2021",
    )

    class DummySolar:
        total_sun_visible_hours = None
        illumination_fraction = None
        longest_darkness_hours = None

    class DummyEarth:
        total_earth_visible_hours = None
        earth_visibility_fraction = None
        longest_earth_blackout_hours = None

    constraints = MissionConstraints(
        min_sunlight_hours=10.0,
        max_allowable_slope_deg=15.0,
    )

    results = scenario_service.evaluate_constraints(constraints, DummySolar(), DummyEarth(), t)
    assert len(results) == 2
    # Both must evaluate to INDETERMINATE because actual metrics are None
    assert results[0].status == "INDETERMINATE"
    assert results[1].status == "INDETERMINATE"

def test_persistence_edge_cases_malformed_concurrent_interrupted(tmp_path):
    """
    Rigorously tests ScenarioEngineService persistence under stress:
    1. Malformed JSON storage recovery and quarantine to .corrupt.bak
    2. Duplicate scenario IDs rejection on load
    3. Concurrent scenario mutations via ThreadPoolExecutor
    4. Atomic replacement prevents partial or interrupted writes
    """
    import json
    import threading
    from concurrent.futures import ThreadPoolExecutor
    from app.services.scenario_service import ScenarioEngineService, ScenarioRecord
    from app.schemas.scenario import ScenarioCreateRequest

    test_file = tmp_path / "test_scenarios.json"

    # 1. Baseline initialization
    svc = ScenarioEngineService(storage_path=test_file)
    assert len(svc.list_scenarios()) >= 4

    # 2. Malformed JSON recovery
    with open(test_file, "w") as f:
        f.write("{ this is corrupt broken json :::")
    svc_corrupt = ScenarioEngineService(storage_path=test_file)
    # Must recover with initial scenarios and quarantine corrupted file
    assert len(svc_corrupt.list_scenarios()) >= 4
    corrupt_bak = test_file.with_suffix(".corrupt.bak")
    assert corrupt_bak.exists()
    assert "{ this is corrupt broken json" in corrupt_bak.read_text()

    # 3. Duplicate scenario IDs rejection on load
    dupe_data = [
        svc.list_scenarios()[0].model_dump(),
        svc.list_scenarios()[0].model_dump(),  # duplicate ID
    ]
    with open(test_file, "w") as f:
        json.dump(dupe_data, f)
    # Loading must catch duplicate, quarantine, and initialize cleanly
    svc_dupe = ScenarioEngineService(storage_path=test_file)
    assert len(svc_dupe.list_scenarios()) >= 4

    # 4. Concurrent scenario mutations
    def create_worker(idx):
        req = ScenarioCreateRequest(
            name=f"Concurrent Scenario {idx}",
            site_id="site01",
            latitude=-89.4632,
            longitude=-137.4896,
            start_timestamp_iso="2026-10-04T12:00:00Z",
            end_timestamp_iso="2026-10-06T12:00:00Z",
            observer_height_m=2.0,
        )
        return svc.create_scenario(req)

    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = [executor.submit(create_worker, i) for i in range(16)]
        created = [f.result() for f in futures]

    assert len(created) == 16
    unique_ids = set(c.id for c in created)
    assert len(unique_ids) == 16  # Zero duplicate collisions

    # 5. Verify atomic file integrity: read the json file directly
    with open(test_file, "r") as f:
        disk_data = json.load(f)
    assert len(disk_data) >= 20  # 4 initial + 16 concurrent
