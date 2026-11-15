import math
import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.services.visibility_service import visibility_service
from app.services.screening_service import CandidateScreeningService
from app.schemas.visibility import VisibilityAnalysisRequest
from app.schemas.screening import ScreeningVerdict, OverallCandidateStatus
from app.schemas.mission_profile import SingleRequirement, RequirementClassification

client = TestClient(app)

def test_exact_72h_interval_accounting_and_no_endpoint_double_counting():
    """
    Verifies that for an exact 72-hour analysis interval (2026-10-02 12:00 to 2026-10-05 12:00 UTC):
    - Total duration is exactly 72.0 hours.
    - Full + partial + darkness == 72.0 hours.
    - Earth full + partial + blackout == 72.0 hours.
    - Both + sun_only + earth_only + neither == 72.0 hours.
    - No duration metric exceeds 72.0 hours.
    - Analysis step does not add extra duration.
    """
    req_2h = VisibilityAnalysisRequest(
        latitude=-89.4632,
        longitude=-137.4896,
        start_timestamp_iso="2026-10-02T12:00:00Z",
        end_timestamp_iso="2026-10-05T12:00:00Z",
        step_interval_hours=2.0,
        observer_height_m=2.0,
        dataset_id="site01",
        azimuth_resolution_deg=2.0,
    )
    resp_2h = visibility_service.compute_visibility_analysis(req_2h)

    # 72 hours / 2 hours = 36 intervals -> 37 epochs
    assert resp_2h.total_epochs_computed == 37
    assert len(resp_2h.series) == 37

    sm = resp_2h.solar_metrics
    em = resp_2h.earth_metrics
    cm = resp_2h.combined_metrics

    # Solar duration equality
    assert math.isclose(sm.total_sun_full_hours + sm.total_sun_partial_hours + sm.total_darkness_hours, 72.0, abs_tol=0.05)
    assert sm.total_sun_visible_hours == round(sm.total_sun_full_hours + sm.total_sun_partial_hours, 2)
    assert sm.total_sun_visible_hours <= 72.0
    assert sm.total_darkness_hours <= 72.0
    assert sm.longest_darkness_hours <= 72.0
    assert sm.longest_illumination_hours <= 72.0

    # Earth duration equality
    assert math.isclose(em.total_earth_full_hours + em.total_earth_partial_hours + em.total_earth_blackout_hours, 72.0, abs_tol=0.05)
    assert em.total_earth_visible_hours == round(em.total_earth_full_hours + em.total_earth_partial_hours, 2)
    assert em.total_earth_visible_hours <= 72.0
    assert em.total_earth_blackout_hours <= 72.0
    assert em.longest_earth_blackout_hours <= 72.0
    assert em.longest_earth_visible_hours <= 72.0

    # Combined partition equality
    assert math.isclose(cm.both_visible_hours + cm.sun_only_hours + cm.earth_only_hours + cm.neither_visible_hours, 72.0, abs_tol=0.05)
    assert cm.total_interval_hours == 72.0
    assert cm.longest_both_visible_hours <= 72.0
    assert cm.longest_neither_visible_hours <= 72.0

