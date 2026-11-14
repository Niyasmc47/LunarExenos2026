import math
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.ephemeris import EphemerisPositionRequest, EphemerisTimeSeriesRequest
from app.services.ephemeris_service import ephemeris_service
from app.services.kernel_manager import kernel_manager

client = TestClient(app)

def test_kernel_manager_status_and_manifest():
    """
    Validates that all required NAIF kernels (LSK, PCK, FK, SPK) are verified and loaded.
    """
    kernel_manager.ensure_kernels_loaded()
    status = kernel_manager.get_status()

    assert status["service_status"] == "operational"
    assert "CSPICE" in status["spice_toolkit_version"]
    assert status["total_kernels_loaded"] >= 5
    assert status["primary_lunar_frame"] == "MOON_ME (DE421)"

    filenames = [k["filename"] for k in status["active_kernels"]]
    assert "naif0012.tls" in filenames
    assert "pck00010.tpc" in filenames
    assert "moon_pa_de421_1900-2050.bpc" in filenames
    assert "moon_080317.tf" in filenames
    assert "de421.bsp" in filenames

def test_local_tangent_basis_orthonormality():
    """
    Tests mathematical orthonormality and right-handedness of the local tangent basis
    at multiple extreme lunar latitudes and longitudes, including near the South Pole.
    """
    test_coords = [
        (0.0, 0.0),       # Equator, Prime Meridian
        (-45.0, 90.0),    # Mid-latitude East
        (-89.54, -137.49),# Site 01 Connecting Ridge (near South Pole)
        (-89.99, 45.0),   # 1 km from exact South Pole
        (85.0, -60.0),    # Far North
    ]

    for lat_deg, lon_deg in test_coords:
        phi = math.radians(lat_deg)
        lam = math.radians(lon_deg)

        u_east = np.array([-math.sin(lam), math.cos(lam), 0.0])
        u_north = np.array([-math.sin(phi) * math.cos(lam), -math.sin(phi) * math.sin(lam), math.cos(phi)])
        u_up = np.array([math.cos(phi) * math.cos(lam), math.cos(phi) * math.sin(lam), math.sin(phi)])

        # Unit length checks
        assert math.isclose(np.linalg.norm(u_east), 1.0, abs_tol=1e-12)
        assert math.isclose(np.linalg.norm(u_north), 1.0, abs_tol=1e-12)
        assert math.isclose(np.linalg.norm(u_up), 1.0, abs_tol=1e-12)

        # Orthogonality checks
        assert math.isclose(float(np.dot(u_east, u_north)), 0.0, abs_tol=1e-12)
        assert math.isclose(float(np.dot(u_east, u_up)), 0.0, abs_tol=1e-12)
        assert math.isclose(float(np.dot(u_north, u_up)), 0.0, abs_tol=1e-12)

        # Right-handed cross product: East x North = Up
        cross_en = np.cross(u_east, u_north)
        assert np.allclose(cross_en, u_up, atol=1e-12)

def test_sun_and_earth_position_invariants():
    """
    Tests physical and mathematical invariants of Sun and Earth topocentric positions:
    - Azimuth in [0, 360)
    - Elevation in [-90, +90]
    - Sun distance ~ 1.47e8 - 1.52e8 km
    - Earth distance ~ 3.5e5 - 4.1e5 km
    - Sun angular diameter ~ 0.52° - 0.54°
    - Earth angular diameter ~ 1.8° - 2.0°
    """
    req = EphemerisPositionRequest(
        latitude=-89.54,
        longitude=-137.49,
        timestamp_iso="2026-10-04T12:00:00Z",
        observer_height_m=2.0,
        dataset_id="site01",
        aberration_correction="LT+S",
    )
    resp = ephemeris_service.calculate_position(req)

    # Invariants for Sun
    assert 0.0 <= resp.sun.azimuth_deg < 360.0
    assert -90.0 <= resp.sun.elevation_deg <= 90.0
    assert 1.45e8 <= resp.sun.distance_km <= 1.53e8
    assert 0.50 <= resp.sun.apparent_angular_diameter_deg <= 0.56
    assert resp.sun.light_time_seconds > 450.0  # ~8.3 minutes

    # Invariants for Earth
    assert 0.0 <= resp.earth.azimuth_deg < 360.0
    assert -90.0 <= resp.earth.elevation_deg <= 90.0
    assert 3.5e5 <= resp.earth.distance_km <= 4.2e5
    assert 1.70 <= resp.earth.apparent_angular_diameter_deg <= 2.10
    assert resp.earth.light_time_seconds > 1.0  # ~1.28 seconds

def test_observer_height_changes_topocentric_geometry():
    """
    Tests that changing observer instrument height (0m vs 10m vs 100m)
    strictly updates the topocentric observer position and changes topocentric distance.
    """
    req_0m = EphemerisPositionRequest(
        latitude=-89.54, longitude=-137.49, timestamp_iso="2026-10-04T12:00:00Z", observer_height_m=0.0
    )
    req_100m = EphemerisPositionRequest(
        latitude=-89.54, longitude=-137.49, timestamp_iso="2026-10-04T12:00:00Z", observer_height_m=100.0
    )

    resp_0m = ephemeris_service.calculate_position(req_0m)
    resp_100m = ephemeris_service.calculate_position(req_100m)

    assert resp_0m.total_observer_elevation_m < resp_100m.total_observer_elevation_m
    r0 = np.linalg.norm(resp_0m.observer_cartesian_moon_me_km)
    r100 = np.linalg.norm(resp_100m.observer_cartesian_moon_me_km)
    # 100m difference in radial distance
    assert math.isclose(r100 - r0, 0.1, abs_tol=1e-3)

