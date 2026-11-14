import pytest
import json
import threading
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
    MissionProfileUpdateRequest,
)
from app.services.mission_profile_service import MissionProfileService, TEMPLATE_PROFILES

client = TestClient(app)

def test_initial_templates_exist():
    """Verifies that all 4 built-in starter templates are loaded and correctly categorized."""
    resp = client.get("/api/profiles/")
    assert resp.status_code == 200
    profiles = resp.json()
    assert len(profiles) >= 4

    types_found = set(p["mission_type"] for p in profiles)
    assert "robotic_exploration" in types_found
    assert "robotic_lander" in types_found
    assert "crewed_surface" in types_found
    assert "long_duration_station" in types_found

    # Verify templates are labeled as illustrative defaults
    for p in profiles:
        if p["is_template"]:
            assert "Illustrative" in p["name"] or "Template" in p["name"]

def test_profile_crud_lifecycle(tmp_path):
    """Full lifecycle: Create, Read, Update, Duplicate, Delete."""
    test_storage = tmp_path / "crud_profiles.json"
    svc = MissionProfileService(storage_path=test_storage)

    # 1. Create
    req = MissionProfileCreateRequest(
        name="Artemis VII Habitat Site",
        description="Candidate long-duration habitat evaluation.",
        mission_type=MissionType.CREWED_SURFACE,
        duration_days=10.0,
        start_timestamp_iso="2026-10-04T12:00:00Z",
        end_timestamp_iso="2026-10-14T12:00:00Z",
        observer_height_m=2.0,
    )
    created = svc.create_profile(req)
    assert created.id.startswith("profile-")
    assert created.version == 1
    assert created.name == "Artemis VII Habitat Site"
    assert created.is_template is False

    # 2. Read
    fetched = svc.get_profile(created.id)
    assert fetched is not None
    assert fetched.id == created.id

    # 3. Update
    up_req = MissionProfileUpdateRequest(
        name="Artemis VII Habitat Site - Revised",
        observer_height_m=3.0,
    )
    updated = svc.update_profile(created.id, up_req)
    assert updated.name == "Artemis VII Habitat Site - Revised"
    assert updated.observer_height_m == 3.0
    assert updated.version == 2

    # 4. Duplicate
    duplicated = svc.duplicate_profile(created.id)
    assert duplicated.id != created.id
    assert "(Copy)" in duplicated.name
    assert duplicated.version == 1

    # 5. Delete
    assert svc.delete_profile(created.id) is True
    assert svc.get_profile(created.id) is None
    with pytest.raises(KeyError):
        svc.delete_profile(created.id)

def test_persistence_across_instances(tmp_path):
    """Ensures created profiles survive service recreation from disk."""
    test_storage = tmp_path / "persist_profiles.json"
    svc1 = MissionProfileService(storage_path=test_storage)

    req = MissionProfileCreateRequest(
        name="Persistent Lunar Rover",
        mission_type=MissionType.ROBOTIC_EXPLORATION,
        duration_days=5.0,
        start_timestamp_iso="2026-10-04T12:00:00Z",
        end_timestamp_iso="2026-10-09T12:00:00Z",
        observer_height_m=1.8,
    )
    created = svc1.create_profile(req)
    pid = created.id

    # Create new service instance pointing to the same storage
    svc2 = MissionProfileService(storage_path=test_storage)
    reloaded = svc2.get_profile(pid)
    assert reloaded is not None
    assert reloaded.name == "Persistent Lunar Rover"
    assert reloaded.observer_height_m == 1.8

