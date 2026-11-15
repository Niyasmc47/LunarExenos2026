import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.dem_loader import get_dem_loader, list_available_sites
from app.services.dataset_catalogue import catalogue_service
from app.services.coordinate_transform import transformer

client = TestClient(app)

def test_available_sites():
    sites = list_available_sites()
    assert "site01" in sites
    assert "site04" in sites
    assert "site11" in sites

def test_metadata_for_all_three_sites():
    for sid in ["site01", "site04", "site11"]:
        loader = get_dem_loader(sid)
        assert loader.is_available()
        meta = loader.get_metadata()
        assert meta.dataset_id == sid
        assert meta.pixel_spacing_m == 5.0
        assert meta.dimensions["width"] == 3200
        assert meta.dimensions["height"] == 3200
        assert meta.elevation_stats.range_m > 1000.0

def test_authentic_elevation_and_slope_samples():
    # Site 01: Connecting Ridge Crest
    s01 = get_dem_loader("site01").sample_point(-89.4632, -137.4896)
    assert s01["in_bounds"] is True
    assert s01["elevation_m"] > 1800.0
    assert s01["slope_deg"] is not None

    # Site 04: Shackleton Rim Peak (ROI #1)
    s04 = get_dem_loader("site04").sample_point(-89.76142, -157.11557)
    assert s04["in_bounds"] is True
    assert s04["elevation_m"] > 1600.0
    assert s04["slope_deg"] is not None

    # Site 11: de Gerlache Rim Crest (ROI #1)
    s11 = get_dem_loader("site11").sample_point(-88.66821, -68.38199)
    assert s11["in_bounds"] is True
    assert s11["elevation_m"] > 1700.0
    assert s11["slope_deg"] is not None

def test_auto_routing_by_coordinates():
    # Calling default dem_loader without site_id on Shackleton coordinates auto-routes to site04
    sample_shackleton = get_dem_loader("site01").sample_point(-89.76142, -157.11557)
    assert sample_shackleton["in_bounds"] is True
    assert sample_shackleton["site_id"] == "site04"

    # Calling default dem_loader on de Gerlache coordinates auto-routes to site11
    sample_de_gerlache = get_dem_loader("site01").sample_point(-88.66821, -68.38199)
    assert sample_de_gerlache["in_bounds"] is True
    assert sample_de_gerlache["site_id"] == "site11"

def test_api_datasets_endpoint():
    resp = client.get("/api/terrain/datasets")
    assert resp.status_code == 200
    datasets = resp.json()["datasets"]
    ids = [d["id"] for d in datasets]
    assert "site01" in ids
    assert "site04" in ids
    assert "site11" in ids

def test_api_site_mesh_endpoints():
    for sid in ["site01", "site04", "site11"]:
        resp = client.get(f"/api/terrain/{sid}/mesh?lod=low")
        assert resp.status_code == 200
        data = resp.json()
        assert data["site_id"] == sid
        assert len(data["positions"]) > 0

def test_cross_site_candidate_scenarios():
    resp = client.get("/api/scenarios")
    assert resp.status_code == 200
    scenarios = resp.json()
    sites_represented = {s["site_id"] for s in scenarios}
    assert "site01" in sites_represented
    assert "site04" in sites_represented
    assert "site11" in sites_represented