def test_scope_mismatch_detection_and_150h_requirement():
    """
    Verifies that a 150-hour sunlight requirement from a 14-day profile:
    - Is NOT evaluated as an achievable requirement within a 72-hour window.
    - Receives ScreeningVerdict.NOT_EVALUABLE_SCOPE_MISMATCH.
    - Does NOT count as a scientific candidate failure (hard_failed == 0).
    - Results in OverallCandidateStatus.INDETERMINATE, never NON_COMPLIANT.
    """
    # Create profile with 14.0 days duration and 150.0 hours sunlight requirement
    p_req = {
        "name": "14-Day Long Duration Rover Profile",
        "description": "Tests scope mismatch handling when evaluated against 72h scenario",
        "mission_type": "robotic_exploration",
        "duration_days": 14.0,
        "start_timestamp_iso": "2026-10-04T12:00:00Z",
        "end_timestamp_iso": "2026-10-18T12:00:00Z",
        "observer_height_m": 2.0,
        "requirements": {
            "solar": {
                "min_total_sunlight_hours": {
                    "id": "min_total_sunlight_hours",
                    "name": "Minimum Total Geometric Sunlight Duration",
                    "classification": "HARD_CONSTRAINT",
                    "enabled": True,
                    "value": 150.0,
                    "unit": "hours",
                    "operator": "ge",
                    "description": "Mission-wide sunlight hours across 14-day mission",
                },
                "max_continuous_darkness_hours": {
                    "id": "max_continuous_darkness_hours",
                    "name": "Maximum Continuous Darkness Duration",
                    "classification": "HARD_CONSTRAINT",
                    "enabled": True,
                    "value": 48.0,
                    "unit": "hours",
                    "operator": "le",
                    "description": "Battery limit",
                },
            },
            "earth": {
                "max_continuous_earth_blackout_hours": {
                    "id": "max_continuous_earth_blackout_hours",
                    "name": "Maximum Continuous Telecommunications Blackout",
                    "classification": "HARD_CONSTRAINT",
                    "enabled": True,
                    "value": 24.0,
                    "unit": "hours",
                    "operator": "le",
                }
            },
            "terrain": {
                "max_local_slope_deg": {
                    "id": "max_local_slope_deg",
                    "name": "Maximum Allowable Landing Site Slope",
                    "classification": "HARD_CONSTRAINT",
                    "enabled": True,
                    "value": 15.0,
                    "unit": "deg",
                    "operator": "le",
                    "description": "Slope safety",
                }
            }
        }
    }
    p_resp = client.post("/api/profiles/", json=p_req)
    assert p_resp.status_code == 201
    profile_id = p_resp.json()["id"]

    # Scenario scenario-cr-crest has a 3-day (72 hour) duration
    screen_req = {
        "profile_id": profile_id,
        "scenario_ids": ["scenario-cr-crest"],
    }
    s_resp = client.post("/api/screening/run", json=screen_req)
    assert s_resp.status_code == 201
    data = s_resp.json()["run"]
    candidate = data["candidates"][0]

    assert candidate["scope_mismatch_detected"] is True
    assert candidate["analysis_duration_hours"] == 72.0
    assert candidate["profile_duration_hours"] == 336.0

    # Locate the 150h requirement evaluation
    res_150 = next(
        r for r in candidate["hard_constraint_results"]
        if r["requirement_id"] == "min_total_sunlight_hours"
    )
    assert res_150["verdict"] == ScreeningVerdict.NOT_EVALUABLE_SCOPE_MISMATCH.value
    assert "Scope mismatch" in res_150["explanation"]
    assert "not a candidate site failure" in res_150["explanation"]

    # Locate the max continuous darkness requirement (evaluated over the 72h window)
    res_dark = next(
        r for r in candidate["hard_constraint_results"]
        if r["requirement_id"] == "max_continuous_darkness_hours"
    )
    assert res_dark["verdict"] in (ScreeningVerdict.PASS.value, ScreeningVerdict.FAIL.value)

    # Candidate MUST NOT be classified as NON_COMPLIANT due to scope mismatch
    assert candidate["hard_constraints_failed"] == 0
    assert candidate["hard_constraints_scope_mismatch"] >= 1
    assert candidate["overall_status"] == OverallCandidateStatus.INDETERMINATE.value

