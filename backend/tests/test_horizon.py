import math
import numpy as np
import pytest
from fastapi.testclient import TestClient
import rasterio
from rasterio.transform import from_origin

from app.main import app
from app.schemas.horizon import HorizonAnalysisRequest
from app.services.horizon_service import HorizonEngineService, horizon_service
from app.services.coordinate_transform import LUNAR_RADIUS_M, transformer

client = TestClient(app)

@pytest.fixture
def synthetic_flat_dem(tmp_path):
    """
    Creates a 10 km x 10 km synthetic flat DEM (5m pixel spacing)
    centered at South Polar Stereographic (0, 10000) with elevation = 1000.0 m.
    """
    dem_path = tmp_path / "flat_dem.tif"
    width, height = 2000, 2000  # 10,000m x 10,000m at 5m/px
    res = 5.0
    # Top-left is at (-5000, 15000)
    transform = from_origin(-5000.0, 15000.0, res, res)
    data = np.full((height, width), 1000.0, dtype=np.float32)

    with rasterio.open(
        dem_path,
        "w",
        driver="GTiff",
        height=height,
        width=width,
        count=1,
        dtype=data.dtype,
        crs="+proj=stere +lat_0=-90 +lon_0=0 +R=1737400 +units=m",
        transform=transform,
        nodata=-32767.0,
    ) as dst:
        dst.write(data, 1)

    return dem_path

@pytest.fixture
def synthetic_ridge_dem(tmp_path):
    """
    Creates a synthetic DEM with flat baseline (1000m) and a +500m ridge (elevation 1500m)
    located 3,000 m North of the center (0, 10000).
    """
    dem_path = tmp_path / "ridge_dem.tif"
    width, height = 2000, 2000
    res = 5.0
    transform = from_origin(-5000.0, 15000.0, res, res)
    data = np.full((height, width), 1000.0, dtype=np.float32)

    # Observer will be at (0, 10000).
    # North in South Polar projection at lon=0 is +Y direction.
    # Put ridge at Y = 13000 (i.e. 3000m away North).
    # In raster coordinates: row = (15000 - Y) / 5. For Y=13000, row = 400.
    # Make a ridge from row 390 to row 410 across X.
    data[390:410, :] = 1500.0

    with rasterio.open(
        dem_path,
        "w",
        driver="GTiff",
        height=height,
        width=width,
        count=1,
        dtype=data.dtype,
        crs="+proj=stere +lat_0=-90 +lon_0=0 +R=1737400 +units=m",
        transform=transform,
        nodata=-32767.0,
    ) as dst:
        dst.write(data, 1)

    return dem_path

@pytest.fixture
def synthetic_crater_dem(tmp_path):
    """
    Creates a circular crater centered at (0, 10000) with a rim at radius 2000m (+300m height)
    and floor at 800m.
    """
    dem_path = tmp_path / "crater_dem.tif"
    width, height = 2000, 2000
    res = 5.0
    transform = from_origin(-5000.0, 15000.0, res, res)

    # Grid coordinates
    cols, rows = np.meshgrid(np.arange(width), np.arange(height))
    xs = -5000.0 + (cols + 0.5) * res
    ys = 15000.0 - (rows + 0.5) * res

    dist = np.hypot(xs - 0.0, ys - 10000.0)
    # Floor: dist < 1500m: 800m. Rim: dist around 2000m: 1300m. Outside: 1000m.
    data = 1000.0 + 300.0 * np.exp(-((dist - 2000.0) ** 2) / (2 * (300.0 ** 2)))
    data[dist < 1200] = 800.0

    with rasterio.open(
        dem_path,
        "w",
        driver="GTiff",
        height=height,
        width=width,
        count=1,
        dtype=np.float32,
        crs="+proj=stere +lat_0=-90 +lon_0=0 +R=1737400 +units=m",
        transform=transform,
        nodata=-32767.0,
    ) as dst:
        dst.write(data.astype(np.float32), 1)

    return dem_path

# ==================== TESTS ====================

def test_flat_terrain_curvature_effect(synthetic_flat_dem):
    """
    On perfectly flat terrain with observer height h_obs > 0, the apparent horizon
    elevation angle MUST be negative due to lunar spherical curvature:
    gamma(d) approx - arctan( (h_obs + d^2 / (2 R)) / d ) < 0.
    """
    service = HorizonEngineService()
    obs_x, obs_y = 0.0, 10000.0
    lat, lon = transformer.xy_to_lat_lon(obs_x, obs_y)

    with rasterio.open(synthetic_flat_dem) as src:
        resp = service.calculate_horizon_from_raster(
            src=src,
            lat=lat,
            lon=lon,
            observer_height_m=2.0,
            azimuth_resolution_deg=5.0,
            max_search_distance_m=4000.0,
            sampling_interval_m=20.0,
        )

    assert resp.summary.total_azimuths_computed == 72
    # In all directions on flat sphere, horizon angle should be slightly negative
    for pt in resp.horizon_profile:
        assert pt.horizon_elevation_deg <= 0.01

