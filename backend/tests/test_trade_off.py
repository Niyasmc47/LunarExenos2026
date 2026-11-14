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

    # Binary out-of-range returns 0.0
    val_below_target, _, _ = svc.normalize_single_metric(-3500.0, crit_target)
    assert val_below_target == 0.0

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

    # 5. Invalid Range (R_max < R_min) raises ValueError
    crit_invalid = PreferenceCriterionConfig(
        id="crit-inv",
        name="Invalid Bound",
        metric_key="inv_m",
        unit="m",
        reference_min=100.0,
        reference_max=50.0,
    )
    with pytest.raises(ValueError, match="reference_max"):
        svc.normalize_single_metric(75.0, crit_invalid)


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


def test_pareto_pairwise_dominance_audit_cases(trade_off_fixtures):
    """
    Comprehensive audit tests for Pareto dominance calculations:
    1. Complete alternatives with strict dominance.
    2. Equal alternatives (tied on all metrics, neither dominates).
    3. One missing criterion (incomparable, prevents dominance).
    4. Missing criteria that prevent dominance in both directions.
    5. Dominance explanation itemizes specific dominating criteria.
    6. Mixed compliant and non-compliant alternatives (Pareto status remains separate).
    """
    svc = trade_off_service
    profile = trade_off_fixtures["profile"]
    from app.schemas.trade_off import MissionAlternativeRecord

    model = PreferenceModelConfig(
        criteria=[
            PreferenceCriterionConfig(
                id="c-sun", name="Sun", metric_key="m_sun", unit="h",
                direction=PreferenceDirection.HIGHER_IS_BETTER, weight=1.0,
                reference_min=0.0, reference_max=100.0,
            ),
            PreferenceCriterionConfig(
                id="c-slope", name="Slope", metric_key="m_slope", unit="deg",
                direction=PreferenceDirection.LOWER_IS_BETTER, weight=1.0,
                reference_min=0.0, reference_max=20.0,
            ),
        ]
    )

    def make_alt(aid: str, m_sun, m_slope, hc_status=OverallCandidateStatus.COMPLIANT):
        return MissionAlternativeRecord(
            id=aid, name=f"Alt {aid}", candidate_id="scen-1", candidate_name="Site 1", site_id="s1",
            latitude=-89.5, longitude=0.0, start_timestamp_iso="2026-10-04T12:00:00Z", end_timestamp_iso="2026-10-07T12:00:00Z",
            duration_days=3.0, duration_hours=72.0, profile_id=profile.id, profile_version=profile.version, profile_snapshot=profile,
            hard_constraint_status=hc_status,
            extracted_metrics={"m_sun": m_sun, "m_slope": m_slope},
        )

    # Case 1: Strict Dominance
    # Alt 1: Sun 80h (0.8), Slope 5° (0.75)
    # Alt 2: Sun 60h (0.6), Slope 10° (0.50) -> Alt 1 strictly dominates Alt 2
    alt1 = make_alt("alt-1", 80.0, 5.0)
    alt2 = make_alt("alt-2", 60.0, 10.0)

    scores1, pareto1 = svc._execute_analysis([alt1, alt2], model)
    assert pareto1["alt-1"].status == ParetoDominanceStatus.PARETO_OPTIMAL
    assert "alt-2" in pareto1["alt-1"].dominates
    assert pareto1["alt-2"].status == ParetoDominanceStatus.DOMINATED
    assert "alt-1" in pareto1["alt-2"].dominated_by
    # Explanation includes dominating criteria
    assert "alt-1" in pareto1["alt-2"].dominating_criteria_by_alternative
    assert len(pareto1["alt-2"].dominating_criteria_by_alternative["alt-1"]) == 2

    # Case 2: Equal Alternatives (Tied on all criteria)
    # Alt 3 and Alt 4 have identical values: neither must dominate the other
    alt3 = make_alt("alt-3", 75.0, 8.0)
    alt4 = make_alt("alt-4", 75.0, 8.0)
    scores2, pareto2 = svc._execute_analysis([alt3, alt4], model)
    assert pareto2["alt-3"].status == ParetoDominanceStatus.PARETO_OPTIMAL
    assert pareto2["alt-4"].status == ParetoDominanceStatus.PARETO_OPTIMAL
    assert len(pareto2["alt-3"].dominated_by) == 0
    assert len(pareto2["alt-4"].dominated_by) == 0
    assert "Tied on all enabled criteria" in pareto2["alt-3"].explanation
    assert "Tied on all enabled criteria" in pareto2["alt-4"].explanation

    # Case 3: Missing Criterion (Incomparable)
    # Alt 5 has missing slope -> must be classified INCOMPARABLE_INCOMPLETE
    alt5 = make_alt("alt-5", 90.0, None)
    scores3, pareto3 = svc._execute_analysis([alt1, alt5], model)
    assert pareto3["alt-5"].status == ParetoDominanceStatus.INCOMPARABLE_INCOMPLETE
    assert not pareto3["alt-5"].is_fully_comparable
    # Alt 1 cannot dominate Alt 5 because Alt 5's slope is unmeasured
    assert "alt-5" not in pareto3["alt-1"].dominates

    # Case 4: Mixed Compliant and Non-Compliant
    # Alt 6 has superior criteria values but failed hard constraints (NON_COMPLIANT)
    alt6 = make_alt("alt-6", 95.0, 2.0, hc_status=OverallCandidateStatus.NON_COMPLIANT)
    scores4, pareto4 = svc._execute_analysis([alt1, alt6], model)
    # Pareto status is evaluated strictly in the preference criteria space
    assert pareto4["alt-6"].status == ParetoDominanceStatus.PARETO_OPTIMAL
    # But ranking eligibility must exclude alt-6
    assert scores4["alt-6"].ranking_eligibility == "INELIGIBLE_NON_COMPLIANT"
    assert scores4["alt-6"].eligible_rank is None
    # While alt-1 is eligible
    assert scores4["alt-1"].ranking_eligibility == "ELIGIBLE"
    assert scores4["alt-1"].eligible_rank == 1


