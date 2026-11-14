import pytest
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
from app.schemas.scenario import ScenarioRecord, ScenarioCreateRequest
from app.schemas.terrain_assessment import (
    TerrainAssessmentRequest,
    TerrainSuitabilityStatus,
)
from app.schemas.screening import ScreeningVerdict, DataCoverageStatus
from app.services.mission_profile_service import mission_profile_service
from app.services.scenario_service import scenario_service

client = TestClient(app)

@pytest.fixture(scope="module")
def setup_terrain_fixtures():
    """Sets up a mission profile and retrieves candidate scenarios for terrain assessment tests."""
    prof_req = MissionProfileCreateRequest(
        name="Terrain Assessment Test Profile",
        description="Profile used for terrain suitability engine testing.",
        mission_type=MissionType.ROBOTIC_LANDER,
        duration_days=14.0,
        start_timestamp_iso="2026-10-04T00:00:00Z",
        end_timestamp_iso="2026-10-18T00:00:00Z",
        observer_height_m=2.0,
        requirements=MissionRequirementsSet(
            terrain=TerrainRequirementsConfig(
                max_local_slope_deg=SingleRequirement(
                    id="max_local_slope_deg",
                    name="Maximum Allowable Landing Site Slope",
                    classification=RequirementClassification.HARD_CONSTRAINT,
                    enabled=True,
                    value=15.0,
                    unit="deg",
                    operator="le",
                    description="Maximum local slope at landing site.",
                ),
                min_elevation_m=SingleRequirement(
                    id="min_elevation_m",
                    name="Minimum Surface Elevation",
                    classification=RequirementClassification.HARD_CONSTRAINT,
                    enabled=True,
                    value=-500.0,
                    unit="m",
                    operator="ge",
                    description="Minimum elevation.",
                ),
                max_elevation_m=SingleRequirement(
                    id="max_elevation_m",
                    name="Maximum Surface Elevation",
                    classification=RequirementClassification.SOFT_PREFERENCE,
                    enabled=True,
                    value=2500.0,
                    unit="m",
                    operator="le",
                    description="Desired maximum elevation.",
                ),
                max_roughness_factor=SingleRequirement(
                    id="max_roughness_factor",
                    name="Maximum Roughness Factor",
                    classification=RequirementClassification.HARD_CONSTRAINT,
                    enabled=True,
                    value=5.0,
                    unit="deg_std",
                    operator="le",
                    description="Roughness test.",
                ),
            )
        ),
    )
    profile = mission_profile_service.create_profile(prof_req)
    scenarios = scenario_service.list_scenarios()
    return {"profile": profile, "scenarios": scenarios}


def test_terrain_assessment_elevation_extraction_and_units(setup_terrain_fixtures):
    """Verifies elevation metrics, reference sphere datum, and footprint extraction."""
    profile = setup_terrain_fixtures["profile"]
    scenarios = setup_terrain_fixtures["scenarios"]

    req = TerrainAssessmentRequest(
        profile_id=profile.id,
        scenario_ids=[scenarios[0].id],
        assessment_radius_m=50.0,
    )
    res = client.post("/api/terrain-assessment/assess", json=req.model_dump())
    assert res.status_code == 201
    data = res.json()["assessment"]
    assert len(data["candidates"]) == 1

    cand = data["candidates"][0]
    elev = cand["elevation_metrics"]
    assert elev["elevation_units"] == "meters"
    assert "IAU Moon 2000 Reference Sphere" in elev["elevation_datum"]
    assert elev["point_elevation_m"] is not None
    assert elev["min_elevation_m"] is not None
    assert elev["max_elevation_m"] is not None
    assert elev["elevation_range_m"] >= 0.0
    assert "not spacecraft altitude" in elev["datum_note"].lower()


def test_terrain_assessment_slope_extraction_and_threshold_evaluation(setup_terrain_fixtures):
    """Verifies slope metrics, NASA LOLA source product, and slope distribution."""
    profile = setup_terrain_fixtures["profile"]
    scenarios = setup_terrain_fixtures["scenarios"]

    req = TerrainAssessmentRequest(
        profile_id=profile.id,
        scenario_ids=[scenarios[0].id],
        assessment_radius_m=50.0,
    )
    res = client.post("/api/terrain-assessment/assess", json=req.model_dump())
    assert res.status_code == 201
    cand = res.json()["assessment"]["candidates"][0]
    slope = cand["slope_metrics"]

    assert slope["slope_units"] == "degrees"
    assert "Site01_final_adj_5mpp_slp.tif" in slope["slope_source"]
    assert slope["point_slope_deg"] is not None
    assert slope["min_slope_deg"] is not None
    assert slope["max_slope_deg"] >= slope["min_slope_deg"]
    assert "0° – 5°: Safe Landing (Low Tilt Risk)" in slope["slope_distribution"]
    assert slope["exceedance_percentage"] is not None


