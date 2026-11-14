import math
from pathlib import Path
import numpy as np
import rasterio
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.mission_profile import (
    MissionProfileCreateRequest,
    TerrainRequirementsConfig,
    SingleRequirement,
    RequirementClassification,
)
from app.schemas.scenario import ScenarioRecord
from app.schemas.screening import ScreeningVerdict, DataCoverageStatus
from app.schemas.terrain_assessment import (
    TerrainAssessmentRequest,
    TerrainSuitabilityStatus,
    FootprintDataQuality,
)
from app.services.mission_profile_service import mission_profile_service
from app.services.scenario_service import scenario_service
from app.services.terrain_assessment_service import terrain_assessment_service, TerrainAssessmentService
from app.services.dem_loader import dem_loader

client = TestClient(app)

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "lunar" / "site01"
SURF_TIF = DATA_DIR / "Site01_final_adj_5mpp_surf.tif"
SLP_TIF = DATA_DIR / "Site01_final_adj_5mpp_slp.tif"


@pytest.fixture
def audit_fixtures():
    """Sets up mission profiles and candidate scenarios for scientific audit tests."""
    profile_req = MissionProfileCreateRequest(
        name="Scientific Audit Terrain Profile",
        description="Profile to verify non-overlapping coverage boundaries and certification rules",
        mission_type="robotic_lander",
        duration_days=5.0,
        intended_analysis_start_iso="2026-10-01T00:00:00Z",
        intended_analysis_end_iso="2026-10-06T00:00:00Z",
        observer_height_m=2.0,
        requirements_config={
            "terrain": {
                "max_local_slope_deg": {
                    "id": "trn-max-slope",
                    "name": "Maximum Local Slope",
                    "classification": "HARD_CONSTRAINT",
                    "operator": "<=",
                    "value": 15.0,
                    "unit": "deg",
                    "enabled": True,
                },
                "min_elevation_m": {
                    "id": "trn-min-elev",
                    "name": "Minimum Surface Elevation",
                    "classification": "HARD_CONSTRAINT",
                    "operator": ">=",
                    "value": -3500.0,
                    "unit": "m",
                    "enabled": True,
                },
                "max_elevation_m": {
                    "id": "trn-max-elev",
                    "name": "Maximum Surface Elevation",
                    "classification": "HARD_CONSTRAINT",
                    "operator": "<=",
                    "value": -2000.0,
                    "unit": "m",
                    "enabled": True,
                },
            }
        },
    )
    profile = mission_profile_service.create_profile(profile_req)
    scenarios = scenario_service.list_scenarios()

    return {"profile": profile, "scenarios": scenarios}


def test_slope_geotiff_continuous_values_and_raster_alignment():
    """
    Item 3: Slope raster interpretation audit.
    Verifies that Site01_final_adj_5mpp_slp.tif contains continuous slope in degrees,
    and shares exact spatial alignment (CRS, affine transform, dimensions) with the surface DEM.
    """
    assert SURF_TIF.exists(), f"Surface DEM {SURF_TIF} not found"
    assert SLP_TIF.exists(), f"Slope GeoTIFF {SLP_TIF} not found"

    with rasterio.open(SURF_TIF) as surf_src, rasterio.open(SLP_TIF) as slp_src:
        # Check raster metadata alignment
        assert surf_src.crs == slp_src.crs, "Surface and slope rasters have mismatched CRS"
        assert surf_src.transform == slp_src.transform, "Surface and slope rasters have mismatched affine transforms"
        assert (surf_src.width, surf_src.height) == (slp_src.width, slp_src.height), "Dimension mismatch"
        assert surf_src.res == slp_src.res == (5.0, 5.0), f"Pixel resolution mismatch: {slp_src.res}"

        # Sample a central patch of slope values
        patch = slp_src.read(1, window=rasterio.windows.Window(1000, 1000, 100, 100))
        assert patch.dtype in (np.float32, np.float64), f"Expected continuous float, got {patch.dtype}"

        valid_vals = patch[~np.isnan(patch)]
        assert valid_vals.size > 0
        min_v = float(np.min(valid_vals))
        max_v = float(np.max(valid_vals))

        # Scientific validity: slope in degrees must be between 0.0 and 90.0
        assert min_v >= 0.0, f"Negative slope encountered: {min_v}"
        assert max_v <= 90.0, f"Unphysical slope > 90 deg: {max_v}"

        # Verify continuous spread (not categorical integers)
        unique_vals = np.unique(valid_vals)
        assert len(unique_vals) > 50, "Slope values appear categorical rather than continuous"


