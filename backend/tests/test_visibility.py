import math
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.visibility import (
    VisibilityInstantRequest,
    VisibilityAnalysisRequest,
    VisibilityState,
    CombinedVisibilityState,
)
from app.services.visibility_service import visibility_service

client = TestClient(app)

def test_visibility_instant_basic():
    """
    Tests instant single-epoch visibility evaluation for Sun and Earth at Site 01 (Connecting Ridge).
    """
    req = VisibilityInstantRequest(
        latitude=-89.3615,
        longitude=-151.2131,
        timestamp_iso="2026-10-04T12:00:00Z",
        observer_height_m=2.0,
        dataset_id="site01",
        azimuth_resolution_deg=2.0,
        max_search_distance_m=10000.0,
    )
    resp = visibility_service.compute_instant_visibility(req)

    # Invariants for Sun
    assert resp.sun.body_name == "Sun"
    assert 0.0 <= resp.sun.visible_fraction <= 1.0
    assert 0.0 <= resp.sun.visible_percentage <= 100.0
    assert resp.sun.visibility_state in [
        VisibilityState.FULLY_VISIBLE,
        VisibilityState.PARTIALLY_VISIBLE,
        VisibilityState.FULLY_OBSTRUCTED,
        VisibilityState.INDETERMINATE,
    ]

    # Invariants for Earth
    assert resp.earth.body_name == "Earth"
    assert 0.0 <= resp.earth.visible_fraction <= 1.0
    assert 0.0 <= resp.earth.visible_percentage <= 100.0

    # Combined state
    assert resp.combined_state in [
        CombinedVisibilityState.SUN_AND_EARTH_VISIBLE,
        CombinedVisibilityState.SUN_VISIBLE_ONLY,
        CombinedVisibilityState.EARTH_VISIBLE_ONLY,
        CombinedVisibilityState.NEITHER_VISIBLE,
        CombinedVisibilityState.PARTIAL_DUAL_VISIBILITY,
        CombinedVisibilityState.INDETERMINATE,
    ]

    # Mathematical consistency of limbs
    assert math.isclose(resp.sun.upper_limb_elevation_deg, resp.sun.elevation_deg + resp.sun.angular_radius_deg, abs_tol=1e-3)
    assert math.isclose(resp.sun.lower_limb_elevation_deg, resp.sun.elevation_deg - resp.sun.angular_radius_deg, abs_tol=1e-3)

def test_partial_disk_visibility_quadrature_accuracy():
    """
    Tests mathematical accuracy of the sliced spherical disk integration against
    the analytical circular segment formula for a flat horizontal skyline.
    """
    ang_radius = 0.2666  # Sun angular radius
    az_grid = np.linspace(0, 360, 361)
    el_grid = np.zeros(361)  # Flat horizon at 0.0°

    # Case 1: Body center at 0.0° elevation -> Exactly 50% of the disk must be visible
    vis_half = visibility_service._evaluate_disk_visibility(
        body_name="Sun",
        azimuth_deg=45.0,
        elevation_deg=0.0,
        angular_diameter_deg=ang_radius * 2.0,
        distance_km=1.5e8,
        light_time_seconds=500.0,
        horizon_az=az_grid,
        horizon_el=el_grid,
        coverage_status="complete",
    )
    assert vis_half.visibility_state == VisibilityState.PARTIALLY_VISIBLE
    assert math.isclose(vis_half.visible_fraction, 0.50, abs_tol=0.01)

    # Case 2: Body lower limb above horizon -> 100% visible
    vis_full = visibility_service._evaluate_disk_visibility(
        body_name="Sun",
        azimuth_deg=45.0,
        elevation_deg=ang_radius + 0.1,  # completely above
        angular_diameter_deg=ang_radius * 2.0,
        distance_km=1.5e8,
        light_time_seconds=500.0,
        horizon_az=az_grid,
        horizon_el=el_grid,
        coverage_status="complete",
    )
    assert vis_full.visibility_state == VisibilityState.FULLY_VISIBLE
    assert vis_full.visible_fraction == 1.0

    # Case 3: Body upper limb below horizon -> 0% visible (fully obstructed)
    vis_none = visibility_service._evaluate_disk_visibility(
        body_name="Sun",
        azimuth_deg=45.0,
        elevation_deg=-(ang_radius + 0.1),  # completely below
        angular_diameter_deg=ang_radius * 2.0,
        distance_km=1.5e8,
        light_time_seconds=500.0,
        horizon_az=az_grid,
        horizon_el=el_grid,
        coverage_status="complete",
    )
    assert vis_none.visibility_state == VisibilityState.FULLY_OBSTRUCTED
    assert vis_none.visible_fraction == 0.0

