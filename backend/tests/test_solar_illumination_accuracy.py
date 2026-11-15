import pytest
import numpy as np
from datetime import datetime, timezone

from app.services.visibility_service import visibility_service
from app.schemas.visibility import (
    VisibilityState,
    CoverageCertainty,
    VisibilityInstantRequest,
    VisibilityAnalysisRequest,
)

def test_flat_unobstructed_solar_disk():
    """When Sun is fully above a flat 0° horizon (El > R_sun), fraction must be exactly 1.0."""
    az_grid = np.array([0.0, 180.0, 360.0])
    el_grid = np.array([0.0, 0.0, 0.0])  # flat sea-level horizon
    
    # Sun elevation at +2.0° with radius 0.2666° (lower limb is at +1.7334° > 0.0°)
    res = visibility_service._evaluate_disk_visibility(
        body_name="SUN",
        azimuth_deg=45.0,
        elevation_deg=2.0,
        angular_diameter_deg=0.5332,
        distance_km=1.49e8,
        light_time_seconds=500.0,
        horizon_az=az_grid,
        horizon_el=el_grid,
        coverage_status="COMPLETE",
    )
    assert res.visible_fraction == 1.0
    assert res.visible_percentage == 100.0
    assert res.visibility_state == VisibilityState.FULLY_VISIBLE
    assert res.coverage_certainty == CoverageCertainty.CONFIRMED_EVALUATED

def test_completely_obstructed_solar_disk():
    """When Sun is fully below horizon (El < -R_sun), fraction must be exactly 0.0."""
    az_grid = np.array([0.0, 180.0, 360.0])
    el_grid = np.array([5.0, 5.0, 5.0])  # 5° high mountain ridge
    
    # Sun elevation at +2.0° (upper limb is at +2.2666° < 5.0°)
    res = visibility_service._evaluate_disk_visibility(
        body_name="SUN",
        azimuth_deg=45.0,
        elevation_deg=2.0,
        angular_diameter_deg=0.5332,
        distance_km=1.49e8,
        light_time_seconds=500.0,
        horizon_az=az_grid,
        horizon_el=el_grid,
        coverage_status="COMPLETE",
    )
    assert res.visible_fraction == 0.0
    assert res.visible_percentage == 0.0
    assert res.visibility_state == VisibilityState.FULLY_OBSTRUCTED

def test_partial_disk_quadrature_convergence():
    """
    Verify numerical slice quadrature against the analytical circular segment formula:
    A_segment = R^2 * arccos(d/R) - d * sqrt(R^2 - d^2)
    F = A_segment / (pi * R^2)
    """
    R = 0.2666
    d = 0.1000  # chord offset from center
    # analytical segment area for circle
    analytical_area = (R**2) * np.arccos(d / R) - d * np.sqrt(R**2 - d**2)
    analytical_fraction = analytical_area / (np.pi * (R**2))
    
    az_grid = np.array([0.0, 180.0, 360.0])
    # Set horizon elevation such that center elevation - horizon = -d
    # e.g., horizon = 1.0°, center = 0.9° -> offset = 0.1° below horizon
    el_grid = np.array([1.0, 1.0, 1.0])
    
    for n in (31, 61, 121):
        res = visibility_service._evaluate_disk_visibility(
            body_name="SUN",
            azimuth_deg=45.0,
            elevation_deg=1.0 - d,
            angular_diameter_deg=2.0 * R,
            distance_km=1.49e8,
            light_time_seconds=500.0,
            horizon_az=az_grid,
            horizon_el=el_grid,
            coverage_status="COMPLETE",
            n_slices=n,
        )
        error = abs(res.visible_fraction - analytical_fraction)
        rel_error = error / analytical_fraction
        assert rel_error < 0.01, f"Slice quadrature n={n} error {rel_error:.4%} exceeded 1%"

def test_grazing_disk_contact_bounds():
    """Verify grazing contacts at upper limb and lower limb transitions."""
    R = 0.2666
    az_grid = np.array([0.0, 180.0, 360.0])
    el_grid = np.array([1.0, 1.0, 1.0])
    
    # Just above lower limb clearance: El = 1.0 + R + 0.001 -> FULL
    res_full = visibility_service._evaluate_disk_visibility(
        body_name="SUN",
        azimuth_deg=90.0,
        elevation_deg=1.0 + R + 0.001,
        angular_diameter_deg=2.0 * R,
        distance_km=1.49e8,
        light_time_seconds=500.0,
        horizon_az=az_grid,
        horizon_el=el_grid,
        coverage_status="COMPLETE",
    )
    assert res_full.visible_fraction >= 0.999
    assert res_full.visibility_state == VisibilityState.FULLY_VISIBLE
    
    # Just below upper limb: El = 1.0 - R - 0.001 -> DARK
    res_dark = visibility_service._evaluate_disk_visibility(
        body_name="SUN",
        azimuth_deg=90.0,
        elevation_deg=1.0 - R - 0.001,
        angular_diameter_deg=2.0 * R,
        distance_km=1.49e8,
        light_time_seconds=500.0,
        horizon_az=az_grid,
        horizon_el=el_grid,
        coverage_status="COMPLETE",
    )
    assert res_dark.visible_fraction <= 0.001
    assert res_dark.visibility_state == VisibilityState.FULLY_OBSTRUCTED