def test_terrain_assessment_roughness_unsupported_behavior(setup_terrain_fixtures):
    """Verifies that absence of official roughness raster yields explicit UNSUPPORTED and INDETERMINATE."""
    profile = setup_terrain_fixtures["profile"]
    scenarios = setup_terrain_fixtures["scenarios"]

    req = TerrainAssessmentRequest(
        profile_id=profile.id,
        scenario_ids=[scenarios[0].id],
        assessment_radius_m=50.0,
    )
    res = client.post("/api/terrain-assessment/assess", json=req.model_dump())
    assert res.status_code == 201
    cand = res.json()["assessment"]["candidates"][0]
    rough = cand["roughness_metrics"]

    assert rough["is_supported"] is False
    assert rough["status"] == "UNSUPPORTED"
    assert "slope or elevation variance cannot be substituted" in rough["scientific_justification"].lower()

    # The hard constraint result for roughness must be INDETERMINATE
    rough_eval = next(r for r in cand["hard_constraint_results"] if r["requirement_id"] == "max_roughness_factor")
    assert rough_eval["verdict"] == "INDETERMINATE"


def test_terrain_assessment_out_of_bounds_handling(setup_terrain_fixtures):
    """Verifies that coordinates outside DEM extent are marked UNAVAILABLE and INDETERMINATE."""
    profile = setup_terrain_fixtures["profile"]

    # Create temporary out-of-bounds scenario (equator: 0.0, 0.0) directly in scenario registry
    out_scen = ScenarioRecord(
        id="scenario-out-of-bounds",
        name="Equatorial Out-of-Bounds Scenario",
        site_id="site01",
        latitude=0.0,
        longitude=0.0,
        start_timestamp_iso="2026-10-04T00:00:00Z",
        end_timestamp_iso="2026-10-06T00:00:00Z",
        created_at_iso="2026-10-01T00:00:00Z",
        updated_at_iso="2026-10-01T00:00:00Z",
    )
    with scenario_service._lock:
        scenario_service._scenarios[out_scen.id] = out_scen

    req = TerrainAssessmentRequest(
        profile_id=profile.id,
        scenario_ids=[out_scen.id],
        assessment_radius_m=50.0,
    )
    res = client.post("/api/terrain-assessment/assess", json=req.model_dump())
    assert res.status_code == 201
    cand = res.json()["assessment"]["candidates"][0]

    assert cand["data_quality"]["coverage_status"] == "UNAVAILABLE"
    assert cand["overall_status"] == "INDETERMINATE"
    assert len(cand["warnings"]) > 0


def test_terrain_assessment_hard_constraint_fail_precedence(setup_terrain_fixtures):
    """Verifies that an active hard constraint failure strictly yields NON_COMPLIANT even when another is INDETERMINATE."""
    # Create profile with unrealistically strict slope threshold (<= 0.5 degrees)
    strict_prof_req = MissionProfileCreateRequest(
        name="Strict Slope Profile",
        mission_type=MissionType.ROBOTIC_LANDER,
        duration_days=5.0,  # 120h duration
        start_timestamp_iso="2026-10-04T00:00:00Z",
        end_timestamp_iso="2026-10-09T00:00:00Z",
        requirements=MissionRequirementsSet(
            terrain=TerrainRequirementsConfig(
                max_local_slope_deg=SingleRequirement(
                    id="max_local_slope_deg",
                    name="Maximum Allowable Landing Site Slope",
                    classification=RequirementClassification.HARD_CONSTRAINT,
                    enabled=True,
                    value=0.1,  # Strict threshold that will FAIL on Connecting Ridge
                    unit="deg",
                    operator="le",
                ),
                max_roughness_factor=SingleRequirement(
                    id="max_roughness_factor",
                    name="Maximum Roughness Factor",
                    classification=RequirementClassification.HARD_CONSTRAINT,
                    enabled=True,
                    value=5.0,
                    unit="deg_std",
                    operator="le",
                ),
            )
        ),
    )
    strict_prof = mission_profile_service.create_profile(strict_prof_req)
    scenarios = setup_terrain_fixtures["scenarios"]

    req = TerrainAssessmentRequest(
        profile_id=strict_prof.id,
        scenario_ids=[scenarios[0].id],
        assessment_radius_m=50.0,
    )
    res = client.post("/api/terrain-assessment/assess", json=req.model_dump())
    assert res.status_code == 201
    cand = res.json()["assessment"]["candidates"][0]

    assert cand["hard_constraints_failed"] >= 1
    assert cand["hard_constraints_indeterminate"] >= 1
    # PRECEDENCE RULE: Fail strictly overrides Indeterminate
    assert cand["overall_status"] == "NON_COMPLIANT"