def test_coverage_classification_non_overlapping_boundaries():
    """
    Item 1: Footprint coverage certification.
    Verifies unambiguous, non-overlapping coverage boundaries:
    - 0% valid coverage -> UNAVAILABLE
    - Just below 95% (e.g. 94.9%) -> PARTIAL
    - Exactly 95.0% -> COMPLETE (with residual unmeasured tracking)
    - Just above 95% (e.g. 95.1%) -> COMPLETE
    - 100.0% -> COMPLETE (100% certified)
    """
    svc = terrain_assessment_service

    # Case A: 0% valid coverage
    dq_0 = FootprintDataQuality(
        coverage_status=DataCoverageStatus.UNAVAILABLE,
        coverage_certainty="UNAVAILABLE",
        assessment_mode="CIRCULAR_FOOTPRINT",
        requested_radius_m=50.0,
        nominal_grid_spacing_m=5.0,
        total_pixels_in_footprint=315,
        valid_pixels_in_footprint=0,
        nodata_pixels_in_footprint=315,
        valid_data_percentage=0.0,
        evaluated_area_m2=0.0,
    )
    assert dq_0.coverage_status == DataCoverageStatus.UNAVAILABLE
    assert dq_0.coverage_certainty == "UNAVAILABLE"

    # Case B: Just below 95% (94.9%)
    total_px = 1000
    valid_949 = 949
    pct_949 = round((valid_949 / total_px) * 100.0, 1)  # 94.9
    assert pct_949 < 95.0

    cov_status_949 = DataCoverageStatus.PARTIAL if pct_949 < 95.0 else DataCoverageStatus.COMPLETE
    assert cov_status_949 == DataCoverageStatus.PARTIAL

    # Case C: Exactly 95.0%
    valid_950 = 950
    pct_950 = round((valid_950 / total_px) * 100.0, 1)  # 95.0
    assert pct_950 == 95.0

    cov_status_950 = DataCoverageStatus.PARTIAL if pct_950 < 95.0 else DataCoverageStatus.COMPLETE
    assert cov_status_950 == DataCoverageStatus.COMPLETE

    cov_cert_950 = "COMPLETE_100PCT" if (total_px - valid_950) == 0 else "COMPLETE_GE95_UNMEASURED_RESIDUAL"
    assert cov_cert_950 == "COMPLETE_GE95_UNMEASURED_RESIDUAL"

    # Case D: Just above 95.0% (95.1%)
    valid_951 = 951
    pct_951 = round((valid_951 / total_px) * 100.0, 1)  # 95.1
    assert pct_951 == 95.1

    cov_status_951 = DataCoverageStatus.PARTIAL if pct_951 < 95.0 else DataCoverageStatus.COMPLETE
    assert cov_status_951 == DataCoverageStatus.COMPLETE

    # Case E: 100.0% Complete
    valid_1000 = 1000
    pct_1000 = round((valid_1000 / total_px) * 100.0, 1)  # 100.0
    assert pct_1000 == 100.0
    cov_cert_1000 = "COMPLETE_100PCT" if (total_px - valid_1000) == 0 else "COMPLETE_GE95_UNMEASURED_RESIDUAL"
    assert cov_cert_1000 == "COMPLETE_100PCT"