def test_validation_invalid_mission_duration():
    """Tests duration boundaries: < 1 hour and > 90 days."""
    # Under 1 hour (0.01 days)
    req_too_short = {
        "name": "Sub-hour Test",
        "duration_days": 0.01,
        "start_timestamp_iso": "2026-10-04T12:00:00Z",
        "end_timestamp_iso": "2026-10-04T12:10:00Z",
        "observer_height_m": 2.0,
    }
    resp = client.post("/api/profiles/validate", json=req_too_short)
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_valid"] is False
    assert any("at least 1 hour" in e["message"] for e in data["errors"])

    # Over 90 days (100 days)
    req_too_long = {
        "name": "Multi-year Test",
        "duration_days": 100.0,
        "start_timestamp_iso": "2026-10-04T12:00:00Z",
        "end_timestamp_iso": "2027-01-12T12:00:00Z",
        "observer_height_m": 2.0,
    }
    resp2 = client.post("/api/profiles/validate", json=req_too_long)
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["is_valid"] is False
    assert any("90 days" in e["message"] for e in data2["errors"])

def test_validation_contradictory_requirements():
    """Tests detection of contradictory or physically impossible thresholds."""
    # Contradiction 1: Required sunlight exceeds total duration
    req_impossible_sun = {
        "name": "Impossible Sun",
        "duration_days": 2.0,  # 48 hours total
        "start_timestamp_iso": "2026-10-04T12:00:00Z",
        "end_timestamp_iso": "2026-10-06T12:00:00Z",
        "observer_height_m": 2.0,
        "requirements": {
            "solar": {
                "min_total_sunlight_hours": {
                    "id": "min_total_sunlight_hours",
                    "name": "Minimum Total Sunlight",
                    "classification": "HARD_CONSTRAINT",
                    "enabled": True,
                    "value": 60.0,  # > 48.0 h!
                    "unit": "hours",
                    "operator": "ge",
                }
            }
        }
    }
    resp = client.post("/api/profiles/validate", json=req_impossible_sun)
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_valid"] is False
    assert any("exceeds the total mission duration" in e["message"] for e in data["errors"])

    # Contradiction 2: Min elevation > Max elevation
    req_inv_elevation = {
        "name": "Inverted Elevation",
        "duration_days": 2.0,
        "start_timestamp_iso": "2026-10-04T12:00:00Z",
        "end_timestamp_iso": "2026-10-06T12:00:00Z",
        "observer_height_m": 2.0,
        "requirements": {
            "terrain": {
                "min_elevation_m": {
                    "id": "min_elevation_m",
                    "name": "Min Elevation",
                    "classification": "INFORMATIONAL_METRIC",
                    "enabled": True,
                    "value": 2000.0,
                    "unit": "m",
                    "operator": "ge",
                },
                "max_elevation_m": {
                    "id": "max_elevation_m",
                    "name": "Max Elevation",
                    "classification": "INFORMATIONAL_METRIC",
                    "enabled": True,
                    "value": 500.0,  # Min > Max
                    "unit": "m",
                    "operator": "le",
                }
            }
        }
    }
    resp_el = client.post("/api/profiles/validate", json=req_inv_elevation)
    assert resp_el.status_code == 200
    data_el = resp_el.json()
    assert data_el["is_valid"] is False
    assert any("cannot exceed maximum elevation" in e["message"] for e in data_el["errors"])

    # Contradiction 3: Required full sunlight exceeds total mission duration
    req_full_exceeds_mission = {
        "name": "Full Exceeds Mission Horizon",
        "duration_days": 2.0,  # 48 hours
        "start_timestamp_iso": "2026-10-04T12:00:00Z",
        "end_timestamp_iso": "2026-10-06T12:00:00Z",
        "observer_height_m": 2.0,
        "requirements": {
            "solar": {
                "min_full_sunlight_hours": {
                    "id": "min_full_sunlight_hours",
                    "name": "Min Full Sunlight",
                    "classification": "HARD_CONSTRAINT",
                    "enabled": True,
                    "value": 55.0,  # > 48.0 h!
                    "unit": "hours",
                    "operator": "ge",
                }
            }
        }
    }
    resp_full = client.post("/api/profiles/validate", json=req_full_exceeds_mission)
    assert resp_full.status_code == 200
    data_full = resp_full.json()
    assert data_full["is_valid"] is False
    assert any("exceeds the total mission duration" in e["message"] for e in data_full["errors"])