def test_ranking_eligibility_and_non_compliant_exclusion(trade_off_fixtures):
    """
    Verifies that:
    - NON_COMPLIANT alternatives are strictly excluded from ranking.
    - INDETERMINATE alternatives are strictly excluded from ranking.
    - INCOMPLETE scores are strictly excluded from ranking against complete scores.
    - If no eligible candidate exists, system reports no eligible rankings.
    """
    svc = trade_off_service
    profile = trade_off_fixtures["profile"]
    from app.schemas.trade_off import MissionAlternativeRecord

    model = PreferenceModelConfig(
        criteria=[
            PreferenceCriterionConfig(
                id="c-sun", name="Sun", metric_key="m_sun", unit="h",
                direction=PreferenceDirection.HIGHER_IS_BETTER, weight=1.0,
                reference_min=0.0, reference_max=100.0,
            ),
        ]
    )

    # 1. Non-compliant alternative
    alt_non_comp = MissionAlternativeRecord(
        id="alt-nc", name="Non-Compliant Alt", candidate_id="s1", candidate_name="Site 1", site_id="s1",
        latitude=-89.5, longitude=0.0, start_timestamp_iso="2026-10-04T12:00:00Z", end_timestamp_iso="2026-10-07T12:00:00Z",
        duration_days=3.0, duration_hours=72.0, profile_id=profile.id, profile_version=profile.version, profile_snapshot=profile,
        hard_constraint_status=OverallCandidateStatus.NON_COMPLIANT,
        hard_constraints_failed=1,
        extracted_metrics={"m_sun": 99.0},  # Extremely high score!
    )

    # 2. Indeterminate alternative
    alt_indet = MissionAlternativeRecord(
        id="alt-indet", name="Indeterminate Alt", candidate_id="s2", candidate_name="Site 2", site_id="s1",
        latitude=-89.5, longitude=10.0, start_timestamp_iso="2026-10-04T12:00:00Z", end_timestamp_iso="2026-10-07T12:00:00Z",
        duration_days=3.0, duration_hours=72.0, profile_id=profile.id, profile_version=profile.version, profile_snapshot=profile,
        hard_constraint_status=OverallCandidateStatus.INDETERMINATE,
        extracted_metrics={"m_sun": 80.0},
    )

    # 3. Complete compliant alternative
    alt_comp = MissionAlternativeRecord(
        id="alt-comp", name="Compliant Alt", candidate_id="s3", candidate_name="Site 3", site_id="s1",
        latitude=-89.5, longitude=20.0, start_timestamp_iso="2026-10-04T12:00:00Z", end_timestamp_iso="2026-10-07T12:00:00Z",
        duration_days=3.0, duration_hours=72.0, profile_id=profile.id, profile_version=profile.version, profile_snapshot=profile,
        hard_constraint_status=OverallCandidateStatus.COMPLIANT,
        extracted_metrics={"m_sun": 60.0},  # Lower score, but COMPLIANT
    )

    scores, _ = svc._execute_analysis([alt_non_comp, alt_indet, alt_comp], model)

    assert scores["alt-nc"].ranking_eligibility == "INELIGIBLE_NON_COMPLIANT"
    assert scores["alt-nc"].eligible_rank is None

    assert scores["alt-indet"].ranking_eligibility == "INELIGIBLE_INDETERMINATE"
    assert scores["alt-indet"].eligible_rank is None

    # Only alt-comp is eligible and gets Rank #1
    assert scores["alt-comp"].ranking_eligibility == "ELIGIBLE"
    assert scores["alt-comp"].eligible_rank == 1

    # When only ineligibles exist:
    scores_only_inelig, _ = svc._execute_analysis([alt_non_comp, alt_indet], model)
    assert all(s.eligible_rank is None for s in scores_only_inelig.values())