def test_single_ridge_obstruction(synthetic_ridge_dem):
    """
    With a +500m ridge 3,000m North (azimuth 0°), the maximum horizon elevation
    must occur at azimuth 0° (North), and match theoretical geometry:
    tan(gamma) = (Rs*cos(alpha) - R0) / (Rs*sin(alpha)).
    """
    service = HorizonEngineService()
    obs_x, obs_y = 0.0, 10000.0
    lat, lon = transformer.xy_to_lat_lon(obs_x, obs_y)

    with rasterio.open(synthetic_ridge_dem) as src:
        resp = service.calculate_horizon_from_raster(
            src=src,
            lat=lat,
            lon=lon,
            observer_height_m=2.0,
            azimuth_resolution_deg=2.0,
            max_search_distance_m=4000.0,
            sampling_interval_m=20.0,
        )

    # Azimuth 0° should see the ridge prominently
    pt_north = next(p for p in resp.horizon_profile if abs(p.azimuth_deg - 0.0) < 0.1)
    # Distance to ridge is ~3000m, elevation is +500m relative to base
    # Theoretical angle: arctan((500 - 2.0 - 3000^2 / (2 * 1737400)) / 3000) = arctan(495.4 / 3000) ~ 9.38°
    assert 9.0 < pt_north.horizon_elevation_deg < 10.0
    assert abs(pt_north.distance_to_horizon_m - 3000.0) < 100.0

    # Max horizon azimuth should be North (0°)
    assert resp.summary.max_horizon_azimuth_deg == 0.0

def test_observer_height_effect(synthetic_ridge_dem):
    """
    Increasing observer height (e.g. from 1m to 10m to 50m) must strictly decrease
    the apparent horizon elevation angle of the ridge (as observer's eye rises).
    """
    service = HorizonEngineService()
    obs_x, obs_y = 0.0, 10000.0
    lat, lon = transformer.xy_to_lat_lon(obs_x, obs_y)

    with rasterio.open(synthetic_ridge_dem) as src:
        resp_1m = service.calculate_horizon_from_raster(
            src=src, lat=lat, lon=lon, observer_height_m=1.0, azimuth_resolution_deg=10.0, max_search_distance_m=4000.0
        )
        resp_10m = service.calculate_horizon_from_raster(
            src=src, lat=lat, lon=lon, observer_height_m=10.0, azimuth_resolution_deg=10.0, max_search_distance_m=4000.0
        )
        resp_50m = service.calculate_horizon_from_raster(
            src=src, lat=lat, lon=lon, observer_height_m=50.0, azimuth_resolution_deg=10.0, max_search_distance_m=4000.0
        )

    ang_1m = resp_1m.summary.max_horizon_elevation_deg
    ang_10m = resp_10m.summary.max_horizon_elevation_deg
    ang_50m = resp_50m.summary.max_horizon_elevation_deg

    # Higher observer height -> lower apparent horizon angle
    assert ang_1m > ang_10m > ang_50m
    # Physical check: at 3000m, a 49m increase in eye height lowers angle by arctan(49 / 3000) ~ 0.93°
    diff = ang_1m - ang_50m
    assert 0.8 < diff < 1.1

def test_crater_circular_horizon_profile(synthetic_crater_dem):
    """
    Inside a circular crater, the horizon angle should be elevated in all 360° directions
    corresponding to the crater rim at distance ~2000m.
    """
    service = HorizonEngineService()
    obs_x, obs_y = 0.0, 10000.0
    lat, lon = transformer.xy_to_lat_lon(obs_x, obs_y)

    with rasterio.open(synthetic_crater_dem) as src:
        resp = service.calculate_horizon_from_raster(
            src=src,
            lat=lat,
            lon=lon,
            observer_height_m=2.0,
            azimuth_resolution_deg=5.0,
            max_search_distance_m=3500.0,
            sampling_interval_m=25.0,
        )

    assert resp.summary.total_azimuths_computed == 72
    # In all directions, the rim (~2000m away, ~500m above floor) forms the horizon
    for pt in resp.horizon_profile:
        assert pt.horizon_elevation_deg > 10.0
        assert abs(pt.distance_to_horizon_m - 2000.0) < 250.0

def test_out_of_bounds_and_nodata_handling(synthetic_flat_dem):
    """
    Coordinates completely outside the DEM must return coverage_status='no_data' with warnings.
    """
    service = HorizonEngineService()
    # Observer at far away coordinates (-80.0, 45.0) which is far outside synthetic DEM
    with rasterio.open(synthetic_flat_dem) as src:
        resp = service.calculate_horizon_from_raster(
            src=src,
            lat=-80.0,
            lon=45.0,
            observer_height_m=2.0,
        )

    assert resp.summary.coverage_status == "no_data"
    assert len(resp.warnings) > 0
    assert "outside the active DEM" in resp.warnings[0]

def test_api_horizon_analyze_post_and_get():
    """
    Test FastAPI endpoints POST and GET /api/horizon/analyze with real Site 01 DEM.
    Connecting Ridge coordinates: lat ~ -89.54°, lon ~ -137.49°.
    """
    # 1. POST test
    payload = {
        "latitude": -89.54,
        "longitude": -137.49,
        "observer_height_m": 2.0,
        "azimuth_resolution_deg": 2.0,
        "max_search_distance_m": 5000.0,
        "sampling_interval_m": 25.0,
        "dataset_id": "site01",
    }
    post_res = client.post("/api/horizon/analyze", json=payload)
    assert post_res.status_code == 200
    data = post_res.json()
    assert "horizon_profile" in data
    assert len(data["horizon_profile"]) == 180  # 360 / 2.0 = 180 points
    assert "summary" in data
    assert "max_horizon_elevation_deg" in data["summary"]
    assert "citation" in data

    # 2. GET test
    get_res = client.get(
        "/api/horizon/analyze?latitude=-89.54&longitude=-137.49&observer_height_m=10.0&azimuth_resolution_deg=5.0&max_search_distance_m=3000.0"
    )
    assert get_res.status_code == 200
    get_data = get_res.json()
    assert len(get_data["horizon_profile"]) == 72
    assert get_data["observer_height_m"] == 10.0