def test_validation_invalid_units_and_missing_fields():
    """Rejects invalid physical units and empty required fields."""
    req_bad_unit = {
        "name": "Bad Unit",
        "duration_days": 2.0,
        "start_timestamp_iso": "2026-10-04T12:00:00Z",
        "end_timestamp_iso": "2026-10-06T12:00:00Z",
        "observer_height_m": 2.0,
        "requirements": {
            "solar": {
                "min_total_sunlight_hours": {
                    "id": "min_total_sunlight_hours",
                    "name": "Min Total Sunlight",
                    "classification": "HARD_CONSTRAINT",
                    "enabled": True,
                    "value": 20.0,
                    "unit": "seconds",  # invalid unit
                    "operator": "ge",
                }
            }
        }
    }
    resp = client.post("/api/profiles/validate", json=req_bad_unit)
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_valid"] is False
    assert any("Expected 'hours'" in e["message"] for e in data["errors"])

    # Empty name
    req_no_name = {
        "name": " ",
        "duration_days": 2.0,
        "start_timestamp_iso": "2026-10-04T12:00:00Z",
        "end_timestamp_iso": "2026-10-06T12:00:00Z",
        "observer_height_m": 2.0,
    }
    resp_noname = client.post("/api/profiles/validate", json=req_no_name)
    assert resp_noname.status_code == 200
    data_noname = resp_noname.json()
    assert data_noname["is_valid"] is False
    assert any("at least 2 characters" in e["message"] for e in data_noname["errors"])

def test_hard_soft_informational_classifications():
    """Verifies that all three classification categories are preserved and distinct."""
    req = {
        "name": "Tri-Category Mission",
        "duration_days": 7.0,
        "start_timestamp_iso": "2026-10-04T12:00:00Z",
        "end_timestamp_iso": "2026-10-11T12:00:00Z",
        "observer_height_m": 2.0,
        "requirements": {
            "solar": {
                "min_total_sunlight_hours": {
                    "id": "min_total_sunlight_hours",
                    "name": "Sunlight Hard",
                    "classification": "HARD_CONSTRAINT",
                    "enabled": True,
                    "value": 50.0,
                    "unit": "hours",
                    "operator": "ge",
                },
                "min_sunlight_percentage": {
                    "id": "min_sunlight_percentage",
                    "name": "Sunlight Soft",
                    "classification": "SOFT_PREFERENCE",
                    "enabled": True,
                    "value": 60.0,
                    "unit": "%",
                    "operator": "ge",
                }
            },
            "terrain": {
                "min_elevation_m": {
                    "id": "min_elevation_m",
                    "name": "Elevation Informational",
                    "classification": "INFORMATIONAL_METRIC",
                    "enabled": True,
                    "value": 1000.0,
                    "unit": "m",
                    "operator": "ge",
                }
            }
        }
    }
    resp = client.post("/api/profiles/", json=req)
    assert resp.status_code == 201
    created = resp.json()

    sol = created["requirements"]["solar"]
    assert sol["min_total_sunlight_hours"]["classification"] == "HARD_CONSTRAINT"
    assert sol["min_sunlight_percentage"]["classification"] == "SOFT_PREFERENCE"

    trn = created["requirements"]["terrain"]
    assert trn["min_elevation_m"]["classification"] == "INFORMATIONAL_METRIC"

    # Cleanup
    client.delete(f"/api/profiles/{created['id']}")

def test_persistence_corrupted_storage_recovery(tmp_path):
    """Tests quarantine of malformed storage files to .corrupt.bak and safe recovery."""
    test_storage = tmp_path / "corrupt_test.json"
    test_storage.write_text("{ unparseable broken json content !!!")

    svc = MissionProfileService(storage_path=test_storage)
    # Service must not crash, should re-initialize with templates
    assert len(svc.list_profiles()) >= 4
    # Corrupted backup must exist
    bak = test_storage.with_suffix(".corrupt.bak")
    assert bak.exists()
    assert "{ unparseable broken json" in bak.read_text()