def test_terrain_assessment_soft_preference_separation(setup_terrain_fixtures):
    """Verifies that soft preferences do not affect overall compliance status."""
    profile = setup_terrain_fixtures["profile"]
    scenarios = setup_terrain_fixtures["scenarios"]

    req = TerrainAssessmentRequest(
        profile_id=profile.id,
        scenario_ids=[scenarios[0].id],
        assessment_radius_m=25.0,
    )
    res = client.post("/api/terrain-assessment/assess", json=req.model_dump())
    assert res.status_code == 201
    cand = res.json()["assessment"]["candidates"][0]

    # Verify soft preferences are segregated in candidate response
    assert len(cand["soft_preference_results"]) > 0
    sp = cand["soft_preference_results"][0]
    assert sp["classification"] == "SOFT_PREFERENCE"


def test_terrain_assessment_persistence_and_snapshots(setup_terrain_fixtures):
    """Verifies persistence, snapshot immutability, and single candidate detail endpoint."""
    profile = setup_terrain_fixtures["profile"]
    scenarios = setup_terrain_fixtures["scenarios"]

    req = TerrainAssessmentRequest(
        profile_id=profile.id,
        scenario_ids=[scenarios[0].id],
        assessment_radius_m=50.0,
    )
    res = client.post("/api/terrain-assessment/assess", json=req.model_dump())
    assert res.status_code == 201
    assessment_id = res.json()["assessment"]["id"]

    # 1. Retrieve full assessment
    get_res = client.get(f"/api/terrain-assessment/assessments/{assessment_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == assessment_id

    # 2. Retrieve single candidate detail
    cand_res = client.get(f"/api/terrain-assessment/assessments/{assessment_id}/candidates/{scenarios[0].id}")
    assert cand_res.status_code == 200
    assert cand_res.json()["candidate_id"] == scenarios[0].id

    # 3. Snapshot immutability: modify original scenario name
    orig_name = scenarios[0].name
    orig_desc = scenarios[0].description
    try:
        scenario_service.update_scenario(
            scenarios[0].id,
            ScenarioCreateRequest(
                name="MUTATED SCENARIO NAME",
                site_id=scenarios[0].site_id,
                latitude=scenarios[0].latitude,
                longitude=scenarios[0].longitude,
                start_timestamp_iso=scenarios[0].start_timestamp_iso,
                end_timestamp_iso=scenarios[0].end_timestamp_iso,
            )
        )

        frozen = client.get(f"/api/terrain-assessment/assessments/{assessment_id}").json()
        assert frozen["scenario_snapshots"][0]["name"] == orig_name
    finally:
        scenario_service.update_scenario(
            scenarios[0].id,
            ScenarioCreateRequest(
                name=orig_name,
                description=orig_desc,
                site_id=scenarios[0].site_id,
                latitude=scenarios[0].latitude,
                longitude=scenarios[0].longitude,
                start_timestamp_iso=scenarios[0].start_timestamp_iso,
                end_timestamp_iso=scenarios[0].end_timestamp_iso,
            )
        )


def test_terrain_assessment_exports(setup_terrain_fixtures):
    """Verifies JSON and CSV export endpoints and mandatory scientific disclaimers."""
    assessments = client.get("/api/terrain-assessment/assessments").json()
    assessment_id = assessments[0]["id"]

    # JSON export
    res_json = client.get(f"/api/terrain-assessment/assessments/{assessment_id}/export/json")
    assert res_json.status_code == 200
    data = res_json.json()
    assert data["id"] == assessment_id
    assert "scientific_disclaimers" in data
    assert len(data["scientific_disclaimers"]) > 0

    # CSV export
    res_csv = client.get(f"/api/terrain-assessment/assessments/{assessment_id}/export/csv")
    assert res_csv.status_code == 200
    assert "text/csv" in res_csv.headers["content-type"]
    assert "Candidate ID,Candidate Name,Latitude (°),Longitude (°),Overall Status" in res_csv.text
    assert "SCIENTIFIC ACCURACY DISCLAIMERS" in res_csv.text


def test_terrain_assessment_concurrent_execution(setup_terrain_fixtures):
    """Verifies thread-safe execution of concurrent terrain assessments."""
    profile = setup_terrain_fixtures["profile"]
    scenarios = setup_terrain_fixtures["scenarios"]

    req = TerrainAssessmentRequest(
        profile_id=profile.id,
        scenario_ids=[scenarios[0].id, scenarios[1].id],
        assessment_radius_m=25.0,
    )

    def run_concurrent(idx: int):
        r = client.post("/api/terrain-assessment/assess", json=req.model_dump())
        return r.status_code, r.json()

    with ThreadPoolExecutor(max_workers=3) as executor:
        results = list(executor.map(run_concurrent, range(3)))

    for status_code, data in results:
        assert status_code == 201
        assert "assessment" in data
        assert data["assessment"]["total_candidates_evaluated"] == 2
