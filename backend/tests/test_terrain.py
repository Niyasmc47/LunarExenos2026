import pytest
from pathlib import Path
import numpy as np
from fastapi.testclient import TestClient

from app.main import app
from app.services.coordinate_transform import transformer, LUNAR_RADIUS_M
from app.services.dem_loader import dem_loader
from app.services.terrain_mesh import terrain_mesh_service

client = TestClient(app)

def test_dem_file_exists():
    assert dem_loader.is_available() is True
    assert dem_loader.surf_path.exists()
    assert dem_loader.surf_path.stat().st_size > 10_000_000

def test_dem_metadata():
    meta = dem_loader.get_metadata()
    assert meta.dataset_id == "site01"
    assert meta.dimensions["width"] == 3200
    assert meta.dimensions["height"] == 3200
    assert meta.pixel_spacing_m == 5.0
    assert meta.bounds_projected.left == -19000.0
    assert meta.bounds_projected.right == -3000.0
    assert meta.bounds_projected.bottom == -20000.0
    assert meta.bounds_projected.top == -4000.0
    assert meta.elevation_stats.min_m < 0  # crater basin
    assert meta.elevation_stats.max_m > 1500  # ridge peak
    assert meta.center_geographic.latitude < -89.0  # near south pole

def test_coordinate_roundtrip_math():
    test_coords = [
        (-90.0, 0.0),
        (-89.5, -135.0),
        (-89.2, 45.0),
        (-88.0, 90.0),
        (-85.0, -170.0),
    ]
    for lat, lon in test_coords:
        x, y = transformer.lat_lon_to_xy(lat, lon)
        r_lat, r_lon = transformer.xy_to_lat_lon(x, y)
        assert abs(r_lat - lat) < 1e-4
        if lat < -89.99:
            # At exact pole, longitude is singular
            pass
        else:
            assert abs(r_lon - lon) < 1e-4

def test_pixel_to_xy_roundtrip():
    dem_loader._ensure_open()
    transform = dem_loader._surf_src.transform
    for col, row in [(0, 0), (1600, 1600), (3199, 3199)]:
        x, y = transformer.pixel_to_xy(col, row, transform)
        r_col, r_row = transformer.xy_to_pixel(x, y, transform)
        assert abs(r_col - col) < 1e-3
        assert abs(r_row - row) < 1e-3

def test_elevation_sampling_in_bounds():
    # Center of Site01 Connecting Ridge
    center_lat = -89.4632
    center_lon = -137.4896
    res = dem_loader.sample_point(center_lat, center_lon)
    assert res["in_bounds"] is True
    assert res["elevation_m"] is not None
    assert -1000.0 < res["elevation_m"] < 3000.0
    assert res["quality_status"] in ["measured", "interpolated"]

def test_elevation_sampling_out_of_bounds():
    # Apollo 11 coordinates (Equator) - outside south pole Site01
    res = dem_loader.sample_point(0.6741, 23.4730)
    assert res["in_bounds"] is False
    assert res["elevation_m"] is None
    assert res["quality_status"] == "out_of_bounds"

def test_downsampled_grid():
    grid = dem_loader.get_downsampled_grid(lod="low", max_dim=32)
    assert grid["grid_width"] == 32
    assert grid["grid_height"] == 32
    assert len(grid["elevations"]) == 32
    assert len(grid["elevations"][0]) == 32
    assert grid["min_elevation"] is not None
    assert grid["max_elevation"] is not None

def test_mesh_generation_structure():
    mesh = terrain_mesh_service.generate_mesh_data(lod="low", vertical_exaggeration=1.0, max_dim=24)
    assert mesh["vertex_count"] > 100
    assert mesh["triangle_count"] > 100
    assert len(mesh["positions"]) == mesh["vertex_count"] * 3
    assert len(mesh["normals"]) == mesh["vertex_count"] * 3
    assert len(mesh["uvs"]) == mesh["vertex_count"] * 2
    assert len(mesh["indices"]) == mesh["triangle_count"] * 3

    # Verify spherical placement conforms to Moon sphere (R ~ 2.0)
    positions = np.array(mesh["positions"]).reshape(-1, 3)
    radii = np.linalg.norm(positions, axis=1)
    # Radii should be clustered tightly around 2.0 (globe radius units)
    assert np.all(radii > 1.95)
    assert np.all(radii < 2.05)
    # Y coordinates should be negative because Site01 is at the South Pole (-Y)
    assert np.all(positions[:, 1] < -1.8)

def test_api_datasets():
    response = client.get("/api/terrain/datasets")
    assert response.status_code == 200
    data = response.json()
    assert "datasets" in data
    assert len(data["datasets"]) >= 1
    assert data["datasets"][0]["id"] == "site01"

def test_api_metadata():
    response = client.get("/api/terrain/site01/metadata")
    assert response.status_code == 200
    data = response.json()
    assert data["dataset_id"] == "site01"
    assert "bounds_projected" in data
    assert "elevation_stats" in data

def test_api_elevation():
    response = client.get("/api/terrain/elevation?latitude=-89.4632&longitude=-137.4896")
    assert response.status_code == 200
    data = response.json()
    assert data["in_bounds"] is True
    assert data["elevation_m"] is not None

def test_api_mesh():
    response = client.get("/api/terrain/site01/mesh?lod=low&max_dim=16")
    assert response.status_code == 200
    data = response.json()
    assert "positions" in data
    assert "indices" in data
    assert data["triangle_count"] > 0

def test_api_overlays():
    res_elev = client.get("/api/terrain/site01/overlay/elevation.png?width=128&height=128")
    assert res_elev.status_code == 200
    assert res_elev.headers["content-type"] == "image/png"
    assert len(res_elev.content) > 100

    res_slp = client.get("/api/terrain/site01/overlay/slope.png?width=128&height=128")
    assert res_slp.status_code == 200
    assert res_slp.headers["content-type"] == "image/png"
    assert len(res_slp.content) > 100

def test_api_profile():
    # Transect across Site01 Connecting Ridge
    res = client.get(
        "/api/terrain/profile?start_lat=-89.5&start_lon=-137.0&end_lat=-89.4&end_lon=-138.0&num_samples=25"
    )
    assert res.status_code == 200
    data = res.json()
    assert data["sample_count"] == 25
    assert data["total_distance_m"] > 0
    assert len(data["samples"]) == 25
    assert "elevation_m" in data["samples"][0]
    assert "distance_m" in data["samples"][0]

def test_api_quality():
    res = client.get("/api/terrain/site01/quality")
    assert res.status_code == 200
    data = res.json()
    assert data["dataset_id"] == "site01"
    assert "reference_frame" in data
    assert "grid_spacing_m" in data