def test_concurrent_profile_mutations(tmp_path):
    """Verifies thread-safety under concurrent creations and unique ID assignments."""
    test_storage = tmp_path / "concurrent_profiles.json"
    svc = MissionProfileService(storage_path=test_storage)

    def worker(idx):
        req = MissionProfileCreateRequest(
            name=f"Concurrent Rover {idx}",
            mission_type=MissionType.ROBOTIC_EXPLORATION,
            duration_days=3.0,
            start_timestamp_iso="2026-10-04T12:00:00Z",
            end_timestamp_iso="2026-10-07T12:00:00Z",
            observer_height_m=1.5,
        )
        return svc.create_profile(req)

    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = [executor.submit(worker, i) for i in range(16)]
        results = [f.result() for f in futures]

    assert len(results) == 16
    unique_ids = set(r.id for r in results)
    assert len(unique_ids) == 16  # No collision

    # Verify atomic file integrity on disk
    with open(test_storage, "r") as f:
        data = json.load(f)
    assert len(data) >= 20  # 4 initial templates + 16 concurrent profiles

# ==============================================================================
# MVP 7.1.1 REGRESSION TESTS: Requirement Validation & Semantics
# ==============================================================================

def test_min_full_sunlight_greater_than_total_sunlight_is_valid():
    """
    Verifies that requiring higher minimum full sunlight than minimum total sunlight
    is logically feasible and NOT rejected.
    Full sunlight is a geometric subset of total sunlight: satisfying the stricter
    full-sunlight requirement automatically satisfies the total-sunlight requirement.
    """
    req = {
        "name": "Subset Feasibility Test (Full > Total)",
        "duration_days": 4.0,  # 96 hours total
        "start_timestamp_iso": "2026-10-04T12:00:00Z",
        "end_timestamp_iso": "2026-10-08T12:00:00Z",
        "observer_height_m": 2.0,
        "requirements": {
            "solar": {
                "min_total_sunlight_hours": {
                    "id": "min_total_sunlight_hours",
                    "name": "Min Total Sunlight",
                    "classification": "HARD_CONSTRAINT",
                    "enabled": True,
                    "value": 40.0,
                    "unit": "hours",
                    "operator": "ge",
                },
                "min_full_sunlight_hours": {
                    "id": "min_full_sunlight_hours",
                    "name": "Min Full Sunlight",
                    "classification": "SOFT_PREFERENCE",
                    "enabled": True,
                    "value": 50.0,  # 50.0 > 40.0, both <= 96.0 h: completely feasible!
                    "unit": "hours",
                    "operator": "ge",
                }
            }
        }
    }
    resp = client.post("/api/profiles/validate", json=req)
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_valid"] is True, f"Expected valid, got errors: {data['errors']}"
    assert len(data["errors"]) == 0
    # Must emit an informative note about the subset relationship
    assert any("geometric subset" in info["message"] for info in data["info_notes"])

def test_min_full_sunlight_lower_than_total_sunlight_is_valid():
    """Verifies that traditional full < total sunlight configuration is also valid."""
    req = {
        "name": "Subset Feasibility Test (Full < Total)",
        "duration_days": 4.0,  # 96 hours
        "start_timestamp_iso": "2026-10-04T12:00:00Z",
        "end_timestamp_iso": "2026-10-08T12:00:00Z",
        "observer_height_m": 2.0,
        "requirements": {
            "solar": {
                "min_total_sunlight_hours": {
                    "id": "min_total_sunlight_hours",
                    "name": "Min Total Sunlight",
                    "classification": "HARD_CONSTRAINT",
                    "enabled": True,
                    "value": 60.0,
                    "unit": "hours",
                    "operator": "ge",
                },
                "min_full_sunlight_hours": {
                    "id": "min_full_sunlight_hours",
                    "name": "Min Full Sunlight",
                    "classification": "SOFT_PREFERENCE",
                    "enabled": True,
                    "value": 30.0,
                    "unit": "hours",
                    "operator": "ge",
                }
            }
        }
    }
    resp = client.post("/api/profiles/validate", json=req)
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_valid"] is True
    assert len(data["errors"]) == 0