def test_earth_ridge_obstruction_at_connecting_ridge():
    """
    Validates that Earth (at Azimuth ~153°, elevation ~+3.0°) is obstructed by the
    +14° ridge peaks to the south-east of Connecting Ridge, demonstrating terrain obstruction.
    """
    req = VisibilityInstantRequest(
        latitude=-89.3615,
        longitude=-151.2131,
        timestamp_iso="2026-10-04T12:00:00Z",
        observer_height_m=2.0,
        dataset_id="site01",
        azimuth_resolution_deg=1.0,
    )
    resp = visibility_service.compute_instant_visibility(req)

    # In Connecting Ridge, south-east terrain reaches ~14° elevation
    assert resp.earth.horizon_elevation_at_azimuth_deg > 10.0
    # Earth elevation is ~3.0°, so it is lower than the 14° ridge
    assert resp.earth.elevation_deg < resp.earth.horizon_elevation_at_azimuth_deg
    assert resp.earth.visibility_state == VisibilityState.FULLY_OBSTRUCTED
    assert resp.earth.visible_fraction == 0.0

def test_visibility_time_series_and_metrics_consistency():
    """
    Tests time-series calculation, transition detection, and verifies that all
    sub-metric hours strictly sum to the total analysis interval.
    """
    req = VisibilityAnalysisRequest(
        latitude=-89.3615,
        longitude=-151.2131,
        start_timestamp_iso="2026-10-04T00:00:00Z",
        end_timestamp_iso="2026-10-05T00:00:00Z",  # 24 hours
        step_interval_hours=2.0,
        observer_height_m=2.0,
        dataset_id="site01",
        azimuth_resolution_deg=2.0,
    )
    resp = visibility_service.compute_visibility_analysis(req)

    assert resp.total_epochs_computed == 13
    assert len(resp.series) == 13

    # Check Solar Metrics consistency: full + partial + darkness == total_duration
    sm = resp.solar_metrics
    assert math.isclose(sm.total_sun_full_hours + sm.total_sun_partial_hours + sm.total_darkness_hours, 24.0, abs_tol=0.1)
    assert 0.0 <= sm.illumination_fraction <= 1.0

    # Check Earth Metrics consistency: full + partial + blackout == total_duration
    em = resp.earth_metrics
    assert math.isclose(em.total_earth_full_hours + em.total_earth_partial_hours + em.total_earth_blackout_hours, 24.0, abs_tol=0.1)
    assert 0.0 <= em.earth_visibility_fraction <= 1.0

    # Check Combined Metrics consistency: both + sun_only + earth_only + neither == total_duration
    cm = resp.combined_metrics
    assert math.isclose(cm.both_visible_hours + cm.sun_only_hours + cm.earth_only_hours + cm.neither_visible_hours, 24.0, abs_tol=0.1)

    # Check time monotonicity
    for i in range(len(resp.series) - 1):
        assert resp.series[i + 1].ephemeris_time_tdb > resp.series[i].ephemeris_time_tdb

def test_api_visibility_endpoints():
    """
    Tests FastAPI endpoints:
    - POST /api/visibility/instant
    - POST /api/visibility/analyze
    - GET /api/visibility/status
    - GET /api/visibility/provenance
    """
    # 1. Status
    res_status = client.get("/api/visibility/status")
    assert res_status.status_code == 200
    data_status = res_status.json()
    assert data_status["status"] == "operational"

    # 2. Instant
    payload_inst = {
        "latitude": -89.3615,
        "longitude": -151.2131,
        "timestamp_iso": "2026-10-04T12:00:00Z",
        "observer_height_m": 2.0,
        "dataset_id": "site01",
        "azimuth_resolution_deg": 2.0,
    }
    res_inst = client.post("/api/visibility/instant", json=payload_inst)
    assert res_inst.status_code == 200
    data_inst = res_inst.json()
    assert "sun" in data_inst
    assert "earth" in data_inst
    assert "combined_state" in data_inst

    # 3. Analyze
    payload_an = {
        "latitude": -89.3615,
        "longitude": -151.2131,
        "start_timestamp_iso": "2026-10-04T00:00:00Z",
        "end_timestamp_iso": "2026-10-04T12:00:00Z",
        "step_interval_hours": 3.0,
        "observer_height_m": 2.0,
        "dataset_id": "site01",
        "azimuth_resolution_deg": 2.0,
    }
    res_an = client.post("/api/visibility/analyze", json=payload_an)
    assert res_an.status_code == 200
    data_an = res_an.json()
    assert data_an["total_epochs_computed"] == 5
    assert "solar_metrics" in data_an
    assert "earth_metrics" in data_an

    # 4. Provenance
    res_prov = client.get("/api/visibility/provenance")
    assert res_prov.status_code == 200
    data_prov = res_prov.json()
    assert data_prov["lunar_reference_frame"] == "MOON_ME (DE421 Mean Earth/Polar Axis realization)"