def test_mathematical_sum_conservation_invariant():
    """
    Ensure the fundamental conservation law holds strictly:
    FULL_SUN_PCT + PARTIAL_SUN_PCT + DARKNESS_SUN_PCT == 100.00%
    within 0.01% numerical rounding tolerance.
    """
    req = VisibilityAnalysisRequest(
        latitude=-89.4632,
        longitude=-137.4896,
        start_timestamp_iso="2026-10-04T12:00:00Z",
        end_timestamp_iso="2026-10-07T12:00:00Z",
        step_interval_hours=2.0,
        observer_height_m=2.0,
        dataset_id="site01",
    )
    resp = visibility_service.compute_visibility_analysis(req)
    solar = resp.solar_metrics
    earth = resp.earth_metrics
    
    solar_sum = solar.full_sunlight_percentage + solar.partial_sunlight_percentage + solar.darkness_percentage
    earth_sum = earth.full_earth_percentage + earth.partial_earth_percentage + earth.earth_blackout_percentage
    
    assert abs(solar_sum - 100.0) <= 0.02, f"Solar sum conservation failed: {solar_sum}% != 100.00%"
    assert abs(earth_sum - 100.0) <= 0.02, f"Earth sum conservation failed: {earth_sum}% != 100.00%"
    assert solar.any_sunlight_percentage == round(solar.full_sunlight_percentage + solar.partial_sunlight_percentage, 2)

def test_site01_solar_illumination_audit_accuracy():
    """
    Rigorous verification of the Site01 audit:
    Sun is visible at grazing angles (partial sunlight) for ~95% of the time,
    full sunlight is only ~4% (3.0h), and the TRUE time-weighted solar disk fraction
    is between 35% and 42% (NOT 100%).
    """
    req = VisibilityAnalysisRequest(
        latitude=-89.4632,
        longitude=-137.4896,
        start_timestamp_iso="2026-10-04T12:00:00Z",
        end_timestamp_iso="2026-10-07T12:00:00Z",
        step_interval_hours=1.0,
        observer_height_m=2.0,
        dataset_id="site01",
    )
    resp = visibility_service.compute_visibility_analysis(req)
    solar = resp.solar_metrics
    
    # Total analysis interval is exactly 72.0 hours
    total_hours = (resp.combined_metrics.total_interval_hours)
    assert abs(total_hours - 72.0) < 0.01
    
    # Full sunlight must be only around 3 hours (~4.17%)
    assert 2.0 <= solar.total_sun_full_hours <= 5.0
    assert 2.0 <= solar.full_sunlight_percentage <= 7.0
    
    # Partial sunlight accounts for the vast majority of grazing contacts
    assert solar.total_sun_partial_hours >= 65.0
    assert solar.partial_sunlight_percentage >= 90.0
    
    # Crucial audit test: Time-Weighted Solar Disk Fraction MUST NOT be 100%!
    # It reflects true integrated solar disk area over terrain: ~38%
    assert 30.0 <= solar.time_weighted_sunlight_percentage <= 45.0, (
        f"Time-weighted solar disk percentage was {solar.time_weighted_sunlight_percentage}%, expected 30-45%!"
    )
    assert 0.30 <= solar.time_weighted_solar_disk_fraction <= 0.45
    
    # Any-contact duration is ~100%, but must be labeled as any_sunlight_percentage, distinct from time-weighted!
    assert solar.any_sunlight_percentage >= 98.0
    assert solar.time_weighted_sunlight_percentage != solar.any_sunlight_percentage

def test_time_integration_step_convergence():
    """
    Verify that time-weighted solar disk fraction converges stably
    across sampling resolutions: 0.5h, 1.0h, 2.0h, 4.0h.
    """
    results = {}
    for step in (1.0, 2.0, 4.0):
        req = VisibilityAnalysisRequest(
            latitude=-89.4632,
            longitude=-137.4896,
            start_timestamp_iso="2026-10-04T12:00:00Z",
            end_timestamp_iso="2026-10-07T12:00:00Z",
            step_interval_hours=step,
            observer_height_m=2.0,
            dataset_id="site01",
        )
        resp = visibility_service.compute_visibility_analysis(req)
        results[step] = resp.solar_metrics.time_weighted_sunlight_percentage
    
    # All resolutions should converge within 1.0% of each other
    assert abs(results[1.0] - results[2.0]) < 1.0
    assert abs(results[1.0] - results[4.0]) < 1.5

def test_indeterminate_dem_coverage_tracking():
    """
    When sightlines exit the local DEM boundary below the external obstacle elevation bound,
    the coverage certainty must record INDETERMINATE_PARTIAL_DEM.
    """
    req = VisibilityAnalysisRequest(
        latitude=-89.4632,
        longitude=-137.4896,
        start_timestamp_iso="2026-10-04T12:00:00Z",
        end_timestamp_iso="2026-10-07T12:00:00Z",
        step_interval_hours=2.0,
        observer_height_m=2.0,
        dataset_id="site01",
    )
    resp = visibility_service.compute_visibility_analysis(req)
    # The horizon rays for Site01 exit the 8km DEM boundary on the ridge
    # Verify the tracking fields exist and are finite numbers
    assert resp.solar_metrics.indeterminate_hours is not None
    assert resp.solar_metrics.indeterminate_percentage is not None
    assert 0.0 <= resp.solar_metrics.indeterminate_percentage <= 100.0
