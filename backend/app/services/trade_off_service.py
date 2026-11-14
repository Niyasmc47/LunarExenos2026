import os
import io
import csv
import json
import uuid
import math
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

from app.schemas.mission_profile import MissionProfile
from app.schemas.screening import (
    ScreeningVerdict,
    OverallCandidateStatus,
    DataCoverageStatus,
    RequirementEvaluationResult,
)
from app.schemas.terrain_assessment import TerrainSuitabilityStatus
from app.schemas.trade_off import (
    PreferenceDirection,
    NormalizationMethod,
    ParetoDominanceStatus,
    PreferenceCriterionConfig,
    PreferenceModelConfig,
    MissionAlternativeInput,
    MissionAlternativeRecord,
    AlternativeNormalizedMetric,
    AlternativeScoreBreakdown,
    AlternativeParetoResult,
    SensitivityScenarioResult,
    SensitivityAnalysisResponse,
    TradeOffStudyCreateRequest,
    TradeOffStudyUpdateRequest,
    TradeOffStudyRecord,
)
from app.services.mission_profile_service import mission_profile_service, MissionProfileService
from app.services.scenario_service import scenario_service, ScenarioEngineService
from app.services.screening_service import screening_service, CandidateScreeningService
from app.services.window_planner_service import window_planner_service, MissionWindowPlannerService
from app.services.terrain_assessment_service import terrain_assessment_service, TerrainAssessmentService

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
TRADE_OFF_STUDIES_FILE = DATA_DIR / "trade_off_studies.json"

MANDATORY_SCIENTIFIC_DISCLAIMERS: List[str] = [
    "A composite preference score is a user-configured decision aid, not a physical landing safety rating.",
    "Pareto optimality indicates absence of strictly superior alternatives under selected dimensions, not absolute mission feasibility.",
    "Hard constraint compliance does not establish lunar landing safety, geotechnical bearing capacity, or hazard absence.",
    "Geometric Earth line-of-sight visibility does not establish an operational RF communications link budget.",
    "Solar disk visibility does not calculate solar array electrical power output or thermal equilibrium.",
    "Topographic slope alone does not guarantee rover traversability or lander touchdown stability.",
    "Official LOLA roughness data is not loaded; roughness remains unsupported and is excluded from preference scoring.",
    "Missing or incomplete measurements are never replaced with zero and are explicitly designated as INCOMPLETE.",
    "Candidate alternatives must never be declared as universally best or safest.",
]


def build_default_preference_model(duration_hours: float) -> PreferenceModelConfig:
    """
    Builds an illustrative starting preference model configuration.
    Users can inspect, enable/disable, modify weights, or edit reference bounds.
    """
    criteria = [
        PreferenceCriterionConfig(
            id="pref-total-sunlight",
            name="Total Sunlight Duration",
            metric_key="total_sunlight_hours",
            unit="hours",
            category="solar",
            enabled=True,
            weight=1.0,
            direction=PreferenceDirection.HIGHER_IS_BETTER,
            normalization_method=NormalizationMethod.MIN_MAX,
            reference_min=0.0,
            reference_max=round(duration_hours, 1),
            description="Cumulative geometric sunlight duration (full + partial disk illumination).",
        ),
        PreferenceCriterionConfig(
            id="pref-full-sunlight",
            name="Full Sunlight Duration",
            metric_key="full_sunlight_hours",
            unit="hours",
            category="solar",
            enabled=True,
            weight=0.8,
            direction=PreferenceDirection.HIGHER_IS_BETTER,
            normalization_method=NormalizationMethod.MIN_MAX,
            reference_min=0.0,
            reference_max=round(duration_hours, 1),
            description="Duration where 100% of solar disk is above regional terrain horizon.",
        ),
        PreferenceCriterionConfig(
            id="pref-longest-darkness",
            name="Longest Continuous Darkness",
            metric_key="longest_darkness_hours",
            unit="hours",
            category="solar",
            enabled=True,
            weight=1.0,
            direction=PreferenceDirection.LOWER_IS_BETTER,
            normalization_method=NormalizationMethod.MIN_MAX,
            reference_min=0.0,
            reference_max=round(duration_hours, 1),
            description="Maximum uninterrupted duration of zero solar disk visibility (critical battery limit).",
        ),
        PreferenceCriterionConfig(
            id="pref-earth-visibility",
            name="Earth Direct Visibility",
            metric_key="total_earth_visible_hours",
            unit="hours",
            category="earth",
            enabled=True,
            weight=0.8,
            direction=PreferenceDirection.HIGHER_IS_BETTER,
            normalization_method=NormalizationMethod.MIN_MAX,
            reference_min=0.0,
            reference_max=round(duration_hours, 1),
            description="Cumulative geometric Earth line-of-sight visibility above terrain horizon.",
        ),
        PreferenceCriterionConfig(
            id="pref-longest-earth-blackout",
            name="Longest Earth Blackout",
            metric_key="longest_earth_blackout_hours",
            unit="hours",
            category="earth",
            enabled=True,
            weight=0.6,
            direction=PreferenceDirection.LOWER_IS_BETTER,
            normalization_method=NormalizationMethod.MIN_MAX,
            reference_min=0.0,
            reference_max=round(duration_hours, 1),
            description="Maximum continuous duration of zero Earth line-of-sight visibility.",
        ),
        PreferenceCriterionConfig(
            id="pref-local-slope",
            name="Local Topographic Slope",
            metric_key="local_slope_deg",
            unit="deg",
            category="terrain",
            enabled=True,
            weight=1.0,
            direction=PreferenceDirection.LOWER_IS_BETTER,
            normalization_method=NormalizationMethod.MIN_MAX,
            reference_min=0.0,
            reference_max=25.0,
            description="Evaluated local slope in degrees from NASA LOLA 5m/px DEM.",
        ),
        PreferenceCriterionConfig(
            id="pref-surface-elevation",
            name="Surface Elevation",
            metric_key="surface_elevation_m",
            unit="m",
            category="terrain",
            enabled=False,  # disabled by default, user may enable
            weight=0.4,
            direction=PreferenceDirection.HIGHER_IS_BETTER,
            normalization_method=NormalizationMethod.MIN_MAX,
            reference_min=-4000.0,
            reference_max=-1500.0,
            description="Surface elevation referenced to IAU Moon 2000 Sphere (R = 1,737,400.0 m).",
        ),
    ]
    return PreferenceModelConfig(criteria=criteria, use_relative_bounds=False, version="1.0")