def test_daily_sunlight_requirements_valid_and_invalid():
    """
    Tests validation of daily solar requirements.
    Daily sunlight is indexed to a standard 24.0-hour Earth operational day.
    Cannot exceed 24.0 hours/day or be negative.
    """
    # 1. Valid daily sunlight (12.0 hours/day)
    req_valid_daily = {
        "name": "Valid Daily Sun",
        "duration_days": 3.0,
        "start_timestamp_iso": "2026-10-04T12:00:00Z",
        "end_timestamp_iso": "2026-10-07T12:00:00Z",
        "observer_height_m": 2.0,
        "requirements": {
            "solar": {
                "min_daily_sunlight_hours": {
                    "id": "min_daily_sunlight_hours",
                    "name": "Min Daily Sunlight",
                    "classification": "SOFT_PREFERENCE",
                    "enabled": True,
                    "value": 12.0,
                    "unit": "hours/day",
                    "operator": "ge",
                }
            }
        }
    }
    resp1 = client.post("/api/profiles/validate", json=req_valid_daily)
    assert resp1.status_code == 200
    assert resp1.json()["is_valid"] is True

    # 2. Invalid daily sunlight (> 24.0 hours/day)
    req_invalid_daily = {
        "name": "Impossible Daily Sun",
        "duration_days": 3.0,
        "start_timestamp_iso": "2026-10-04T12:00:00Z",
        "end_timestamp_iso": "2026-10-07T12:00:00Z",
        "observer_height_m": 2.0,
        "requirements": {
            "solar": {
                "min_daily_sunlight_hours": {
                    "id": "min_daily_sunlight_hours",
                    "name": "Min Daily Sunlight",
                    "classification": "SOFT_PREFERENCE",
                    "enabled": True,
                    "value": 25.0,  # Impossible in a 24-hour day
                    "unit": "hours/day",
                    "operator": "ge",
                }
            }
        }
    }
    resp2 = client.post("/api/profiles/validate", json=req_invalid_daily)
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["is_valid"] is False
    assert any("cannot exceed 24.0 hours" in e["message"] for e in data2["errors"])

    # 3. Invalid daily Earth visibility (> 24.0 hours/day)
    req_invalid_daily_earth = {
        "name": "Impossible Daily Earth",
        "duration_days": 3.0,
        "start_timestamp_iso": "2026-10-04T12:00:00Z",
        "end_timestamp_iso": "2026-10-07T12:00:00Z",
        "observer_height_m": 2.0,
        "requirements": {
            "earth": {
                "min_daily_earth_visible_hours": {
                    "id": "min_daily_earth_visible_hours",
                    "name": "Min Daily Earth",
                    "classification": "SOFT_PREFERENCE",
                    "enabled": True,
                    "value": 26.0,
                    "unit": "hours/day",
                    "operator": "ge",
                }
            }
        }
    }
    resp3 = client.post("/api/profiles/validate", json=req_invalid_daily_earth)
    assert resp3.status_code == 200
    data3 = resp3.json()
    assert data3["is_valid"] is False
    assert any("cannot exceed 24.0 hours" in e["message"] for e in data3["errors"])

