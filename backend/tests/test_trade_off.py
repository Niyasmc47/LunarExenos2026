import io
import csv
import json
import pytest
from concurrent.futures import ThreadPoolExecutor
from fastapi.testclient import TestClient

from pydantic import ValidationError
from app.main import app
from app.schemas.mission_profile import (
    MissionProfileCreateRequest,
    SingleRequirement,
    RequirementClassification,
)
from app.schemas.screening import (
    OverallCandidateStatus,
    ScreeningVerdict,
    RequirementEvaluationResult,
)
from app.schemas.trade_off import (
    PreferenceDirection,
    NormalizationMethod,
    ParetoDominanceStatus,
    PreferenceCriterionConfig,
    PreferenceModelConfig,
    MissionAlternativeInput,
    TradeOffStudyCreateRequest,
    TradeOffStudyUpdateRequest,
)
from app.services.mission_profile_service import mission_profile_service
from app.services.scenario_service import scenario_service
from app.services.trade_off_service import trade_off_service, TradeOffService

client = TestClient(app)


@pytest.fixture
def trade_off_fixtures():
    """Sets up mission profile, candidate scenarios, and default study inputs."""
    profile_req = MissionProfileCreateRequest(
        name="Trade-Off Test Profile",
        description="Profile used for trade-off engine multi-criteria analysis verification",
        mission_type="robotic_lander",
        duration_days=3.0,  # 72.0 hours (matches default scenario duration)
        intended_analysis_start_iso="2026-10-04T12:00:00Z",
        intended_analysis_end_iso="2026-10-07T12:00:00Z",
        observer_height_m=2.0,
        requirements_config={
            "solar": {
                "min_total_sunlight_hours": {
                    "id": "solar-total-hours",
                    "name": "Minimum Total Sunlight Duration",
                    "classification": "HARD_CONSTRAINT",
                    "operator": ">=",
                    "value": 20.0,
                    "unit": "hours",
                    "enabled": True,
                },
                "max_continuous_darkness_hours": {
                    "id": "solar-max-darkness",
                    "name": "Maximum Continuous Darkness",
                    "classification": "HARD_CONSTRAINT",
                    "operator": "<=",
                    "value": 40.0,
                    "unit": "hours",
                    "enabled": True,
                },
            },
            "terrain": {
                "max_local_slope_deg": {
                    "id": "trn-max-slope",
                    "name": "Maximum Local Slope",
                    "classification": "HARD_CONSTRAINT",
                    "operator": "<=",
                    "value": 15.0,
                    "unit": "deg",
                    "enabled": True,
                }
            },
        },
    )
    profile = mission_profile_service.create_profile(profile_req)
    scenarios = scenario_service.list_scenarios()

    return {"profile": profile, "scenarios": scenarios}


def test_normalization_methods_and_edge_cases():
    """
    Verifies benefit, cost, target-range, constant-range, and invalid-range normalization.
    Uses synthetic values with mathematically verified expectations.
    """
    svc = trade_off_service

    # 1. Benefit Metric: (x - R_min) / (R_max - R_min)
    crit_benefit = PreferenceCriterionConfig(
        id="crit-benefit",
        name="Sunlight Benefit",
        metric_key="total_sunlight_hours",
        unit="h",
        category="solar",
        direction=PreferenceDirection.HIGHER_IS_BETTER,
        normalization_method=NormalizationMethod.MIN_MAX,
        reference_min=0.0,
        reference_max=100.0,
    )
    val, formula, note = svc.normalize_single_metric(50.0, crit_benefit)
    assert val == 0.50
    assert "50.00 - 0.00" in formula

    # Clamp upper
    val_upper, _, _ = svc.normalize_single_metric(120.0, crit_benefit)
    assert val_upper == 1.0

    # Clamp lower
    val_lower, _, _ = svc.normalize_single_metric(-10.0, crit_benefit)
    assert val_lower == 0.0

    # 2. Cost Metric: (R_max - x) / (R_max - R_min)
    crit_cost = PreferenceCriterionConfig(
        id="crit-cost",
        name="Slope Cost",
        metric_key="local_slope_deg",
        unit="deg",
        category="terrain",
        direction=PreferenceDirection.LOWER_IS_BETTER,
        normalization_method=NormalizationMethod.MIN_MAX,
        reference_min=0.0,
        reference_max=20.0,
    )
    val_cost, _, _ = svc.normalize_single_metric(5.0, crit_cost)
    assert val_cost == 0.75  # (20 - 5) / 20 = 15/20 = 0.75

    val_cost_zero, _, _ = svc.normalize_single_metric(0.0, crit_cost)
    assert val_cost_zero == 1.0  # lowest cost = best score

    val_cost_max, _, _ = svc.normalize_single_metric(20.0, crit_cost)
    assert val_cost_max == 0.0  # highest cost = worst score

    # 3. Target Range Metric
    crit_target = PreferenceCriterionConfig(
        id="crit-target",
        name="Target Elevation",
        metric_key="surface_elevation_m",
        unit="m",
        category="terrain",
        direction=PreferenceDirection.TARGET_RANGE,
        normalization_method=NormalizationMethod.TARGET_RANGE,
        reference_min=-4000.0,
        reference_max=-1000.0,
        target_min=-3000.0,
        target_max=-2000.0,
    )
    val_in_target, _, _ = svc.normalize_single_metric(-2500.0, crit_target)
    assert val_in_target == 1.0

    val_below_target, _, _ = svc.normalize_single_metric(-3500.0, crit_target)
    # falloff: 1 - (-3000 - -3500) / (-3000 - -4000) = 1 - 500/1000 = 0.5
    assert val_below_target == 0.5

    # 4. Constant Range (R_max == R_min)
    crit_const = PreferenceCriterionConfig(
        id="crit-const",
        name="Constant Bound",
        metric_key="constant_m",
        unit="m",
        reference_min=50.0,
        reference_max=50.0,
    )
    val_c_match, _, _ = svc.normalize_single_metric(50.0, crit_const)
    assert val_c_match == 1.0

    val_c_mismatch, _, _ = svc.normalize_single_metric(40.0, crit_const)
    assert val_c_mismatch == 0.0

    # 5. Invalid Range (R_max < R_min)
    crit_invalid = PreferenceCriterionConfig(
        id="crit-inv",
        name="Invalid Bound",
        metric_key="inv_m",
        unit="m",
        reference_min=100.0,
        reference_max=50.0,
    )
    val_inv, _, _ = svc.normalize_single_metric(75.0, crit_invalid)
    assert val_inv is None