class TradeOffService:
    def __init__(
        self,
        storage_path: Optional[Path] = None,
        profile_svc: Optional[MissionProfileService] = None,
        scen_svc: Optional[ScenarioEngineService] = None,
        screen_svc: Optional[CandidateScreeningService] = None,
        window_svc: Optional[MissionWindowPlannerService] = None,
        terrain_svc: Optional[TerrainAssessmentService] = None,
    ):
        self.storage_file = storage_path or TRADE_OFF_STUDIES_FILE
        self.profile_svc = profile_svc or mission_profile_service
        self.scenario_svc = scen_svc or scenario_service
        self.screen_svc = screen_svc or screening_service
        self.window_svc = window_svc or window_planner_service
        self.terrain_svc = terrain_svc or terrain_assessment_service

        self._lock = threading.Lock()
        self._studies: Dict[str, TradeOffStudyRecord] = {}
        self._load_from_storage()

    def _load_from_storage(self):
        with self._lock:
            if self.storage_file.exists():
                try:
                    with open(self.storage_file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        if isinstance(data, list):
                            for item in data:
                                try:
                                    rec = TradeOffStudyRecord.model_validate(item)
                                    self._studies[rec.id] = rec
                                except Exception:
                                    pass
                except Exception:
                    self._studies = {}

    def _save_to_storage_unlocked(self):
        self.storage_file.parent.mkdir(parents=True, exist_ok=True)
        temp_file = self.storage_file.with_suffix(".tmp")
        try:
            records = [rec.model_dump(mode="json") for rec in self._studies.values()]
            with open(temp_file, "w", encoding="utf-8") as f:
                json.dump(records, f, indent=2)
            temp_file.replace(self.storage_file)
        except Exception:
            if temp_file.exists():
                try:
                    temp_file.unlink()
                except Exception:
                    pass

    def list_studies(self) -> List[TradeOffStudyRecord]:
        with self._lock:
            items = list(self._studies.values())
            items.sort(key=lambda s: s.created_at_iso, reverse=True)
            return items

    def get_study(self, study_id: str) -> Optional[TradeOffStudyRecord]:
        with self._lock:
            return self._studies.get(study_id)

    def delete_study(self, study_id: str) -> bool:
        with self._lock:
            if study_id in self._studies:
                del self._studies[study_id]
                self._save_to_storage_unlocked()
                return True
            return False

    def create_study(self, req: TradeOffStudyCreateRequest) -> TradeOffStudyRecord:
        """
        Creates and immediately analyzes a multi-criteria mission trade-off study.
        Validates profile snapshot, alternative compatibility, and preference configuration.
        """
        # 1. Resolve Profile Snapshot
        profile = self.profile_svc.get_profile(req.profile_id)
        if not profile:
            raise KeyError(f"Mission profile '{req.profile_id}' not found.")
        profile_snapshot = profile.model_copy(deep=True)

        duration_hours = req.nominal_duration_days * 24.0

        # 2. Preference Model Configuration
        pref_model = req.custom_preferences or build_default_preference_model(duration_hours)

        # Validate preference weights
        self._validate_preference_model(pref_model)

        # 3. Resolve Alternatives
        resolved_alternatives: List[MissionAlternativeRecord] = []
        warnings: List[str] = []

        for idx, alt_in in enumerate(req.alternatives):
            alt_rec = self._resolve_single_alternative(
                alt_in=alt_in,
                profile=profile_snapshot,
                nominal_duration_days=req.nominal_duration_days,
                index=idx + 1,
            )
            resolved_alternatives.append(alt_rec)

        # 4. Execute Multi-Criteria Trade-off Analysis
        scores, pareto = self._execute_analysis(resolved_alternatives, pref_model)

        # 5. Sensitivity Analysis
        study_id = f"study-{uuid.uuid4().hex[:8]}"
        sensitivity = self._execute_sensitivity(study_id, resolved_alternatives, pref_model)

        now_iso = datetime.now(timezone.utc).isoformat()
        study_record = TradeOffStudyRecord(
            id=study_id,
            name=req.name.strip(),
            description=req.description,
            created_at_iso=now_iso,
            updated_at_iso=now_iso,
            profile_id=profile_snapshot.id,
            profile_name=profile_snapshot.name,
            profile_version=profile_snapshot.version,
            nominal_duration_days=req.nominal_duration_days,
            alternatives=resolved_alternatives,
            preference_model=pref_model,
            scores=scores,
            pareto_results=pareto,
            sensitivity_summary=sensitivity,
            analysis_timestamp_iso=now_iso,
            warnings=warnings,
            scientific_disclaimers=MANDATORY_SCIENTIFIC_DISCLAIMERS,
        )

        with self._lock:
            self._studies[study_id] = study_record
            self._save_to_storage_unlocked()

        return study_record

    def update_study(self, study_id: str, req: TradeOffStudyUpdateRequest) -> TradeOffStudyRecord:
        """
        Updates an existing study's alternatives or preference weights and recalculates analysis.
        """
        with self._lock:
            study = self._studies.get(study_id)
            if not study:
                raise KeyError(f"Trade-off study '{study_id}' not found.")

            if req.name is not None and req.name.strip():
                study.name = req.name.strip()
            if req.description is not None:
                study.description = req.description

            if req.preference_model is not None:
                self._validate_preference_model(req.preference_model)
                study.preference_model = req.preference_model

            if req.alternatives is not None:
                if len(req.alternatives) < 2 or len(req.alternatives) > 10:
                    raise ValueError("Trade-off study must contain between 2 and 10 alternatives.")

                # Re-resolve alternatives using frozen profile snapshot
                new_alts: List[MissionAlternativeRecord] = []
                for idx, alt_in in enumerate(req.alternatives):
                    alt_rec = self._resolve_single_alternative(
                        alt_in=alt_in,
                        profile=study.alternatives[0].profile_snapshot if study.alternatives else self.profile_svc.get_profile(study.profile_id),
                        nominal_duration_days=study.nominal_duration_days,
                        index=idx + 1,
                    )
                    new_alts.append(alt_rec)
                study.alternatives = new_alts

            # Re-execute analysis
            scores, pareto = self._execute_analysis(study.alternatives, study.preference_model)
            sensitivity = self._execute_sensitivity(study.id, study.alternatives, study.preference_model)

            now_iso = datetime.now(timezone.utc).isoformat()
            study.updated_at_iso = now_iso
            study.analysis_timestamp_iso = now_iso
            study.scores = scores
            study.pareto_results = pareto
            study.sensitivity_summary = sensitivity

            self._save_to_storage_unlocked()
            return study

    def run_analysis(self, study_id: str) -> TradeOffStudyRecord:
        """Explicitly re-runs trade-off scoring and Pareto analysis for a study."""
        with self._lock:
            study = self._studies.get(study_id)
            if not study:
                raise KeyError(f"Trade-off study '{study_id}' not found.")

            self._validate_preference_model(study.preference_model)
            scores, pareto = self._execute_analysis(study.alternatives, study.preference_model)
            sensitivity = self._execute_sensitivity(study.id, study.alternatives, study.preference_model)

            now_iso = datetime.now(timezone.utc).isoformat()
            study.updated_at_iso = now_iso
            study.analysis_timestamp_iso = now_iso
            study.scores = scores
            study.pareto_results = pareto
            study.sensitivity_summary = sensitivity

            self._save_to_storage_unlocked()
            return study

    def run_sensitivity(self, study_id: str) -> SensitivityAnalysisResponse:
        """Executes a weight sensitivity analysis across diverse operational priority scenarios."""
        with self._lock:
            study = self._studies.get(study_id)
            if not study:
                raise KeyError(f"Trade-off study '{study_id}' not found.")

            sensitivity = self._execute_sensitivity(study.id, study.alternatives, study.preference_model)
            study.sensitivity_summary = sensitivity
            study.updated_at_iso = datetime.now(timezone.utc).isoformat()
            self._save_to_storage_unlocked()
            return sensitivity

    # -------------------------------------------------------------------------
    # Core Domain Logic: Alternative Resolution & Integrity Verification
    # -------------------------------------------------------------------------
    def _resolve_single_alternative(
        self,
        alt_in: MissionAlternativeInput,
        profile: MissionProfile,
        nominal_duration_days: float,
        index: int,
    ) -> MissionAlternativeRecord:
        """
        Builds a verified, immutable alternative record from scenario, screening, window, and terrain data.
        Ensures strict compatibility and preserves missing-data state.
        """
        alt_id = f"alt-{index:02d}"
        warnings: List[str] = []

        # 1. Resolve Scenario
        scen = self.scenario_svc.get_scenario(alt_in.scenario_id)
        if not scen:
            raise KeyError(f"Candidate scenario '{alt_in.scenario_id}' not found.")

        # 2. Extract Mission Epochs & Duration
        start_iso = scen.start_timestamp_iso
        end_iso = scen.end_timestamp_iso
        t0 = datetime.fromisoformat(start_iso.replace("Z", "+00:00"))
        t1 = datetime.fromisoformat(end_iso.replace("Z", "+00:00"))
        duration_hours = max(0.0, (t1 - t0).total_seconds() / 3600.0)
        duration_days = round(duration_hours / 24.0, 2)

        # 3. Associate Mission Window (if specified)
        win_rec = None
        if alt_in.window_search_id and alt_in.window_id:
            search_rec = self.window_svc.get_search(alt_in.window_search_id)
            if search_rec:
                # Verify scenario compatibility
                if search_rec.scenario_id != scen.id:
                    raise ValueError(
                        f"Incompatible alternative: Window search '{alt_in.window_search_id}' was computed "
                        f"for scenario '{search_rec.scenario_id}', but alternative specified scenario '{scen.id}'."
                    )
                # Locate window
                for w in search_rec.windows:
                    if w.window_id == alt_in.window_id:
                        win_rec = w
                        break
                if not win_rec:
                    warnings.append(f"Window '{alt_in.window_id}' not found in search '{alt_in.window_search_id}'.")
                else:
                    start_iso = win_rec.start_timestamp_iso
                    end_iso = win_rec.end_timestamp_iso
                    duration_days = win_rec.duration_days
                    duration_hours = win_rec.duration_hours

        # Verify Duration Compatibility
        if abs(duration_days - nominal_duration_days) > 0.05:
            raise ValueError(
                f"Duration mismatch for alternative '{alt_in.name}': Mission duration ({duration_days:.2f} days) "
                f"does not match study nominal duration ({nominal_duration_days:.2f} days)."
            )

        # 4. Associate Screening Run (if specified)
        screen_summary = None
        if alt_in.screening_run_id:
            screening_rec = self.screen_svc.get_run(alt_in.screening_run_id)
            if screening_rec:
                # Find candidate in screening
                for c in screening_rec.candidates:
                    if c.candidate_id == scen.id:
                        screen_summary = c
                        break
                if not screen_summary:
                    warnings.append(f"Scenario '{scen.id}' not evaluated in screening run '{alt_in.screening_run_id}'.")

        # 5. Associate Terrain Assessment (if specified)
        terrain_cand = None
        terrain_status = None
        if alt_in.terrain_assessment_id:
            trn_rec = self.terrain_svc.get_assessment(alt_in.terrain_assessment_id)
            if trn_rec:
                for c in trn_rec.candidates:
                    if c.candidate_id == scen.id:
                        terrain_cand = c
                        terrain_status = c.overall_status
                        break
                if not terrain_cand:
                    warnings.append(f"Scenario '{scen.id}' not evaluated in terrain assessment '{alt_in.terrain_assessment_id}'.")

        # 6. Extract Raw Physical Metrics
        # Missing values remain None (never fabricated as zero)
        extracted: Dict[str, Optional[float]] = {
            "total_sunlight_hours": None,
            "full_sunlight_hours": None,
            "longest_darkness_hours": None,
            "total_earth_visible_hours": None,
            "longest_earth_blackout_hours": None,
            "local_slope_deg": None,
            "surface_elevation_m": None,
        }

        # From window (highest temporal precision if window was planned)
        if win_rec:
            extracted["total_sunlight_hours"] = win_rec.solar_summary.total_sunlight_hours
            extracted["full_sunlight_hours"] = win_rec.solar_summary.full_sunlight_hours
            extracted["longest_darkness_hours"] = win_rec.solar_summary.longest_darkness_hours
            extracted["total_earth_visible_hours"] = win_rec.earth_summary.total_earth_visible_hours
            extracted["longest_earth_blackout_hours"] = win_rec.earth_summary.longest_earth_blackout_hours
            if win_rec.local_slope_deg is not None:
                extracted["local_slope_deg"] = win_rec.local_slope_deg
            if win_rec.surface_elevation_m is not None:
                extracted["surface_elevation_m"] = win_rec.surface_elevation_m

        # From screening if window was not planned
        elif screen_summary:
            for pref in screen_summary.soft_preference_results:
                if pref.requirement_id in extracted and pref.actual_value is not None:
                    extracted[pref.requirement_id] = pref.actual_value
            for info in screen_summary.informational_metrics:
                if info.id in extracted and isinstance(info.value, (int, float)):
                    extracted[info.id] = float(info.value)
            if screen_summary.local_slope_deg is not None and extracted["local_slope_deg"] is None:
                extracted["local_slope_deg"] = screen_summary.local_slope_deg
            if screen_summary.surface_elevation_m is not None and extracted["surface_elevation_m"] is None:
                extracted["surface_elevation_m"] = screen_summary.surface_elevation_m

        # From terrain assessment
        if terrain_cand:
            if terrain_cand.slope_metrics.point_slope_deg is not None:
                extracted["local_slope_deg"] = terrain_cand.slope_metrics.point_slope_deg
            if terrain_cand.elevation_metrics.point_elevation_m is not None:
                extracted["surface_elevation_m"] = terrain_cand.elevation_metrics.point_elevation_m

        # Fallback to DEM loader point sample if still None
        if extracted["local_slope_deg"] is None or extracted["surface_elevation_m"] is None:
            try:
                from app.services.dem_loader import dem_loader
                sample = dem_loader.sample_point(scen.latitude, scen.longitude)
                if extracted["local_slope_deg"] is None and sample.get("slope_deg") is not None:
                    extracted["local_slope_deg"] = sample["slope_deg"]
                if extracted["surface_elevation_m"] is None and sample.get("elevation_m") is not None:
                    extracted["surface_elevation_m"] = sample["elevation_m"]
            except Exception:
                pass

        missing_metrics = [k for k, v in extracted.items() if v is None]
        data_completeness = round(((len(extracted) - len(missing_metrics)) / len(extracted)) * 100.0, 1)

        # 7. Evaluate Combined Hard Constraints
        hard_verdicts: List[RequirementEvaluationResult] = []
        if win_rec:
            hard_verdicts.extend(win_rec.hard_constraint_results)
        elif screen_summary:
            hard_verdicts.extend(screen_summary.hard_constraint_results)

        if terrain_cand:
            # Map EvaluatedTerrainRequirement to RequirementEvaluationResult
            for trn_r in terrain_cand.hard_constraint_results:
                hard_verdicts.append(
                    RequirementEvaluationResult(
                        requirement_id=trn_r.requirement_id,
                        requirement_name=trn_r.requirement_name,
                        category="terrain",
                        classification=trn_r.classification,
                        operator=trn_r.operator,
                        threshold_value=trn_r.threshold_value,
                        threshold_str=trn_r.threshold_str,
                        actual_value=trn_r.actual_value,
                        actual_value_str=trn_r.actual_value_str,
                        unit=trn_r.unit,
                        verdict=trn_r.verdict,
                        explanation=trn_r.explanation,
                        supporting_data_source=trn_r.supporting_data_source,
                        analysis_period="Terrain Assessment Footprint",
                    )
                )

        passed_hc = sum(1 for v in hard_verdicts if v.verdict == ScreeningVerdict.PASS)
        failed_hc = sum(1 for v in hard_verdicts if v.verdict == ScreeningVerdict.FAIL)
        indet_hc = sum(1 for v in hard_verdicts if v.verdict == ScreeningVerdict.INDETERMINATE)
        total_hc = len(hard_verdicts)

        # Strict Precedence Rule:
        # Any single hard constraint failure strictly sets NON_COMPLIANT.
        # Zero failures but >=1 indeterminate (or missing assessment for active constraint) sets INDETERMINATE.
        # Only all passed active hard constraints sets COMPLIANT.
        if failed_hc > 0 or (terrain_status == TerrainSuitabilityStatus.NON_COMPLIANT):
            hard_status = OverallCandidateStatus.NON_COMPLIANT
        elif indet_hc > 0 or (terrain_status == TerrainSuitabilityStatus.INDETERMINATE) or (total_hc == 0):
            hard_status = OverallCandidateStatus.INDETERMINATE
        else:
            hard_status = OverallCandidateStatus.COMPLIANT

        provenance = {
            "scenario_id": scen.id,
            "scenario_name": scen.name,
            "site_id": scen.site_id,
            "window_search_id": alt_in.window_search_id,
            "window_id": alt_in.window_id,
            "screening_run_id": alt_in.screening_run_id,
            "terrain_assessment_id": alt_in.terrain_assessment_id,
        }

        return MissionAlternativeRecord(
            id=alt_id,
            name=alt_in.name.strip(),
            description=alt_in.description,
            notes=alt_in.notes,
            candidate_id=scen.id,
            candidate_name=scen.name,
            site_id=scen.site_id,
            latitude=scen.latitude,
            longitude=scen.longitude,
            start_timestamp_iso=start_iso,
            end_timestamp_iso=end_iso,
            duration_days=duration_days,
            duration_hours=duration_hours,
            profile_id=profile.id,
            profile_version=profile.version,
            profile_snapshot=profile,
            source_screening_id=alt_in.screening_run_id,
            source_window_id=alt_in.window_id,
            source_terrain_assessment_id=alt_in.terrain_assessment_id,
            hard_constraint_status=hard_status,
            terrain_suitability_status=terrain_status,
            hard_constraints_passed=passed_hc,
            hard_constraints_failed=failed_hc,
            hard_constraints_indeterminate=indet_hc,
            total_hard_constraints=total_hc,
            extracted_metrics=extracted,
            hard_constraint_verdicts=hard_verdicts,
            missing_metrics=missing_metrics,
            data_completeness_pct=data_completeness,
            provenance=provenance,
            warnings=warnings,
        )

    # -------------------------------------------------------------------------
    # Preference Validation & Normalization Engine
    # -------------------------------------------------------------------------
    def _validate_preference_model(self, model: PreferenceModelConfig):
        """
        Validates preference weights and reference/target normalization bounds.
        Rejects non-finite bounds, inverted bounds (R_max < R_min or T_max < T_min),
        negative weights, and zero total weight.
        """
        enabled_criteria = [c for c in model.criteria if c.enabled]
        if not enabled_criteria:
            raise ValueError("Preference configuration must have at least one enabled criterion.")

        for c in model.criteria:
            if c.weight < 0.0:
                raise ValueError(f"Criterion '{c.name}' has invalid negative weight ({c.weight}).")

            # Check finite reference bounds
            if c.reference_min is not None:
                if not math.isfinite(c.reference_min):
                    raise ValueError(f"Criterion '{c.name}' has non-finite reference_min: {c.reference_min}")
            if c.reference_max is not None:
                if not math.isfinite(c.reference_max):
                    raise ValueError(f"Criterion '{c.name}' has non-finite reference_max: {c.reference_max}")

            if c.reference_min is not None and c.reference_max is not None:
                if c.reference_max < c.reference_min:
                    raise ValueError(
                        f"Criterion '{c.name}' has invalid reference bounds: "
                        f"reference_max ({c.reference_max}) < reference_min ({c.reference_min})."
                    )

            # Check target range bounds
            if c.target_min is not None:
                if not math.isfinite(c.target_min):
                    raise ValueError(f"Criterion '{c.name}' has non-finite target_min: {c.target_min}")
            if c.target_max is not None:
                if not math.isfinite(c.target_max):
                    raise ValueError(f"Criterion '{c.name}' has non-finite target_max: {c.target_max}")

            if c.target_min is not None and c.target_max is not None:
                if c.target_max < c.target_min:
                    raise ValueError(
                        f"Criterion '{c.name}' has invalid target bounds: "
                        f"target_max ({c.target_max}) < target_min ({c.target_min})."
                    )

        total_enabled_weight = sum(c.weight for c in enabled_criteria)
        if total_enabled_weight <= 0.0:
            raise ValueError("Enabled preferences must have a positive total weight (> 0.0).")

    def normalize_single_metric(
        self,
        raw_val: Optional[float],
        crit: PreferenceCriterionConfig,
    ) -> Tuple[Optional[float], str, Optional[str]]:
        """
        Normalizes a raw physical measurement onto [0.0, 1.0].
        Returns (normalized_value, formula_string, note).
        Rejects inverted bounds (R_max < R_min or T_max < T_min) with explicit ValueError.
        Handles R_max == R_min as a documented constant-range case.
        """
        if raw_val is None or math.isnan(raw_val):
            return None, "UNAVAILABLE: No measured value", "Measurement unavailable"

        # 1. Target-range Metric
        if crit.direction == PreferenceDirection.TARGET_RANGE:
            t_min = crit.target_min if crit.target_min is not None else crit.reference_min
            t_max = crit.target_max if crit.target_max is not None else crit.reference_max

            if t_min is None or t_max is None:
                return None, "UNAVAILABLE: Missing target range bounds", "Target bounds not configured"

            if t_max < t_min:
                raise ValueError(
                    f"Invalid target range for '{crit.name}': target_max ({t_max}) < target_min ({t_min})."
                )

            # Binary in-range / out-of-range behavior with documented limitation
            if t_min <= raw_val <= t_max:
                formula = f"Within target range [{t_min:.2f}, {t_max:.2f}] {crit.unit} -> 1.0"
                note = "Target interval satisfied (binary in-range = 1.0)"
                return 1.0, formula, note
            else:
                formula = f"Outside target range [{t_min:.2f}, {t_max:.2f}] {crit.unit} ({raw_val:.2f}) -> 0.0"
                note = "Outside target interval (binary out-of-range = 0.0)"
                return 0.0, formula, note

        # 2. Min-Max Metrics (HIGHER_IS_BETTER, LOWER_IS_BETTER)
        r_min = crit.reference_min
        r_max = crit.reference_max

        if r_min is None or r_max is None:
            return None, "UNAVAILABLE: Missing reference range bounds", "Reference bounds not configured"

        # Explicitly reject inverted range
        if r_max < r_min:
            raise ValueError(
                f"Invalid reference range for '{crit.name}': reference_max ({r_max}) < reference_min ({r_min})."
            )

        # Safely handle documented constant range
        if r_max == r_min:
            if abs(raw_val - r_min) < 1e-9:
                return 1.0, f"Constant reference bound ({r_min:.2f} {crit.unit}): matched exact value", "Constant reference value matched"
            else:
                return 0.0, f"Constant reference bound ({r_min:.2f} {crit.unit}): does not match ({raw_val:.2f} != {r_min:.2f})", "Constant reference value not matched"

        if crit.direction == PreferenceDirection.HIGHER_IS_BETTER:
            # Benefit Metric
            norm_raw = (raw_val - r_min) / (r_max - r_min)
            clamped = max(0.0, min(1.0, norm_raw))
            formula = f"min(1.0, max(0.0, ({raw_val:.2f} - {r_min:.2f}) / ({r_max:.2f} - {r_min:.2f})))"
            note = "Clamped to bounds" if (norm_raw < 0.0 or norm_raw > 1.0) else "Linear benefit scaling"
            return round(clamped, 4), formula, note

        elif crit.direction == PreferenceDirection.LOWER_IS_BETTER:
            # Cost Metric
            norm_raw = (r_max - raw_val) / (r_max - r_min)
            clamped = max(0.0, min(1.0, norm_raw))
            formula = f"min(1.0, max(0.0, ({r_max:.2f} - {raw_val:.2f}) / ({r_max:.2f} - {r_min:.2f})))"
            note = "Clamped to bounds" if (norm_raw < 0.0 or norm_raw > 1.0) else "Linear cost scaling"
            return round(clamped, 4), formula, note

        return None, "UNSUPPORTED: Unknown preference direction", "Unsupported direction"

    # -------------------------------------------------------------------------
    # Multi-Criteria Scoring & Pareto Dominance
    # -------------------------------------------------------------------------
    def _execute_analysis(
        self,
        alternatives: List[MissionAlternativeRecord],
        pref_model: PreferenceModelConfig,
    ) -> Tuple[Dict[str, AlternativeScoreBreakdown], Dict[str, AlternativeParetoResult]]:
        """
        Executes normalized composite preference scoring and Pareto frontier analysis.
        """
        enabled_criteria = [c for c in pref_model.criteria if c.enabled]
        total_enabled_raw_weight = sum(c.weight for c in enabled_criteria)

        # 1. Compute Normalized Weights (sum to 1.0)
        norm_weights: Dict[str, float] = {}
        for c in enabled_criteria:
            norm_weights[c.id] = c.weight / total_enabled_raw_weight

        # 2. Score Each Alternative
        scores: Dict[str, AlternativeScoreBreakdown] = {}

        for alt in alternatives:
            norm_metrics: List[AlternativeNormalizedMetric] = []
            available_weight = 0.0
            score_sum = 0.0
            has_missing = False

            for c in enabled_criteria:
                raw_v = alt.extracted_metrics.get(c.metric_key)
                norm_v, formula, note = self.normalize_single_metric(raw_v, c)

                w_norm = norm_weights[c.id]
                contribution = None

                if norm_v is not None:
                    available_weight += w_norm
                    contribution = round(w_norm * norm_v * 100.0, 2)
                    score_sum += contribution
                else:
                    has_missing = True

                norm_metrics.append(
                    AlternativeNormalizedMetric(
                        criterion_id=c.id,
                        criterion_name=c.name,
                        raw_value=raw_v,
                        unit=c.unit,
                        direction=c.direction,
                        reference_min=c.reference_min if c.reference_min is not None else 0.0,
                        reference_max=c.reference_max if c.reference_max is not None else 1.0,
                        normalized_value=norm_v,
                        normalized_weight=round(w_norm, 4),
                        score_contribution=contribution,
                        formula_str=formula,
                        is_available=norm_v is not None,
                        note=note,
                    )
                )

            is_complete = (available_weight >= 0.9999) and not has_missing
            score_status = "COMPLETE" if is_complete else "INCOMPLETE"
            composite_score = round(score_sum, 2)

            limitations = []
            if not is_complete:
                limitations.append(
                    f"Incomplete score: evaluates only {available_weight * 100.0:.1f}% of configured preference weight. "
                    f"Not directly comparable to alternatives with 100% data completeness."
                )

            if alt.hard_constraint_status == OverallCandidateStatus.NON_COMPLIANT:
                limitations.append(
                    "Alternative violates one or more active hard constraints. "
                    "A high soft-preference score does NOT make this alternative acceptable."
                )
            elif alt.hard_constraint_status == OverallCandidateStatus.INDETERMINATE:
                limitations.append(
                    "Alternative has indeterminate or unverified hard constraints due to partial DEM coverage or missing assessment."
                )

            explanation = (
                f"Composite score: {composite_score:.2f} / 100.0 (Status: {score_status}, "
                f"Evaluated Weight: {available_weight * 100.0:.1f}%)."
            )

            scores[alt.id] = AlternativeScoreBreakdown(
                alternative_id=alt.id,
                alternative_name=alt.name,
                composite_score=composite_score,
                score_status=score_status,
                available_weight_fraction=round(available_weight, 4),
                ranking_eligibility="ELIGIBLE",
                eligible_rank=None,
                ineligibility_reason=None,
                normalized_metrics=norm_metrics,
                explanation=explanation,
                limitations=limitations,
            )

        # 3. Determine Ranking Eligibility and Assign Eligible Ranks
        for alt in alternatives:
            s_break = scores[alt.id]
            is_complete = (s_break.score_status == "COMPLETE")

            if alt.hard_constraint_status == OverallCandidateStatus.NON_COMPLIANT:
                s_break.ranking_eligibility = "INELIGIBLE_NON_COMPLIANT"
                s_break.ineligibility_reason = (
                    f"Violates {alt.hard_constraints_failed} hard constraint(s). "
                    "Non-compliant alternatives must never be ranked or recommended."
                )
            elif alt.hard_constraint_status == OverallCandidateStatus.INDETERMINATE:
                s_break.ranking_eligibility = "INELIGIBLE_INDETERMINATE"
                s_break.ineligibility_reason = (
                    "Hard constraints are indeterminate or unverified. "
                    "Cannot be certified as compliant."
                )
            elif not is_complete:
                s_break.ranking_eligibility = "INELIGIBLE_INCOMPLETE_SCORE"
                s_break.ineligibility_reason = (
                    f"Incomplete preference score ({s_break.available_weight_fraction * 100.0:.1f}% evaluated). "
                    "Incomplete scores must never be ranked directly against complete scores."
                )
            else:
                s_break.ranking_eligibility = "ELIGIBLE"
                s_break.ineligibility_reason = None

        # Sort and rank ONLY eligible alternatives
        eligible_alts = [
            alt for alt in alternatives
            if scores[alt.id].ranking_eligibility == "ELIGIBLE"
        ]
        eligible_alts.sort(key=lambda a: scores[a.id].composite_score, reverse=True)
        for rank_idx, alt in enumerate(eligible_alts):
            scores[alt.id].eligible_rank = rank_idx + 1

        # 4. Pareto Dominance Analysis
        pareto_results = self._compute_pareto_dominance(alternatives, scores, enabled_criteria)

        return scores, pareto_results

    def _compute_pareto_dominance(
        self,
        alternatives: List[MissionAlternativeRecord],
        scores: Dict[str, AlternativeScoreBreakdown],
        enabled_criteria: List[PreferenceCriterionConfig],
    ) -> Dict[str, AlternativeParetoResult]:
        """
        Computes strict pairwise Pareto dominance across enabled preference criteria.
        Alternative A dominates B (A > B) iff:
        - For all enabled dimensions: A is at least as good as B (n_A >= n_B - eps)
        - For at least one dimension: A is strictly better than B (n_A > n_B + eps)

        Rules:
        - Only compare alternatives where all active criteria are measured.
        - If missing data prevents establishing dominance or non-dominance, assign INCOMPARABLE_INCOMPLETE.
        - Never substitute missing measurements with zero or arbitrary values.
        - Explain which criteria established dominance for each dominating alternative.
        - Equal alternatives tie without dominating each other.
        """
        eps = 1e-4
        pareto: Dict[str, AlternativeParetoResult] = {}

        # Prepare normalized value vectors: alt_id -> {crit_id: float or None}
        vectors: Dict[str, Dict[str, Optional[float]]] = {}
        has_incomplete: Dict[str, bool] = {}

        for alt in alternatives:
            s_break = scores.get(alt.id)
            alt_map: Dict[str, Optional[float]] = {}
            incomplete = False

            if s_break:
                for nm in s_break.normalized_metrics:
                    alt_map[nm.criterion_id] = nm.normalized_value
                    if nm.normalized_value is None:
                        incomplete = True
            else:
                incomplete = True

            vectors[alt.id] = alt_map
            has_incomplete[alt.id] = incomplete

        # Pairwise dominance checks
        dominated_by_map: Dict[str, List[str]] = {alt.id: [] for alt in alternatives}
        dominates_map: Dict[str, List[str]] = {alt.id: [] for alt in alternatives}
        dominating_criteria_by_alt: Dict[str, Dict[str, List[str]]] = {alt.id: {} for alt in alternatives}

        for a in alternatives:
            # An alternative with incomplete data cannot participate in definitive pairwise dominance proofs
            if has_incomplete[a.id]:
                continue

            for b in alternatives:
                if a.id == b.id:
                    continue

                if has_incomplete[b.id]:
                    continue

                vec_a = vectors[a.id]
                vec_b = vectors[b.id]

                # Test if A dominates B across all enabled criteria
                all_ge = True
                strictly_better = False
                dom_crits: List[str] = []

                for c in enabled_criteria:
                    val_a = vec_a[c.id]
                    val_b = vec_b[c.id]

                    if val_a is None or val_b is None:
                        all_ge = False
                        break

                    if val_a < val_b - eps:
                        all_ge = False
                        break
                    if val_a > val_b + eps:
                        strictly_better = True
                        dom_crits.append(
                            f"{c.name}: normalized {val_a:.2f} vs {val_b:.2f} (+{(val_a - val_b):.2f})"
                        )

                if all_ge and strictly_better:
                    dominates_map[a.id].append(b.id)
                    dominated_by_map[b.id].append(a.id)
                    dominating_criteria_by_alt[b.id][a.id] = dom_crits

        # Assemble Pareto results
        for alt in alternatives:
            dom_by = dominated_by_map[alt.id]
            doms = dominates_map[alt.id]
            dom_crits_map = dominating_criteria_by_alt[alt.id]

            if has_incomplete[alt.id]:
                status = ParetoDominanceStatus.INCOMPARABLE_INCOMPLETE
                explanation = (
                    "Incomplete measurements prevent definitive Pareto dominance classification. "
                    "Cannot establish dominance or non-dominance without full measurement coverage."
                )
                is_fully_comparable = False
            elif len(dom_by) == 0:
                status = ParetoDominanceStatus.PARETO_OPTIMAL
                is_fully_comparable = True

                # Check for ties on all dimensions
                vec_alt = vectors[alt.id]
                tied_with = [
                    b.id for b in alternatives
                    if b.id != alt.id and not has_incomplete[b.id] and all(
                        abs(vec_alt[c.id] - vectors[b.id][c.id]) <= eps for c in enabled_criteria
                    )
                ]

                if tied_with:
                    explanation = (
                        f"Non-dominated alternative on the Pareto frontier. Tied on all enabled criteria with "
                        f"{', '.join(tied_with)} (neither dominates the other). Dominates {len(doms)} alternative(s)."
                    )
                else:
                    explanation = (
                        f"Non-dominated alternative on the Pareto frontier. No other evaluated alternative "
                        f"is strictly superior across all enabled criteria. (Dominates {len(doms)} alternative(s))."
                    )
            else:
                status = ParetoDominanceStatus.DOMINATED
                is_fully_comparable = True
                dom_details = []
                for dom_id, crits in dom_crits_map.items():
                    dom_details.append(f"{dom_id} via [{'; '.join(crits)}]")
                explanation = (
                    f"Strictly dominated by {len(dom_by)} alternative(s): {', '.join(dom_by)}. "
                    f"Superior dimensions: {' | '.join(dom_details)}."
                )

            pareto[alt.id] = AlternativeParetoResult(
                alternative_id=alt.id,
                status=status,
                dominated_by=dom_by,
                dominates=doms,
                dominating_criteria_by_alternative=dom_crits_map,
                is_fully_comparable=is_fully_comparable,
                explanation=explanation,
            )

        return pareto

    # -------------------------------------------------------------------------
    # Sensitivity Analysis Engine
    # -------------------------------------------------------------------------
    def _execute_sensitivity(
        self,
        study_id: str,
        alternatives: List[MissionAlternativeRecord],
        base_model: PreferenceModelConfig,
    ) -> SensitivityAnalysisResponse:
        """
        Executes a deterministic sensitivity analysis across predefined operational priority scenarios.
        Uses exact 70% / 30% weight allocation rules.
        Ranks ONLY compliant and complete alternatives; non-compliant or incomplete alternatives
        are never presented as winners or ranked against complete alternatives.
        """
        enabled = [c for c in base_model.criteria if c.enabled]
        if not enabled or not alternatives:
            return SensitivityAnalysisResponse(
                study_id=study_id,
                current_leader_id=None,
                has_eligible_leader=False,
                tested_scenarios=[],
                leader_stability={},
                robust_alternatives=[],
                summary_notes=["No enabled criteria or alternatives available for sensitivity analysis."],
            )

        # 1. Build Predefined Sensitivity Scenarios with exact distribution rules
        solar_w, solar_warn = self._build_category_priority_weights(enabled, "solar", 0.70)
        earth_w, earth_warn = self._build_category_priority_weights(enabled, "earth", 0.70)
        terrain_w, terrain_warn = self._build_category_priority_weights(enabled, "terrain", 0.70)
        darkness_w, darkness_warn = self._build_criterion_priority_weights(enabled, "pref-longest-darkness", 0.70)

        scenarios_defs = [
            (
                "scen-current",
                "Current User Configuration",
                "User-selected preference weights.",
                {c.id: c.weight for c in enabled},
                True,
                None,
            ),
            (
                "scen-equal",
                "Equal Weights Baseline",
                f"Balanced 1/K ({1.0 / len(enabled):.4f}) weight across all {len(enabled)} enabled criteria.",
                {c.id: 1.0 for c in enabled},
                True,
                None,
            ),
            (
                "scen-solar",
                "Solar Illumination Priority",
                "70% weight distributed equally among enabled solar illumination criteria; 30% among remaining criteria.",
                solar_w,
                solar_w is not None,
                solar_warn,
            ),
            (
                "scen-earth",
                "Earth Communications Priority",
                "70% weight distributed equally among enabled Earth visibility criteria; 30% among remaining criteria.",
                earth_w,
                earth_w is not None,
                earth_warn,
            ),
            (
                "scen-terrain",
                "Terrain Safety Priority",
                "70% weight distributed equally among enabled terrain criteria; 30% among remaining criteria.",
                terrain_w,
                terrain_w is not None,
                terrain_warn,
            ),
            (
                "scen-darkness",
                "Darkness Minimization Priority",
                "70% weight allocated to longest continuous darkness; 30% distributed among remaining criteria.",
                darkness_w,
                darkness_w is not None,
                darkness_warn,
            ),
        ]

        tested_results: List[SensitivityScenarioResult] = []
        leader_counts: Dict[str, int] = {alt.id: 0 for alt in alternatives}
        top2_counts: Dict[str, int] = {alt.id: 0 for alt in alternatives}

        current_leader_id: Optional[str] = None
        has_eligible_leader = False
        available_scenario_count = 0

        for s_idx, (scen_id, scen_name, scen_desc, raw_w_dict, is_avail, warn_msg) in enumerate(scenarios_defs):
            if not is_avail or not raw_w_dict:
                tested_results.append(
                    SensitivityScenarioResult(
                        scenario_id=scen_id,
                        scenario_name=scen_name,
                        scenario_description=scen_desc,
                        is_available=False,
                        warning=warn_msg or "Priority criteria not enabled in preference model.",
                        weights={},
                        scores={},
                        rankings={},
                        eligible_rankings={},
                        ineligibility_reasons={
                            alt.id: "Scenario unavailable" for alt in alternatives
                        },
                        leading_alternative_id=None,
                        leading_alternative_name="Unavailable (priority criteria disabled)",
                    )
                )
                continue

            available_scenario_count += 1

            # Create synthetic preference model for this scenario
            scen_criteria = []
            for c in base_model.criteria:
                copy_c = c.model_copy()
                if c.enabled and c.id in raw_w_dict:
                    copy_c.weight = max(0.0001, raw_w_dict[c.id])
                scen_criteria.append(copy_c)
            scen_model = PreferenceModelConfig(criteria=scen_criteria, version=base_model.version)

            # Re-score alternatives
            scen_scores, _ = self._execute_analysis(alternatives, scen_model)

            scores_map = {alt.id: scen_scores[alt.id].composite_score for alt in alternatives}

            # Raw score order for reference
            raw_sorted = sorted(alternatives, key=lambda a: scores_map[a.id], reverse=True)
            raw_rankings = {a.id: rank + 1 for rank, a in enumerate(raw_sorted)}

            # Official Ranking: Rank ONLY ELIGIBLE ALTERNATIVES (Compliant + Complete)
            eligible_alts = [
                a for a in alternatives
                if a.hard_constraint_status == OverallCandidateStatus.COMPLIANT
                and scen_scores[a.id].score_status == "COMPLETE"
            ]
            eligible_alts.sort(key=lambda a: scores_map[a.id], reverse=True)

            eligible_rankings: Dict[str, Optional[int]] = {}
            ineligibility_reasons: Dict[str, str] = {}

            for a in alternatives:
                s_stat = scen_scores[a.id].score_status
                if a.hard_constraint_status == OverallCandidateStatus.NON_COMPLIANT:
                    eligible_rankings[a.id] = None
                    ineligibility_reasons[a.id] = f"NON_COMPLIANT ({a.hard_constraints_failed} hard constraint failed)"
                elif a.hard_constraint_status == OverallCandidateStatus.INDETERMINATE:
                    eligible_rankings[a.id] = None
                    ineligibility_reasons[a.id] = "INDETERMINATE (unverified constraint coverage)"
                elif s_stat != "COMPLETE":
                    eligible_rankings[a.id] = None
                    ineligibility_reasons[a.id] = f"INCOMPLETE_SCORE (evaluates only {scen_scores[a.id].available_weight_fraction * 100:.0f}% of weight)"
                else:
                    eligible_rankings[a.id] = eligible_alts.index(a) + 1

            if eligible_alts:
                leader = eligible_alts[0]
                leading_id = leader.id
                leading_name = leader.name
                leader_counts[leader.id] += 1

                for a in eligible_alts[:2]:
                    top2_counts[a.id] += 1
            else:
                leading_id = None
                leading_name = "No eligible complete alternative"

            if s_idx == 0:
                current_leader_id = leading_id
                has_eligible_leader = (leading_id is not None)

            tested_results.append(
                SensitivityScenarioResult(
                    scenario_id=scen_id,
                    scenario_name=scen_name,
                    scenario_description=scen_desc,
                    is_available=True,
                    warning=None,
                    weights=raw_w_dict,
                    scores=scores_map,
                    rankings=raw_rankings,
                    eligible_rankings=eligible_rankings,
                    ineligibility_reasons=ineligibility_reasons,
                    leading_alternative_id=leading_id,
                    leading_alternative_name=leading_name,
                )
            )

        denom = max(1, available_scenario_count)
        stability = {alt_id: round((count / denom) * 100.0, 1) for alt_id, count in leader_counts.items() if count > 0}
        robust = [alt_id for alt_id, count in top2_counts.items() if (count / denom) >= 0.60]

        summary_notes = [
            f"Evaluated {available_scenario_count} available deterministic sensitivity scenarios (70% priority / 30% remainder).",
        ]
        if has_eligible_leader and current_leader_id:
            summary_notes.append(
                f"Leading eligible alternative under current configuration: '{current_leader_id}' "
                f"(Stability: {stability.get(current_leader_id, 0.0)}% across available priority scenarios)."
            )
        else:
            summary_notes.append(
                "Notice: No candidate alternative satisfies both 100% hard-constraint compliance and 100% "
                "preference score completeness. No eligible complete ranking can be produced."
            )

        if robust:
            summary_notes.append(f"Robust eligible alternatives (ranked top-2 in >= 60% of scenarios): {', '.join(robust)}.")
        else:
            summary_notes.append("No alternative maintained top-2 ranking in >= 60% of sensitivity scenarios.")

        summary_notes.append(
            "Sensitivity analysis tests discrete priority models; it does not replace operational risk evaluation."
        )

        return SensitivityAnalysisResponse(
            study_id=study_id,
            current_leader_id=current_leader_id,
            has_eligible_leader=has_eligible_leader,
            tested_scenarios=tested_results,
            leader_stability=stability,
            robust_alternatives=robust,
            summary_notes=summary_notes,
        )

    def _build_category_priority_weights(
        self,
        enabled_criteria: List[PreferenceCriterionConfig],
        target_category: str,
        priority_fraction: float,
    ) -> Tuple[Optional[Dict[str, float]], Optional[str]]:
        """
        Allocates priority_fraction equally among enabled criteria matching target_category,
        and (1.0 - priority_fraction) equally among other enabled criteria.
        Returns (weights_dict, warning). If target_category has no enabled criteria, returns (None, warning).
        """
        # For solar category, exclude longest-darkness which has its own dedicated priority scheme
        if target_category == "solar":
            target_crits = [c for c in enabled_criteria if c.category == "solar" and c.id != "pref-longest-darkness"]
        else:
            target_crits = [c for c in enabled_criteria if c.category == target_category]

        other_crits = [c for c in enabled_criteria if c not in target_crits]

        if not target_crits:
            return None, f"No enabled criteria found for priority category '{target_category}'."

        weights: Dict[str, float] = {}

        if not other_crits:
            w_each = 1.0 / len(target_crits)
            for c in target_crits:
                weights[c.id] = round(w_each, 4)
            return weights, None

        w_target_each = priority_fraction / len(target_crits)
        w_other_each = (1.0 - priority_fraction) / len(other_crits)

        for c in target_crits:
            weights[c.id] = round(w_target_each, 4)
        for c in other_crits:
            weights[c.id] = round(w_other_each, 4)

        return weights, None

    def _build_criterion_priority_weights(
        self,
        enabled_criteria: List[PreferenceCriterionConfig],
        target_criterion_id: str,
        priority_fraction: float,
    ) -> Tuple[Optional[Dict[str, float]], Optional[str]]:
        """
        Allocates priority_fraction to a specific criterion, and (1.0 - priority_fraction)
        equally among other enabled criteria.
        Returns (weights_dict, warning). If criterion is not enabled, returns (None, warning).
        """
        matching = [c for c in enabled_criteria if c.id == target_criterion_id]
        if not matching:
            return None, f"Priority criterion '{target_criterion_id}' is not enabled in preference configuration."

        other_crits = [c for c in enabled_criteria if c.id != target_criterion_id]
        weights: Dict[str, float] = {}

        if not other_crits:
            weights[target_criterion_id] = 1.0
            return weights, None

        weights[target_criterion_id] = round(priority_fraction, 4)
        w_other_each = (1.0 - priority_fraction) / len(other_crits)
        for c in other_crits:
            weights[c.id] = round(w_other_each, 4)

        return weights, None

    # -------------------------------------------------------------------------
    # CSV / JSON Export Engine
    # -------------------------------------------------------------------------
    def export_csv(self, study_id: str) -> str:
        """Exports a comprehensive comparison matrix as standard CSV string."""
        with self._lock:
            study = self._studies.get(study_id)
            if not study:
                raise KeyError(f"Trade-off study '{study_id}' not found.")

            output = io.StringIO()
            writer = csv.writer(output)

            # Metadata header
            writer.writerow(["# LUNAVISTA Mission Trade-off Analysis Comparison Matrix"])
            writer.writerow(["# Study ID", study.id])
            writer.writerow(["# Study Name", study.name])
            writer.writerow(["# Mission Profile", f"{study.profile_name} (v{study.profile_version})"])
            writer.writerow(["# Nominal Duration", f"{study.nominal_duration_days} days"])
            writer.writerow(["# Analysis Timestamp", study.analysis_timestamp_iso or "N/A"])
            writer.writerow([])

            # Table Header
            headers = [
                "Alternative ID",
                "Alternative Name",
                "Candidate Site",
                "Latitude (deg)",
                "Longitude (deg)",
                "Start Epoch (UTC)",
                "End Epoch (UTC)",
                "Hard Constraint Status",
                "Passed / Total HC",
                "Ranking Eligibility",
                "Eligible Rank",
                "Data Completeness (%)",
                "Composite Score (0-100)",
                "Score Status",
                "Evaluated Weight (%)",
                "Pareto Status",
                "Dominating Alternatives",
                "Dominating Dimensions",
                "Total Sunlight (h)",
                "Full Sunlight (h)",
                "Longest Darkness (h)",
                "Earth Direct Visibility (h)",
                "Longest Earth Blackout (h)",
                "Local Slope (deg)",
                "Surface Elevation (m)",
            ]
            writer.writerow(headers)

            for alt in study.alternatives:
                sc = study.scores.get(alt.id)
                par = study.pareto_results.get(alt.id)

                dom_alts = ", ".join(par.dominated_by) if par and par.dominated_by else "None"
                dom_details = []
                if par and par.dominating_criteria_by_alternative:
                    for d_id, crits in par.dominating_criteria_by_alternative.items():
                        dom_details.append(f"{d_id}: [{'; '.join(crits)}]")
                dom_dims_str = " | ".join(dom_details) if dom_details else "None"

                row = [
                    alt.id,
                    alt.name,
                    f"{alt.candidate_name} ({alt.site_id})",
                    round(alt.latitude, 4),
                    round(alt.longitude, 4),
                    alt.start_timestamp_iso,
                    alt.end_timestamp_iso,
                    alt.hard_constraint_status.value,
                    f"{alt.hard_constraints_passed} / {alt.total_hard_constraints}",
                    sc.ranking_eligibility if sc else "N/A",
                    sc.eligible_rank if (sc and sc.eligible_rank is not None) else "Unranked (Ineligible)",
                    alt.data_completeness_pct,
                    sc.composite_score if sc else "N/A",
                    sc.score_status if sc else "N/A",
                    f"{sc.available_weight_fraction * 100:.1f}%" if sc else "N/A",
                    par.status.value if par else "N/A",
                    dom_alts,
                    dom_dims_str,
                    alt.extracted_metrics.get("total_sunlight_hours", "N/A"),
                    alt.extracted_metrics.get("full_sunlight_hours", "N/A"),
                    alt.extracted_metrics.get("longest_darkness_hours", "N/A"),
                    alt.extracted_metrics.get("total_earth_visible_hours", "N/A"),
                    alt.extracted_metrics.get("longest_earth_blackout_hours", "N/A"),
                    alt.extracted_metrics.get("local_slope_deg", "N/A"),
                    alt.extracted_metrics.get("surface_elevation_m", "N/A"),
                ]
                writer.writerow(row)

            writer.writerow([])
            writer.writerow(["# Mandatory Scientific Disclaimers"])
            for d in MANDATORY_SCIENTIFIC_DISCLAIMERS:
                writer.writerow(["#", d])

            return output.getvalue()


# Global Singleton Service
trade_off_service = TradeOffService()