def test_actual_contradictory_lower_and_upper_bounds():
    """
    Verifies that genuine contradictions between lower and upper bounds are correctly detected:
    - Min surface elevation > Max surface elevation on the same location.
    - Required cumulative hours > total mission duration.
    """
    # 1. Elevation lower bound > upper bound
    req_elev_contradiction = {
        "name": "Contradictory Elevation Bounds",
        "duration_days": 2.0,
        "start_timestamp_iso": "2026-10-04T12:00:00Z",
        "end_timestamp_iso": "2026-10-06T12:00:00Z",
        "observer_height_m": 2.0,
        "requirements": {
            "terrain": {
                "min_elevation_m": {
                    "id": "min_elevation_m",
                    "name": "Min Elevation",
                    "classification": "HARD_CONSTRAINT",
                    "enabled": True,
                    "value": 1500.0,
                    "unit": "m",
                    "operator": "ge",
                },
                "max_elevation_m": {
                    "id": "max_elevation_m",
                    "name": "Max Elevation",
                    "classification": "HARD_CONSTRAINT",
                    "enabled": True,
                    "value": 1000.0,  # Lower bound > upper bound!
                    "unit": "m",
                    "operator": "le",
                }
            }
        }
    }
    resp1 = client.post("/api/profiles/validate", json=req_elev_contradiction)
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert data1["is_valid"] is False
    assert any("Lower bound exceeds upper bound" in e["message"] for e in data1["errors"])

    # 2. Cumulative Earth visibility > total mission duration
    req_earth_exceeds = {
        "name": "Earth Exceeds Mission Window",
        "duration_days": 2.0,  # 48 hours
        "start_timestamp_iso": "2026-10-04T12:00:00Z",
        "end_timestamp_iso": "2026-10-06T12:00:00Z",
        "observer_height_m": 2.0,
        "requirements": {
            "earth": {
                "min_total_earth_visible_hours": {
                    "id": "min_total_earth_visible_hours",
                    "name": "Total Earth",
                    "classification": "HARD_CONSTRAINT",
                    "enabled": True,
                    "value": 60.0,  # > 48.0 h
                    "unit": "hours",
                    "operator": "ge",
                }
            }
        }
    }
    resp2 = client.post("/api/profiles/validate", json=req_earth_exceeds)
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["is_valid"] is False
    assert any("exceeds mission duration" in e["message"] for e in data2["errors"])

def test_soft_preferences_preserved_without_automatic_scoring():
    """
    Verifies that soft preferences are stored, validated, and classified distinctly
    without arbitrary hidden scoring, weighting, or ranking injected into the profile.
    """
    req = {
        "name": "Soft Preference Semantics Test",
        "duration_days": 5.0,
        "start_timestamp_iso": "2026-10-04T12:00:00Z",
        "end_timestamp_iso": "2026-10-09T12:00:00Z",
        "observer_height_m": 2.0,
        "requirements": {
            "solar": {
                "min_sunlight_percentage": {
                    "id": "min_sunlight_percentage",
                    "name": "Sunlight Soft Preference",
                    "classification": "SOFT_PREFERENCE",
                    "enabled": True,
                    "value": 70.0,
                    "unit": "%",
                    "operator": "ge",
                },
                "max_continuous_darkness_hours": {
                    "id": "max_continuous_darkness_hours",
                    "name": "Darkness Soft Preference",
                    "classification": "SOFT_PREFERENCE",
                    "enabled": True,
                    "value": 36.0,
                    "unit": "hours",
                    "operator": "le",
                }
            }
        }
    }
    resp = client.post("/api/profiles/", json=req)
    assert resp.status_code == 201
    created = resp.json()

    # Classification must remain strictly SOFT_PREFERENCE
    sol = created["requirements"]["solar"]
    assert sol["min_sunlight_percentage"]["classification"] == "SOFT_PREFERENCE"
    assert sol["max_continuous_darkness_hours"]["classification"] == "SOFT_PREFERENCE"

    # Profile must not have hidden scoring weights or synthesized ranking points
    assert "score" not in created
    assert "ranking_weight" not in created["requirements"]["solar"]["min_sunlight_percentage"]

    # Cleanup
    client.delete(f"/api/profiles/{created['id']}")

def test_mission_duration_terminology():
    """
    Verifies that starter templates clearly distinguish user-selected duration,
    analysis window, and operational period from astronomical cycle lengths.
    """
    resp = client.get("/api/profiles/")
    assert resp.status_code == 200
    profiles = resp.json()

    tpls = {p["id"]: p for p in profiles if p.get("is_template")}
    assert len(tpls) >= 4

    rover = tpls["template-robotic-rover"]
    assert "analysis window" in rover["description"]
    assert "synodic" in rover["description"]

    lander = tpls["template-robotic-lander"]
    assert "operational period" in lander["description"]

    crewed = tpls["template-crewed-surface"]
    assert "sortie" in crewed["description"]

    station = tpls["template-long-duration-station"]
    assert "analysis window" in station["description"]
    assert "synodic" in station["description"]