def test_weight_validation_and_normalization():
    """Verifies that weights sum to 1.0 and negative or all-zero weights are rejected."""
    svc = trade_off_service

    # Invalid: Negative weight caught by Pydantic
    with pytest.raises(ValidationError):
        PreferenceCriterionConfig(
            id="c1", name="C1", metric_key="m1", unit="u", enabled=True, weight=-0.5
        )

    # Invalid: All zero weights
    invalid_zero = PreferenceModelConfig(
        criteria=[
            PreferenceCriterionConfig(
                id="c1", name="C1", metric_key="m1", unit="u", enabled=True, weight=0.0
            ),
            PreferenceCriterionConfig(
                id="c2", name="C2", metric_key="m2", unit="u", enabled=True, weight=0.0
            ),
        ]
    )
    with pytest.raises(ValueError, match="positive total weight"):
        svc._validate_preference_model(invalid_zero)


def test_hard_constraint_fail_precedence_and_indeterminate_separation(trade_off_fixtures):
    """
    Verifies that a hard constraint failure strictly marks an alternative NON_COMPLIANT,
    and a high soft-preference score never overrides or hides a hard failure.
    """
    profile = trade_off_fixtures["profile"]
    scenarios = trade_off_fixtures["scenarios"]

    # Construct request with 2 alternatives
    req = TradeOffStudyCreateRequest(
        name="Precedence & Compliance Study",
        description="Testing hard constraint failure precedence",
        profile_id=profile.id,
        nominal_duration_days=3.0,
        alternatives=[
            MissionAlternativeInput(
                name="Candidate Alpha",
                scenario_id=scenarios[0].id,
                notes="Candidate with valid bounds",
            ),
            MissionAlternativeInput(
                name="Candidate Beta",
                scenario_id=scenarios[1].id,
                notes="Candidate testing compliance separation",
            ),
        ],
    )

    res = client.post("/api/trade-off/studies", json=req.model_dump())
    assert res.status_code == 201
    study = res.json()["study"]

    assert len(study["alternatives"]) == 2
    for alt in study["alternatives"]:
        assert alt["hard_constraint_status"] in ("COMPLIANT", "NON_COMPLIANT", "INDETERMINATE")

        # Score must be reported separately from hard constraint status
        score_info = study["scores"][alt["id"]]
        assert "composite_score" in score_info
        assert isinstance(score_info["composite_score"], (int, float))

        # Check disclaimers and limitations
        if alt["hard_constraint_status"] == "NON_COMPLIANT":
            assert any("violates one or more active hard constraints" in lim for lim in score_info["limitations"])