def test_partial_dem_coverage_certainty_below_at_above_5deg():
    """
    Tests conservative partial DEM coverage handling without arbitrary thresholds:
    - Below 5° (3°): Incomplete ray below physical upper bound -> INDETERMINATE
    - At 5° (5°): Incomplete ray below physical upper bound -> INDETERMINATE (correcting old 5° cutoff)
    - Above 5° (7°): Incomplete ray below physical upper bound -> INDETERMINATE (correcting old open-sky assumption)
    - Above physical upper bound (45°): Exceeds maximum possible lunar relief -> CONFIRMED FULLY_VISIBLE
    - Obstructed by active DEM: Local ridge blocks sightline -> CONFIRMED FULLY_OBSTRUCTED (monotonicity)
    """
    from app.schemas.visibility import CoverageCertainty

    az_grid = np.linspace(0, 360, 361)
    el_grid = np.zeros(361)  # Flat local DEM at 0.0°
    comp_grid = np.zeros(361)  # Incomplete rays (partial DEM)
    bound_grid = np.full(361, 35.0)  # Maximum physical external topography bound at 35.0°

    # 1. Target below 5.0° (elevation = 3.0°)
    vis_3deg = visibility_service._evaluate_disk_visibility(
        body_name="Sun",
        azimuth_deg=90.0,
        elevation_deg=3.0,
        angular_diameter_deg=0.533,
        distance_km=1.5e8,
        light_time_seconds=500.0,
        horizon_az=az_grid,
        horizon_el=el_grid,
        coverage_status="partial",
        horizon_comp=comp_grid,
        horizon_bound=bound_grid,
    )
    assert vis_3deg.coverage_certainty == CoverageCertainty.INDETERMINATE_PARTIAL_DEM
    assert vis_3deg.visibility_state == VisibilityState.INDETERMINATE

    # 2. Target at exactly 5.0° (elevation = 5.0°)
    vis_5deg = visibility_service._evaluate_disk_visibility(
        body_name="Sun",
        azimuth_deg=90.0,
        elevation_deg=5.0,
        angular_diameter_deg=0.533,
        distance_km=1.5e8,
        light_time_seconds=500.0,
        horizon_az=az_grid,
        horizon_el=el_grid,
        coverage_status="partial",
        horizon_comp=comp_grid,
        horizon_bound=bound_grid,
    )
    assert vis_5deg.coverage_certainty == CoverageCertainty.INDETERMINATE_PARTIAL_DEM
    assert vis_5deg.visibility_state == VisibilityState.INDETERMINATE

    # 3. Target above 5.0° but below physical upper bound (elevation = 7.0°)
    vis_7deg = visibility_service._evaluate_disk_visibility(
        body_name="Sun",
        azimuth_deg=90.0,
        elevation_deg=7.0,
        angular_diameter_deg=0.533,
        distance_km=1.5e8,
        light_time_seconds=500.0,
        horizon_az=az_grid,
        horizon_el=el_grid,
        coverage_status="partial",
        horizon_comp=comp_grid,
        horizon_bound=bound_grid,
    )
    assert vis_7deg.coverage_certainty == CoverageCertainty.INDETERMINATE_PARTIAL_DEM
    assert vis_7deg.visibility_state == VisibilityState.INDETERMINATE

    # 4. Target above physical upper bound (elevation = 45.0° > 35.0°)
    vis_45deg = visibility_service._evaluate_disk_visibility(
        body_name="Sun",
        azimuth_deg=90.0,
        elevation_deg=45.0,
        angular_diameter_deg=0.533,
        distance_km=1.5e8,
        light_time_seconds=500.0,
        horizon_az=az_grid,
        horizon_el=el_grid,
        coverage_status="partial",
        horizon_comp=comp_grid,
        horizon_bound=bound_grid,
    )
    assert vis_45deg.coverage_certainty == CoverageCertainty.CONFIRMED_EVALUATED
    assert vis_45deg.visibility_state == VisibilityState.FULLY_VISIBLE
    assert vis_45deg.visible_fraction == 1.0

    # 5. Target definitely obstructed by active DEM ridge (elevation = 2.0°, ridge = 10.0°)
    el_ridge = np.full(361, 10.0)
    vis_blocked = visibility_service._evaluate_disk_visibility(
        body_name="Sun",
        azimuth_deg=90.0,
        elevation_deg=2.0,
        angular_diameter_deg=0.533,
        distance_km=1.5e8,
        light_time_seconds=500.0,
        horizon_az=az_grid,
        horizon_el=el_ridge,
        coverage_status="partial",
        horizon_comp=comp_grid,
        horizon_bound=bound_grid,
    )
    assert vis_blocked.coverage_certainty == CoverageCertainty.CONFIRMED_EVALUATED
    assert vis_blocked.visibility_state == VisibilityState.FULLY_OBSTRUCTED
    assert vis_blocked.visible_fraction == 0.0