def test_impossible_threshold_validation():
    """
    Verifies that impossible thresholds:
    1. Are rejected at profile creation time with 400 Bad Request.
    2. Are flagged as IMPOSSIBLE_THRESHOLD if evaluated by the screening engine.
    """
    p_req = {
        "name": "Impossible Threshold Test Profile",
        "description": "Tests impossible criteria flagging",
        "mission_type": "custom",
        "duration_days": 3.0,
        "start_timestamp_iso": "2026-10-04T12:00:00Z",
        "end_timestamp_iso": "2026-10-07T12:00:00Z",
        "observer_height_m": 2.0,
        "requirements": {
            "solar": {
                "min_total_sunlight_hours": {
                    "id": "min_total_sunlight_hours",
                    "name": "Minimum Total Geometric Sunlight Duration",
                    "classification": "HARD_CONSTRAINT",
                    "enabled": True,
                    "value": 150.0,  # 150h in 72h duration is impossible!
                    "unit": "hours",
                    "operator": "ge",
                },
                "min_sunlight_percentage": {
                    "id": "min_sunlight_percentage",
                    "name": "Minimum Sunlight Percentage",
                    "classification": "HARD_CONSTRAINT",
                    "enabled": True,
                    "value": 120.0,  # 120% is impossible!
                    "unit": "%",
                    "operator": "ge",
                }
            }
        }
    }
    # Profile creation correctly catches physically impossible configurations
    p_resp = client.post("/api/profiles/", json=p_req)
    assert p_resp.status_code == 400
    err_body = p_resp.json()
    assert "feedback" in err_body or "detail" in err_body

    # Screening engine classifies impossible thresholds as IMPOSSIBLE_THRESHOLD
    svc = CandidateScreeningService()
    hard_results = []
    soft_results = []
    info_metrics = []

    req_sun = SingleRequirement(
        id="min_total_sunlight_hours",
        name="Minimum Total Sunlight",
        classification=RequirementClassification.HARD_CONSTRAINT,
        enabled=True,
        value=150.0,
        unit="hours",
        operator="ge",
    )
    svc._eval_requirement(
        req=req_sun,
        measured=50.0,
        category="solar",
        is_coverage_indeterminate=False,
        source="Test",
        analysis_period="72h",
        hard_results=hard_results,
        soft_results=soft_results,
        info_metrics=info_metrics,
        analysis_duration_hours=72.0,
        profile_duration_hours=72.0,
        scope_mismatch=False,
    )
    assert len(hard_results) == 1
    assert hard_results[0].verdict == ScreeningVerdict.IMPOSSIBLE_THRESHOLD

    req_pct = SingleRequirement(
        id="min_sunlight_percentage",
        name="Minimum Sunlight Percentage",
        classification=RequirementClassification.HARD_CONSTRAINT,
        enabled=True,
        value=120.0,
        unit="%",
        operator="ge",
    )
    svc._eval_requirement(
        req=req_pct,
        measured=70.0,
        category="solar",
        is_coverage_indeterminate=False,
        source="Test",
        analysis_period="72h",
        hard_results=hard_results,
        soft_results=soft_results,
        info_metrics=info_metrics,
        analysis_duration_hours=72.0,
        profile_duration_hours=72.0,
        scope_mismatch=False,
    )
    assert len(hard_results) == 2
    assert hard_results[1].verdict == ScreeningVerdict.IMPOSSIBLE_THRESHOLD

def test_partial_final_day_handling():
    """
    Verifies that for an 84-hour analysis (3.5 days):
    - Days 1, 2, 3 are complete 24.0h days.
    - Day 4 is identified as a partial tail day (12.0 hours).
    - Daily metrics do not treat the 12.0h tail as a 24.0h day.
    """
    svc = CandidateScreeningService()

    class MockPt:
        def __init__(self, t_iso, sun_f):
            self.timestamp_iso = t_iso
            self.sun_visible_fraction = sun_f

    start_iso = "2026-10-04T00:00:00Z"
    end_iso = "2026-10-07T12:00:00Z"  # 3.5 days = 84h
    series = []
    st = datetime.fromisoformat(start_iso.replace("Z", "+00:00"))
    for h in range(85):
        cur = st + timedelta(hours=h)
        series.append(MockPt(cur.isoformat().replace("+00:00", "Z"), 1.0))

    res = svc._compute_daily_sunlight_metrics(series, start_iso, end_iso, 3.5)
    assert res["day_count"] == 4
    assert res["complete_days_count"] == 3
    assert res["has_partial_day"] is True
    assert res["partial_day_hours"] == 12.0
    assert len(res["complete_daily_hours_list"]) == 3
    for d_h in res["complete_daily_hours_list"]:
        assert math.isclose(d_h, 24.0, abs_tol=0.1)
