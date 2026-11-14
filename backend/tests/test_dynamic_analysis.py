"""
Automated Validation Suite for LUNAVISTA Dynamic Lunar Terrain Analysis System.
Covers Parts 1, 3, 4, 5, 6, 7, 10, and 13.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.dataset_catalogue import catalogue_service
from app.services.dataset_discovery import discovery_engine
from app.services.raster_window import raster_window_service
from app.services.slope_service import slope_service
from app.services.hillshade_service import hillshade_service
import numpy as np

client = TestClient(app)

def test_catalogue_registry_and_citations():
    """Validates that all official NASA datasets are registered with valid citations."""
    datasets = catalogue_service.list_all()
    assert len(datasets) >= 6
    ids = [d.dataset_id for d in datasets]
    assert "site01" in ids
    assert "site04" in ids
    assert "site11" in ids
    assert "site23" in ids
    assert "spole_87s_5mpp" in ids
    assert "spole_80s_20mpp" in ids

    # Check Barker citations
    s01 = catalogue_service.get_by_id("site01")
    assert "Barker, M. K." in s01.citation
    assert "DE421" in s01.reference_frame
    assert s01.nominal_pixel_spacing_m == 5.0

def test_discovery_test_a_connecting_ridge():
    """TEST A: Site01 Connecting Ridge discovery."""
    payload = {
        "min_latitude": -89.7,
        "max_latitude": -89.2,
        "min_longitude": -160.0,
        "max_longitude": -120.0,
    }
    res = client.post("/api/datasets/discover", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["selected_region_area_km2"] > 0
    assert data["best_resolution_candidate"] is not None
    # Best resolution must be 5m site01 or 5m spole
    assert data["best_resolution_candidate"]["dataset"]["nominal_pixel_spacing_m"] == 5.0

def test_discovery_test_b_shackleton_rim():
    """TEST B: Shackleton Rim (Site04) candidate discovery."""
    payload = {
        "min_latitude": -89.95,
        "max_latitude": -89.60,
        "min_longitude": -50.0,
        "max_longitude": 50.0,
    }
    res = client.post("/api/datasets/discover", json=payload)
    assert res.status_code == 200
    data = res.json()
    candidate_ids = [c["dataset"]["dataset_id"] for c in data["all_candidates"]]
    assert "site04" in candidate_ids or "spole_87s_5mpp" in candidate_ids

def test_discovery_test_c_broad_area_80_90s():
    """TEST C: Region extending north to 82°S covered by Product 90 (20m)."""
    payload = {
        "min_latitude": -84.0,
        "max_latitude": -81.5,
        "min_longitude": 0.0,
        "max_longitude": 30.0,
    }
    res = client.post("/api/datasets/discover", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["best_coverage_candidate"]["dataset"]["dataset_id"] == "spole_80s_20mpp"
    assert data["best_coverage_candidate"]["dataset"]["nominal_pixel_spacing_m"] == 20.0

def test_discovery_test_d_partial_and_gaps():
    """TEST D: Region with partial high-res coverage triggering coverage gap disclosure."""
    payload = {
        "min_latitude": -89.5,
        "max_latitude": -87.5,
        "min_longitude": -150.0,
        "max_longitude": -100.0,
    }
    res = client.post("/api/datasets/discover", json=payload)
    assert res.status_code == 200
    data = res.json()
    # High-res site01 covers only part of this larger region
    site01_cand = next((c for c in data["all_candidates"] if c["dataset"]["dataset_id"] == "site01"), None)
    if site01_cand:
        assert site01_cand["coverage_percentage"] < 100.0
        assert not site01_cand["overlaps_completely"]

def test_regional_elevation_map_png():
    """Validates PNG generation for regional elevation maps with multiple colormaps."""
    for cmap in ["hypsometric", "turbo", "viridis"]:
        payload = {
            "dataset_id": "site01",
            "bounding_box": {
                "min_latitude": -89.6,
                "max_latitude": -89.3,
                "min_longitude": -150.0,
                "max_longitude": -120.0,
            },
            "output_width": 128,
            "output_height": 128,
            "colormap_name": cmap,
        }
        res = client.post("/api/regional/elevation-map.png", json=payload)
        assert res.status_code == 200
        assert res.headers["content-type"] == "image/png"
        assert len(res.content) > 1000

def test_regional_slope_map_png():
    """Validates classified 7-tier slope map PNG generation."""
    payload = {
        "dataset_id": "site01",
        "bounding_box": {
            "min_latitude": -89.6,
            "max_latitude": -89.3,
            "min_longitude": -150.0,
            "max_longitude": -120.0,
        },
        "output_width": 128,
        "output_height": 128,
        "classified": True,
    }
    res = client.post("/api/regional/slope-map.png", json=payload)
    assert res.status_code == 200
    assert res.headers["content-type"] == "image/png"
    assert len(res.content) > 1000

def test_regional_hillshade_png():
    """Validates cartographic hillshade generation with user-defined solar angles."""
    payload = {
        "dataset_id": "site01",
        "bounding_box": {
            "min_latitude": -89.6,
            "max_latitude": -89.3,
            "min_longitude": -150.0,
            "max_longitude": -120.0,
        },
        "output_width": 128,
        "output_height": 128,
        "azimuth_deg": 315.0,
        "altitude_deg": 45.0,
        "z_factor": 1.5,
    }
    res = client.post("/api/regional/hillshade.png", json=payload)
    assert res.status_code == 200
    assert res.headers["content-type"] == "image/png"
    assert len(res.content) > 1000

def test_regional_statistics():
    """Validates physical statistics and lunar area calculations."""
    res = client.post(
        "/api/regional/statistics?dataset_id=site01&min_lat=-89.6&max_lat=-89.3&min_lon=-150.0&max_lon=-120.0"
    )
    assert res.status_code == 200
    data = res.json()
    assert data["valid_pixels"] > 0
    assert data["total_area_km2"] > 0
    assert data["elevation_min_m"] is not None
    assert data["elevation_max_m"] is not None
    assert data["elevation_range_m"] > 0
    assert "0° – 5°: Safe Landing (Low Tilt Risk)" in data["slope_distribution_percentage"]

def test_profile_transect_and_csv_export():
    """Validates transect sampling, relief, elevation gain/loss, and CSV export."""
    payload = {
        "dataset_id": "site01",
        "start_latitude": -89.6,
        "start_longitude": -140.0,
        "end_latitude": -89.3,
        "end_longitude": -135.0,
        "num_samples": 40,
    }
    res = client.post("/api/regional/profile", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["sample_count"] == 40
    assert data["total_distance_km"] > 0
    assert data["elevation_gain_m"] is not None
    assert data["elevation_loss_m"] is not None
    assert data["total_relief_m"] > 0

    # Test CSV export
    res_csv = client.post("/api/exports/profile-csv", json=payload)
    assert res_csv.status_code == 200
    assert res_csv.headers["content-type"] == "text/csv; charset=utf-8"
    assert "distance_km,latitude,longitude" in res_csv.text

def test_point_inspection():
    """Validates point inspection inside and outside data coverage."""
    # Inside Site01
    res = client.get("/api/regional/inspect?lat=-89.4632&lon=-137.4896&dataset_id=site01")
    assert res.status_code == 200
    data = res.json()
    assert data["in_bounds"] is True
    assert data["elevation_m"] is not None

    # Outside Site01 (e.g. Equator)
    res_out = client.get("/api/regional/inspect?lat=0.0&lon=0.0&dataset_id=site01")
    assert res_out.status_code == 200
    data_out = res_out.json()
    assert data_out["in_bounds"] is False
    assert data_out["quality_status"] == "out_of_bounds"
    assert data_out["elevation_m"] is None

def test_clipped_geotiff_export():
    """Validates scientific clipped GeoTIFF export containing real Float32 data."""
    res = client.get(
        "/api/exports/geotiff?dataset_id=site01&min_lat=-89.6&max_lat=-89.3&min_lon=-150.0&max_lon=-120.0"
    )
    assert res.status_code == 200
    assert res.headers["content-type"] == "image/tiff"
    assert len(res.content) > 5000