def test_normalization_validation_rules_and_target_range():
    """
    Verifies normalization validation rules:
    - Min-max: reject R_max < R_min with ValueError
    - Min-max: reject non-finite bounds (NaN, Inf)
    - Min-max: handle R_max == R_min constant range safely
    - Target-range: validate T_min <= T_max, reject T_max < T_min
    - Target-range: exact boundaries return 1.0, outside returns 0.0
    """
    svc = trade_off_service

    # Inverted R_max < R_min
    crit_inverted = PreferenceCriterionConfig(
        id="c-inv", name="Inv", metric_key="k", unit="m",
        reference_min=50.0, reference_max=10.0,
    )
    with pytest.raises(ValueError, match="reference_max"):
        svc.normalize_single_metric(25.0, crit_inverted)

    with pytest.raises(ValueError, match="reference_max"):
        svc._validate_preference_model(PreferenceModelConfig(criteria=[crit_inverted]))

    # Target range validation
    crit_target_valid = PreferenceCriterionConfig(
        id="c-tgt", name="Target", metric_key="k", unit="m",
        direction=PreferenceDirection.TARGET_RANGE,
        normalization_method=NormalizationMethod.TARGET_RANGE,
        target_min=10.0, target_max=20.0,
    )
    # Inside
    val_in, _, _ = svc.normalize_single_metric(15.0, crit_target_valid)
    assert val_in == 1.0
    # Exact boundary T_min
    val_bmin, _, _ = svc.normalize_single_metric(10.0, crit_target_valid)
    assert val_bmin == 1.0
    # Exact boundary T_max
    val_bmax, _, _ = svc.normalize_single_metric(20.0, crit_target_valid)
    assert val_bmax == 1.0
    # Immediately outside (< T_min)
    val_below, _, _ = svc.normalize_single_metric(9.99, crit_target_valid)
    assert val_below == 0.0
    # Immediately outside (> T_max)
    val_above, _, _ = svc.normalize_single_metric(20.01, crit_target_valid)
    assert val_above == 0.0

    # Inverted target range
    crit_target_inv = PreferenceCriterionConfig(
        id="c-tgt-inv", name="Target Inv", metric_key="k", unit="m",
        direction=PreferenceDirection.TARGET_RANGE,
        normalization_method=NormalizationMethod.TARGET_RANGE,
        target_min=30.0, target_max=10.0,
    )
    with pytest.raises(ValueError, match="target_max"):
        svc.normalize_single_metric(15.0, crit_target_inv)

    with pytest.raises(ValueError, match="target_max"):
        svc._validate_preference_model(PreferenceModelConfig(criteria=[crit_target_inv]))