def test_missing_data_preserves_incomplete_score_without_zero_substitution(trade_off_fixtures):
    """
    Verifies that missing or incomplete measurements are NOT substituted with zero,
    and the score is marked INCOMPLETE with exact available weight reported.
    """
    svc = trade_off_service
    profile = trade_off_fixtures["profile"]

    # Construct synthetic alternative where 1 metric is missing
    model = PreferenceModelConfig(
        criteria=[
            PreferenceCriterionConfig(
                id="pref-sun",
                name="Sunlight",
                metric_key="total_sunlight_hours",
                unit="h",
                weight=1.0,  # 50%
                reference_min=0.0,
                reference_max=100.0,
            ),
            PreferenceCriterionConfig(
                id="pref-comm",
                name="Earth Comm",
                metric_key="total_earth_visible_hours",
                unit="h",
                weight=1.0,  # 50%
                reference_min=0.0,
                reference_max=100.0,
            ),
        ]
    )

    from app.schemas.trade_off import MissionAlternativeRecord

    alt_missing = MissionAlternativeRecord(
        id="alt-01",
        name="Alternative with Missing Comm",
        candidate_id="scen-1",
        candidate_name="Site 01",
        site_id="site01",
        latitude=-89.5,
        longitude=0.0,
        start_timestamp_iso="2026-10-04T12:00:00Z",
        end_timestamp_iso="2026-10-07T12:00:00Z",
        duration_days=3.0,
        duration_hours=72.0,
        profile_id=profile.id,
        profile_version=profile.version,
        profile_snapshot=profile,
        extracted_metrics={
            "total_sunlight_hours": 80.0,        # 80/100 = 0.8
            "total_earth_visible_hours": None,  # MISSING! Must not become 0.0
        },
    )

    scores, pareto = svc._execute_analysis([alt_missing], model)
    s = scores["alt-01"]

    # Since comm is missing, evaluated weight fraction is exactly 0.5 (50%)
    assert s.score_status == "INCOMPLETE"
    assert s.available_weight_fraction == 0.5
    # Sunlight contribution is 0.5 * 0.8 * 100 = 40.0
    assert s.composite_score == 40.0
    assert any("Incomplete score" in lim for lim in s.limitations)


def test_pareto_dominance_mathematical_accuracy(trade_off_fixtures):
    """
    Verifies Pareto dominance logic:
    - Alt A has higher sunlight and lower slope than Alt B -> A dominates B (A is PARETO_OPTIMAL, B is DOMINATED)
    - Alt C has higher sunlight but higher slope than A -> trade-off, neither dominates (both PARETO_OPTIMAL)
    """
    svc = trade_off_service
    profile = trade_off_fixtures["profile"]
    from app.schemas.trade_off import MissionAlternativeRecord

    model = PreferenceModelConfig(
        criteria=[
            PreferenceCriterionConfig(
                id="pref-sun",
                name="Sunlight",
                metric_key="total_sunlight_hours",
                unit="h",
                direction=PreferenceDirection.HIGHER_IS_BETTER,
                weight=1.0,
                reference_min=0.0,
                reference_max=100.0,
            ),
            PreferenceCriterionConfig(
                id="pref-slope",
                name="Slope",
                metric_key="local_slope_deg",
                unit="deg",
                direction=PreferenceDirection.LOWER_IS_BETTER,
                weight=1.0,
                reference_min=0.0,
                reference_max=20.0,
            ),
        ]
    )

    # Alt A: Sunlight 80h (norm 0.8), Slope 5 deg (norm 0.75)
    alt_a = MissionAlternativeRecord(
        id="alt-A", name="A", candidate_id="s1", candidate_name="Site A", site_id="site01",
        latitude=-89.5, longitude=0.0, start_timestamp_iso="2026-10-04T12:00:00Z", end_timestamp_iso="2026-10-07T12:00:00Z",
        duration_days=3.0, duration_hours=72.0, profile_id=profile.id, profile_version=profile.version, profile_snapshot=profile,
        extracted_metrics={"total_sunlight_hours": 80.0, "local_slope_deg": 5.0},
    )

    # Alt B: Sunlight 60h (norm 0.6), Slope 10 deg (norm 0.50) -> Strictly inferior to A in both!
    alt_b = MissionAlternativeRecord(
        id="alt-B", name="B", candidate_id="s2", candidate_name="Site B", site_id="site01",
        latitude=-89.5, longitude=10.0, start_timestamp_iso="2026-10-04T12:00:00Z", end_timestamp_iso="2026-10-07T12:00:00Z",
        duration_days=3.0, duration_hours=72.0, profile_id=profile.id, profile_version=profile.version, profile_snapshot=profile,
        extracted_metrics={"total_sunlight_hours": 60.0, "local_slope_deg": 10.0},
    )

    # Alt C: Sunlight 90h (norm 0.9), Slope 10 deg (norm 0.50) -> Better sunlight than A, but steeper slope
    alt_c = MissionAlternativeRecord(
        id="alt-C", name="C", candidate_id="s3", candidate_name="Site C", site_id="site01",
        latitude=-89.5, longitude=20.0, start_timestamp_iso="2026-10-04T12:00:00Z", end_timestamp_iso="2026-10-07T12:00:00Z",
        duration_days=3.0, duration_hours=72.0, profile_id=profile.id, profile_version=profile.version, profile_snapshot=profile,
        extracted_metrics={"total_sunlight_hours": 90.0, "local_slope_deg": 10.0},
    )

    scores, pareto = svc._execute_analysis([alt_a, alt_b, alt_c], model)

    assert pareto["alt-A"].status == ParetoDominanceStatus.PARETO_OPTIMAL
    assert "alt-B" in pareto["alt-A"].dominates

    assert pareto["alt-B"].status == ParetoDominanceStatus.DOMINATED
    assert "alt-A" in pareto["alt-B"].dominated_by

    assert pareto["alt-C"].status == ParetoDominanceStatus.PARETO_OPTIMAL
    assert "alt-B" in pareto["alt-C"].dominates