def test_finite_disk_synthetic_profiles_and_analytical_segments():
    """
    Rigorously validates numerical disk integration against:
    1. Analytical circular segment formula: F(x) = (1/pi) * (arccos(-x) + x*sqrt(1 - x^2))
    2. Significant cross-disk skyline variation (step function cliff across center of disk)
    3. Azimuth wraparound at 0°/360° boundary
    """
    ang_rad = 0.2666
    az_grid = np.linspace(0, 360, 361)
    el_flat = np.zeros(361)

    # 1. Circular segment at x = +0.5 (center clearance = +R/2)
    # Analytical: (1/pi)*(arccos(-0.5) + 0.5*sqrt(0.75)) = (1/pi)*(2*pi/3 + sqrt(3)/4) ~= 0.8045
    x = 0.5
    f_analytic_pos = (math.acos(-x) + x * math.sqrt(1.0 - x**2)) / math.pi
    vis_pos = visibility_service._evaluate_disk_visibility(
        body_name="Sun",
        azimuth_deg=180.0,
        elevation_deg=x * ang_rad,
        angular_diameter_deg=ang_rad * 2.0,
        distance_km=1.5e8,
        light_time_seconds=500.0,
        horizon_az=az_grid,
        horizon_el=el_flat,
        coverage_status="complete",
    )
    assert math.isclose(vis_pos.visible_fraction, f_analytic_pos, abs_tol=0.003)

    # Circular segment at x = -0.5 (center clearance = -R/2)
    # Analytical: 1.0 - 0.8045 ~= 0.1955
    x = -0.5
    f_analytic_neg = (math.acos(-x) + x * math.sqrt(1.0 - x**2)) / math.pi
    vis_neg = visibility_service._evaluate_disk_visibility(
        body_name="Sun",
        azimuth_deg=180.0,
        elevation_deg=x * ang_rad,
        angular_diameter_deg=ang_rad * 2.0,
        distance_km=1.5e8,
        light_time_seconds=500.0,
        horizon_az=az_grid,
        horizon_el=el_flat,
        coverage_status="complete",
    )
    assert math.isclose(vis_neg.visible_fraction, f_analytic_neg, abs_tol=0.003)

    # 2. Significant cross-disk horizon variation: Step-function cliff splitting disk in half
    # For azimuth < 180°, horizon is +10° (total block of left half)
    # For azimuth >= 180°, horizon is -10° (open sky for right half)
    # Analytical visible fraction is exactly 0.5000 (right half unoccluded, left half blocked)
    az_step_grid = np.linspace(0, 360, 36001)  # 0.01° fine resolution
    el_step = np.where(az_step_grid < 180.0, 10.0, -10.0)
    vis_step = visibility_service._evaluate_disk_visibility(
        body_name="Sun",
        azimuth_deg=180.0,
        elevation_deg=0.0,
        angular_diameter_deg=ang_rad * 2.0,
        distance_km=1.5e8,
        light_time_seconds=500.0,
        horizon_az=az_step_grid,
        horizon_el=el_step,
        coverage_status="complete",
        n_slices=101,
    )
    assert math.isclose(vis_step.visible_fraction, 0.500, abs_tol=0.015)

    # 3. Azimuth wraparound at 0°/360° boundary
    # Center at 0.05°, disk spans from 359.78° to 0.32°
    vis_wrap = visibility_service._evaluate_disk_visibility(
        body_name="Sun",
        azimuth_deg=0.05,
        elevation_deg=0.0,
        angular_diameter_deg=ang_rad * 2.0,
        distance_km=1.5e8,
        light_time_seconds=500.0,
        horizon_az=az_grid,
        horizon_el=el_flat,
        coverage_status="complete",
    )
    assert math.isclose(vis_wrap.visible_fraction, 0.500, abs_tol=0.005)