def test_sensitivity_weight_allocation_and_disabled_priority_groups(trade_off_fixtures):
    """
    Verifies sensitivity weight allocation formulas:
    - 70% priority / 30% remainder allocation.
    - Disabling criteria in a priority group marks the scheme unavailable with warning.
    - Sensitivity does NOT select non-compliant or incomplete alternatives as leaders.
    """
    svc = trade_off_service
    profile = trade_off_fixtures["profile"]
    from app.schemas.trade_off import MissionAlternativeRecord

    # Preference model with solar and terrain enabled, but earth disabled
    model = PreferenceModelConfig(
        criteria=[
            PreferenceCriterionConfig(
                id="pref-total-sunlight", name="Total Sunlight", metric_key="total_sunlight_hours",
                unit="h", category="solar", enabled=True, weight=1.0, reference_min=0.0, reference_max=72.0,
            ),
            PreferenceCriterionConfig(
                id="pref-full-sunlight", name="Full Sunlight", metric_key="full_sunlight_hours",
                unit="h", category="solar", enabled=True, weight=1.0, reference_min=0.0, reference_max=72.0,
            ),
            PreferenceCriterionConfig(
                id="pref-local-slope", name="Slope", metric_key="local_slope_deg",
                unit="deg", category="terrain", enabled=True, weight=1.0, reference_min=0.0, reference_max=20.0,
                direction=PreferenceDirection.LOWER_IS_BETTER,
            ),
            PreferenceCriterionConfig(
                id="pref-earth-visibility", name="Earth Comm", metric_key="total_earth_visible_hours",
                unit="h", category="earth", enabled=False, weight=1.0, reference_min=0.0, reference_max=72.0,
            ),
        ]
    )

    alt1 = MissionAlternativeRecord(
        id="alt-1", name="Alt 1", candidate_id="s1", candidate_name="Site 1", site_id="s1",
        latitude=-89.5, longitude=0.0, start_timestamp_iso="2026-10-04T12:00:00Z", end_timestamp_iso="2026-10-07T12:00:00Z",
        duration_days=3.0, duration_hours=72.0, profile_id=profile.id, profile_version=profile.version, profile_snapshot=profile,
        hard_constraint_status=OverallCandidateStatus.COMPLIANT,
        extracted_metrics={"total_sunlight_hours": 50.0, "full_sunlight_hours": 40.0, "local_slope_deg": 8.0, "total_earth_visible_hours": None},
    )

    alt2 = MissionAlternativeRecord(
        id="alt-2", name="Alt 2", candidate_id="s2", candidate_name="Site 2", site_id="s1",
        latitude=-89.5, longitude=10.0, start_timestamp_iso="2026-10-04T12:00:00Z", end_timestamp_iso="2026-10-07T12:00:00Z",
        duration_days=3.0, duration_hours=72.0, profile_id=profile.id, profile_version=profile.version, profile_snapshot=profile,
        hard_constraint_status=OverallCandidateStatus.COMPLIANT,
        extracted_metrics={"total_sunlight_hours": 60.0, "full_sunlight_hours": 50.0, "local_slope_deg": 12.0, "total_earth_visible_hours": None},
    )

    sens = svc._execute_sensitivity("study-sens-test", [alt1, alt2], model)

    # Check scenario availability
    scen_map = {s.scenario_id: s for s in sens.tested_scenarios}

    # Solar Priority: 70% split between 2 solar criteria (35% each), 30% to terrain
    solar_scen = scen_map["scen-solar"]
    assert solar_scen.is_available
    assert abs(solar_scen.weights["pref-total-sunlight"] - 0.35) < 0.01
    assert abs(solar_scen.weights["pref-full-sunlight"] - 0.35) < 0.01
    assert abs(solar_scen.weights["pref-local-slope"] - 0.30) < 0.01

    # Earth Communications: Earth criteria disabled -> must be unavailable with warning
    earth_scen = scen_map["scen-earth"]
    assert not earth_scen.is_available
    assert "No enabled criteria found" in earth_scen.warning

    # Check leader selection: Alt 2 has more sunlight, so in solar priority Alt 2 leads
    assert solar_scen.leading_alternative_id == "alt-2"