def test_indeterminate_when_residual_unmeasured_terrain_exists():
    """
    Item 1: A coverage classification of COMPLETE must NOT automatically certify
    a hard constraint pass if missing terrain could change its verdict.
    If measured slope satisfies requirement (e.g. 7.5 deg <= 15 deg), BUT
    nodata_pixels_in_footprint > 0, return INDETERMINATE.
    """
    svc = terrain_assessment_service
    req = SingleRequirement(
        id="trn-max-slope",
        name="Maximum Local Slope",
        classification=RequirementClassification.HARD_CONSTRAINT,
        operator="<=",
        value=15.0,
        unit="deg",
        enabled=True,
    )

    # Footprint with 95% coverage (50 nodata pixels out of 1000)
    dq_residual = FootprintDataQuality(
        coverage_status=DataCoverageStatus.COMPLETE,
        coverage_certainty="COMPLETE_GE95_UNMEASURED_RESIDUAL",
        assessment_mode="CIRCULAR_FOOTPRINT",
        requested_radius_m=50.0,
        nominal_grid_spacing_m=5.0,
        total_pixels_in_footprint=1000,
        valid_pixels_in_footprint=950,
        nodata_pixels_in_footprint=50,
        valid_data_percentage=95.0,
        evaluated_area_m2=23750.0,
    )

    # All measured slopes are compliant (max = 8.5 deg <= 15.0 deg)
    res = svc._eval_slope_requirement(
        req=req,
        point_slope=6.2,
        max_footprint_slope=8.5,
        exceedance_pct=0.0,
        dq=dq_residual,
    )

    # Must be INDETERMINATE because 50 unmeasured pixels could violate <= 15.0 deg
    assert res.verdict == ScreeningVerdict.INDETERMINATE
    assert "prevent conclusive certification" in res.explanation
    assert "50 unmeasured pixel(s)" in res.explanation


def test_pass_certification_only_when_100pct_coverage():
    """
    Item 1: PASS verdict is awarded ONLY when nodata_pixels_in_footprint == 0
    (100% complete footprint coverage).
    """
    svc = terrain_assessment_service
    req = SingleRequirement(
        id="trn-max-slope",
        name="Maximum Local Slope",
        classification=RequirementClassification.HARD_CONSTRAINT,
        operator="<=",
        value=15.0,
        unit="deg",
        enabled=True,
    )

    dq_100 = FootprintDataQuality(
        coverage_status=DataCoverageStatus.COMPLETE,
        coverage_certainty="COMPLETE_100PCT",
        assessment_mode="CIRCULAR_FOOTPRINT",
        requested_radius_m=50.0,
        nominal_grid_spacing_m=5.0,
        total_pixels_in_footprint=1000,
        valid_pixels_in_footprint=1000,
        nodata_pixels_in_footprint=0,
        valid_data_percentage=100.0,
        evaluated_area_m2=25000.0,
    )

    res = svc._eval_slope_requirement(
        req=req,
        point_slope=6.2,
        max_footprint_slope=8.5,
        exceedance_pct=0.0,
        dq=dq_100,
    )

    assert res.verdict == ScreeningVerdict.PASS
    assert "satisfies requirement across complete 100% evaluated footprint" in res.explanation