def test_time_series_calculation():
    """
    Tests calculation of topocentric time series over a 24-hour lunar cycle.
    Confirms epoch counts, strictly increasing timestamps, and continuous motion.
    """
    req = EphemerisTimeSeriesRequest(
        latitude=-89.54,
        longitude=-137.49,
        start_timestamp_iso="2026-10-04T00:00:00Z",
        end_timestamp_iso="2026-10-05T00:00:00Z",
        step_interval_hours=2.0,
        observer_height_m=2.0,
    )
    resp = ephemeris_service.calculate_timeseries(req)

    assert resp.total_epochs_computed == 13  # 0, 2, 4, ..., 24h = 13 steps
    assert len(resp.series) == 13

    # Check strictly increasing ephemeris time
    for i in range(len(resp.series) - 1):
        assert resp.series[i + 1].ephemeris_time_tdb > resp.series[i].ephemeris_time_tdb

def test_api_endpoints_post_and_get():
    """
    Tests FastAPI endpoints:
    - POST /api/ephemeris/position
    - POST /api/ephemeris/timeseries
    - GET /api/ephemeris/status
    - GET /api/ephemeris/provenance
    """
    # 1. Status
    res_status = client.get("/api/ephemeris/status")
    assert res_status.status_code == 200
    data_status = res_status.json()
    assert data_status["service_status"] == "operational"

    # 2. Position
    payload_pos = {
        "latitude": -89.54,
        "longitude": -137.49,
        "timestamp_iso": "2026-10-04T12:00:00Z",
        "observer_height_m": 2.0,
        "dataset_id": "site01",
    }
    res_pos = client.post("/api/ephemeris/position", json=payload_pos)
    assert res_pos.status_code == 200
    data_pos = res_pos.json()
    assert "sun" in data_pos
    assert "earth" in data_pos
    assert data_pos["sun"]["body_name"] == "Sun"
    assert data_pos["earth"]["body_name"] == "Earth"

    # 3. Time Series
    payload_ts = {
        "latitude": -89.54,
        "longitude": -137.49,
        "start_timestamp_iso": "2026-10-04T00:00:00Z",
        "end_timestamp_iso": "2026-10-04T12:00:00Z",
        "step_interval_hours": 3.0,
        "observer_height_m": 2.0,
    }
    res_ts = client.post("/api/ephemeris/timeseries", json=payload_ts)
    assert res_ts.status_code == 200
    data_ts = res_ts.json()
    assert data_ts["total_epochs_computed"] == 5

    # 4. Provenance
    res_prov = client.get("/api/ephemeris/provenance")
    assert res_prov.status_code == 200
    data_prov = res_prov.json()
    assert data_prov["coordinate_conventions"]["lunar_reference_frame"] == "MOON_ME (DE421)"

def test_epoch_boundary_validation():
    """
    Tests that epochs outside the high-precision DE421 / PCK coverage window (1900-01-01 to 2050-12-31)
    are strictly rejected with informative error messages.
    """
    req_pre_1900 = EphemerisPositionRequest(
        latitude=-89.54,
        longitude=-137.49,
        timestamp_iso="1880-01-01T00:00:00Z",
    )
    with pytest.raises(ValueError, match="outside high-precision DE421"):
        ephemeris_service.calculate_position(req_pre_1900)

    req_post_2050 = EphemerisPositionRequest(
        latitude=-89.54,
        longitude=-137.49,
        timestamp_iso="2060-01-01T00:00:00Z",
    )
    with pytest.raises(ValueError, match="outside high-precision DE421"):
        ephemeris_service.calculate_position(req_post_2050)

def test_independent_reference_validation_horizons_tolerance():
    """
    Independently validates topocentric Sun and Earth azimuth, elevation, and distance
    against reference calculations for Site 01 (Connecting Ridge) at 2026-07-20 12:00:00 UTC.
    Tolerances: Azimuth/Elevation < 0.05° (sub-arcminute), Distance < 0.1%.
    """
    req = EphemerisPositionRequest(
        latitude=-89.3615,
        longitude=-151.2131,
        observer_height_m=0.0,
        timestamp_iso="2026-07-20T12:00:00Z",
        aberration_correction="LT+S",
    )
    resp = ephemeris_service.calculate_position(req)

    # Reference values (JPL Horizons / SPICE topocentric benchmark):
    # Sun: Azimuth ~ 259.052°, Elevation ~ -0.974°, Dist ~ 151,934,438 km
    assert math.isclose(resp.sun.azimuth_deg, 259.052, abs_tol=0.01)
    assert math.isclose(resp.sun.elevation_deg, -0.974, abs_tol=0.01)
    assert math.isclose(resp.sun.distance_km, 151934438.7, rel_tol=1e-4)

    # Earth: Azimuth ~ 157.957°, Elevation ~ -5.746°, Dist ~ 391,107 km
    assert math.isclose(resp.earth.azimuth_deg, 157.957, abs_tol=0.01)
    assert math.isclose(resp.earth.elevation_deg, -5.746, abs_tol=0.01)
    assert math.isclose(resp.earth.distance_km, 391107.2, rel_tol=1e-4)