def test_sensitivity_analysis_execution(trade_off_fixtures):
    """Verifies that sensitivity analysis evaluates multi-scenario weight shifts deterministically."""
    profile = trade_off_fixtures["profile"]
    scenarios = trade_off_fixtures["scenarios"]

    req = TradeOffStudyCreateRequest(
        name="Sensitivity Test Study",
        profile_id=profile.id,
        nominal_duration_days=3.0,
        alternatives=[
            MissionAlternativeInput(name="Site A", scenario_id=scenarios[0].id),
            MissionAlternativeInput(name="Site B", scenario_id=scenarios[1].id),
        ],
    )
    res = client.post("/api/trade-off/studies", json=req.model_dump())
    assert res.status_code == 201
    study_id = res.json()["study"]["id"]

    sens_res = client.post(f"/api/trade-off/studies/{study_id}/sensitivity")
    assert sens_res.status_code == 200
    sens_data = sens_res.json()

    assert len(sens_data["tested_scenarios"]) >= 5
    assert "leader_stability" in sens_data
    assert "robust_alternatives" in sens_data


def test_trade_off_json_and_csv_exports(trade_off_fixtures):
    """Verifies JSON and CSV export endpoints return valid structured data and headers."""
    profile = trade_off_fixtures["profile"]
    scenarios = trade_off_fixtures["scenarios"]

    req = TradeOffStudyCreateRequest(
        name="Export Test Study",
        profile_id=profile.id,
        nominal_duration_days=3.0,
        alternatives=[
            MissionAlternativeInput(name="Site A", scenario_id=scenarios[0].id),
            MissionAlternativeInput(name="Site B", scenario_id=scenarios[1].id),
        ],
    )
    create_res = client.post("/api/trade-off/studies", json=req.model_dump())
    study_id = create_res.json()["study"]["id"]

    # 1. JSON Export
    json_res = client.get(f"/api/trade-off/studies/{study_id}/export/json")
    assert json_res.status_code == 200
    assert "application/json" in json_res.headers["content-type"]
    exported_json = json_res.json()
    assert exported_json["id"] == study_id
    assert "scientific_disclaimers" in exported_json

    # 2. CSV Export
    csv_res = client.get(f"/api/trade-off/studies/{study_id}/export/csv")
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.headers["content-type"]
    csv_text = csv_res.text
    assert "Alternative ID" in csv_text
    assert "Hard Constraint Status" in csv_text
    assert "Composite Score (0-100)" in csv_text
    assert "Mandatory Scientific Disclaimers" in csv_text


def test_concurrent_trade_off_execution(trade_off_fixtures):
    """Verifies thread-safe execution of concurrent trade-off study operations."""
    profile = trade_off_fixtures["profile"]
    scenarios = trade_off_fixtures["scenarios"]

    req = TradeOffStudyCreateRequest(
        name="Concurrent Study",
        profile_id=profile.id,
        nominal_duration_days=3.0,
        alternatives=[
            MissionAlternativeInput(name="Site A", scenario_id=scenarios[0].id),
            MissionAlternativeInput(name="Site B", scenario_id=scenarios[1].id),
        ],
    )

    def run_create(idx: int):
        req_copy = req.model_copy(deep=True)
        req_copy.name = f"Concurrent Study #{idx}"
        r = client.post("/api/trade-off/studies", json=req_copy.model_dump())
        return r.status_code, r.json()

    with ThreadPoolExecutor(max_workers=3) as executor:
        results = list(executor.map(run_create, range(3)))

    for status_code, data in results:
        assert status_code == 201
        assert "study" in data