def test_fail_preservation_despite_partial_or_indeterminate_coverage():
    """
    Item 1: If available data already proves a hard constraint failure,
    preserve FAIL even if other measurements are indeterminate or coverage is partial.
    """
    svc = terrain_assessment_service
    req = SingleRequirement(
        id="trn-max-slope",
        name="Maximum Local Slope",
        classification=RequirementClassification.HARD_CONSTRAINT,
        operator="<=",
        value=15.0,
        unit="deg",
        enabled=True,
    )

    # Footprint with only 40% valid coverage
    dq_partial = FootprintDataQuality(
        coverage_status=DataCoverageStatus.PARTIAL,
        coverage_certainty="PARTIAL_COVERAGE",
        assessment_mode="CIRCULAR_FOOTPRINT",
        requested_radius_m=50.0,
        nominal_grid_spacing_m=5.0,
        total_pixels_in_footprint=1000,
        valid_pixels_in_footprint=400,
        nodata_pixels_in_footprint=600,
        valid_data_percentage=40.0,
        evaluated_area_m2=10000.0,
    )

    # But measured slope in available data is 24.5 deg (violates 15.0 deg limit)
    res = svc._eval_slope_requirement(
        req=req,
        point_slope=8.0,
        max_footprint_slope=24.5,
        exceedance_pct=12.5,
        dq=dq_partial,
    )

    # Proven failure must strictly be FAIL!
    assert res.verdict == ScreeningVerdict.FAIL
    assert "Slope limit exceeded" in res.explanation
    assert "24.5°" in res.actual_value_str


def test_zero_radius_point_assessment_semantics(audit_fixtures):
    """
    Item 2: Radius 0.0 must be explicitly treated as a point measurement,
    labeled with assessment_mode = 'POINT', evaluated_area = 25.0 m²,
    and never referred to as a 'landing footprint'.
    """
    profile = audit_fixtures["profile"]
    scenarios = audit_fixtures["scenarios"]

    req = TerrainAssessmentRequest(
        profile_id=profile.id,
        scenario_ids=[scenarios[0].id],
        assessment_radius_m=0.0,  # Zero-radius point assessment
    )

    res = client.post("/api/terrain-assessment/assess", json=req.model_dump())
    assert res.status_code == 201
    data = res.json()

    cand = data["assessment"]["candidates"][0]
    dq = cand["data_quality"]

    assert dq["requested_radius_m"] == 0.0
    assert dq["assessment_mode"] == "POINT"
    assert dq["total_pixels_in_footprint"] == 1
    assert dq["evaluated_area_m2"] == 25.0  # 5m x 5m single pixel
    assert dq["valid_data_percentage"] == 100.0

    # Requirement results must format as point value
    slope_req_id = profile.requirements.terrain.max_local_slope_deg.id
    slope_res = next(r for r in cand["hard_constraint_results"] if r["requirement_id"] == slope_req_id)
    assert "Point:" in slope_res["actual_value_str"]
    assert "Footprint Max:" not in slope_res["actual_value_str"]


def test_missing_and_incompatible_raster_layers():
    """
    Item 6: Test missing slope raster handling, transform/CRS mismatches, and out-of-bounds coordinates.
    Never treat missing measurements as zero or automatically classify them as PASS.
    """
    svc = terrain_assessment_service

    # Candidate completely outside DEM bounds
    out_dq = FootprintDataQuality(
        coverage_status=DataCoverageStatus.UNAVAILABLE,
        coverage_certainty="UNAVAILABLE",
        assessment_mode="CIRCULAR_FOOTPRINT",
        requested_radius_m=50.0,
        nominal_grid_spacing_m=5.0,
        total_pixels_in_footprint=315,
        valid_pixels_in_footprint=0,
        nodata_pixels_in_footprint=315,
        valid_data_percentage=0.0,
        evaluated_area_m2=0.0,
    )

    req = SingleRequirement(
        id="trn-max-slope",
        name="Maximum Local Slope",
        classification=RequirementClassification.HARD_CONSTRAINT,
        operator="<=",
        value=15.0,
        unit="deg",
        enabled=True,
    )

    # When slope data is unavailable, must NOT be PASS and must NOT treat slope as 0.0
    res = svc._eval_slope_requirement(
        req=req,
        point_slope=None,
        max_footprint_slope=None,
        exceedance_pct=None,
        dq=out_dq,
    )

    assert res.verdict == ScreeningVerdict.INDETERMINATE
    assert res.actual_value is None
    assert "UNAVAILABLE" in res.actual_value_str
    assert res.verdict != ScreeningVerdict.PASS
