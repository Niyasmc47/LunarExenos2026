import os
import io
import csv
import json
import uuid
import math
import shutil
import tempfile
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

from app.schemas.screening import (
    ScreeningVerdict,
    OverallCandidateStatus,
    DataCoverageStatus,
    RequirementEvaluationResult,
    SoftPreferenceItem,
    InformationalMetricItem,
    CandidateScreeningSummary,
    ScreeningRunRecord,
    CandidateScreeningRequest,
)
from app.schemas.mission_profile import (
    MissionProfile,
    RequirementClassification,
    SingleRequirement,
)
from app.schemas.visibility import (
    VisibilityAnalysisRequest,
    VisibilityAnalysisResponse,
    CoverageCertainty,
)
from app.services.mission_profile_service import MissionProfileService, mission_profile_service
from app.services.scenario_service import ScenarioEngineService, scenario_service
from app.services.visibility_service import VisibilityEngineService, visibility_service
from app.services.dem_loader import dem_loader
from app.services.dataset_catalogue import catalogue_service
from app.services.kernel_manager import kernel_manager

SCREENING_STORAGE_FILE = Path(__file__).resolve().parent.parent.parent / "data" / "screening_runs.json"

class CandidateScreeningService:
    def __init__(
        self,
        storage_path: Optional[Path] = None,
        profile_svc: Optional[MissionProfileService] = None,
        scen_svc: Optional[ScenarioEngineService] = None,
        vis_svc: Optional[VisibilityEngineService] = None,
    ):
        self.storage_file = storage_path or SCREENING_STORAGE_FILE
        self.profile_svc = profile_svc or mission_profile_service
        self.scenario_svc = scen_svc or scenario_service
        self.vis_svc = vis_svc or visibility_service
        self.dem_loader_svc = dem_loader
        self.catalogue_svc = catalogue_service
        self.kernel_mgr = kernel_manager

        self._lock = threading.Lock()
        self._runs: Dict[str, ScreeningRunRecord] = {}
        self._load_from_storage()

    def _load_from_storage(self):
        with self._lock:
            if self.storage_file.exists():
                try:
                    with open(self.storage_file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    loaded = {}
                    for item in data:
                        rec = ScreeningRunRecord.model_validate(item)
                        loaded[rec.id] = rec
                    self._runs = loaded
                    return
                except Exception as e:
                    print(f"[CandidateScreeningService] Failed to load {self.storage_file}: {e}")
                    try:
                        bak = self.storage_file.with_suffix(".corrupt.bak")
                        shutil.copy2(self.storage_file, bak)
                        print(f"[CandidateScreeningService] Quarantined corrupted storage to {bak}")
                    except Exception:
                        pass
            self._runs = {}

    def _save_to_storage_unlocked(self):
        try:
            self.storage_file.parent.mkdir(parents=True, exist_ok=True)
            data = [r.model_dump() for r in self._runs.values()]
            temp_dir = self.storage_file.parent
            with tempfile.NamedTemporaryFile("w", dir=temp_dir, delete=False, encoding="utf-8", suffix=".tmp") as tf:
                json.dump(data, tf, indent=2)
                tf.flush()
                os.fsync(tf.fileno())
                temp_path = Path(tf.name)
            os.replace(temp_path, self.storage_file)
        except Exception as e:
            print(f"[CandidateScreeningService] Warning: Failed to persist runs to {self.storage_file}: {e}")
            if "temp_path" in locals() and temp_path.exists():
                try:
                    temp_path.unlink()
                except OSError:
                    pass

    def list_runs(self) -> List[ScreeningRunRecord]:
        with self._lock:
            return sorted(list(self._runs.values()), key=lambda r: r.created_at_iso, reverse=True)

    def get_run(self, run_id: str) -> Optional[ScreeningRunRecord]:
        with self._lock:
            return self._runs.get(run_id)

    def delete_run(self, run_id: str) -> bool:
        with self._lock:
            if run_id in self._runs:
                del self._runs[run_id]
                self._save_to_storage_unlocked()
                return True
            return False

    def run_screening(self, req: CandidateScreeningRequest) -> ScreeningRunRecord:
        """
        Executes deterministic, evidence-backed candidate screening:
        1. Resolves and freezes a snapshot of the mission profile.
        2. Resolves selected candidate scenarios.
        3. Harmonizes analysis parameters across all candidates.
        4. Evaluates solar, Earth, and terrain requirements using scientific engines.
        5. Assesses data completeness and propagates coverage uncertainty.
        6. Persists the historical screening run record.
        """
        # 1. Resolve Profile
        profile = self.profile_svc.get_profile(req.profile_id)
        if not profile:
            raise KeyError(f"Mission profile '{req.profile_id}' not found.")

        # Deep snapshot of profile to ensure future profile edits do not alter historical screening
        profile_snapshot = profile.model_copy(deep=True)

        # 2. Resolve Scenarios
        if not req.scenario_ids:
            raise ValueError("At least one candidate scenario must be selected for screening.")

        scenarios = []
        for sid in req.scenario_ids:
            sc = self.scenario_svc.get_scenario(sid)
            if not sc:
                raise KeyError(f"Candidate scenario '{sid}' not found.")
            scenarios.append(sc)

        # 3. Determine Harmonized Time and Geometry Parameters
        start_iso = req.override_start_iso or profile_snapshot.start_timestamp_iso
        st = datetime.fromisoformat(start_iso.replace("Z", "+00:00"))

        if req.override_duration_days is not None:
            dur_days = req.override_duration_days
            et = datetime.fromtimestamp(st.timestamp() + dur_days * 86400.0, tz=timezone.utc)
            end_iso = et.isoformat().replace("+00:00", "Z")
        elif req.override_end_iso is not None:
            end_iso = req.override_end_iso
            et = datetime.fromisoformat(end_iso.replace("Z", "+00:00"))
            dur_days = (et - st).total_seconds() / 86400.0
        else:
            dur_days = profile_snapshot.duration_days
            et = datetime.fromtimestamp(st.timestamp() + dur_days * 86400.0, tz=timezone.utc)
            end_iso = et.isoformat().replace("+00:00", "Z")

        total_duration_hours = dur_days * 24.0
        analysis_period_str = f"{start_iso} to {end_iso} ({dur_days:.2f} Earth days / {total_duration_hours:.1f} h)"

        observer_height_m = (
            req.override_observer_height_m
            if req.override_observer_height_m is not None
            else profile_snapshot.observer_height_m
        )
        step_hours = req.step_interval_hours or 2.0
        az_res_deg = req.azimuth_resolution_deg or 2.0
        max_dist_m = req.max_search_distance_m or 5000.0
        aberr_corr = req.aberration_correction or "LT+S"

        calc_config = {
            "step_interval_hours": step_hours,
            "azimuth_resolution_deg": az_res_deg,
            "max_search_distance_m": max_dist_m,
            "aberration_correction": aberr_corr,
            "observer_height_m": observer_height_m,
        }

        # 4. Evaluate each candidate scenario
        candidate_summaries: List[CandidateScreeningSummary] = []

        for sc in scenarios:
            # Determine start and duration for this specific candidate scenario
            if req.override_start_iso is not None:
                cand_start_iso = req.override_start_iso
            elif getattr(sc, "start_timestamp_iso", None):
                cand_start_iso = sc.start_timestamp_iso
            else:
                cand_start_iso = profile_snapshot.start_timestamp_iso

            st = datetime.fromisoformat(cand_start_iso.replace("Z", "+00:00"))

            if req.override_duration_days is not None:
                cand_dur_days = req.override_duration_days
                et = datetime.fromtimestamp(st.timestamp() + cand_dur_days * 86400.0, tz=timezone.utc)
                cand_end_iso = et.isoformat().replace("+00:00", "Z")
            elif req.override_end_iso is not None:
                cand_end_iso = req.override_end_iso
                et = datetime.fromisoformat(cand_end_iso.replace("Z", "+00:00"))
                cand_dur_days = (et - st).total_seconds() / 86400.0
            elif getattr(sc, "start_timestamp_iso", None) and getattr(sc, "end_timestamp_iso", None):
                cand_end_iso = sc.end_timestamp_iso
                et = datetime.fromisoformat(cand_end_iso.replace("Z", "+00:00"))
                cand_dur_days = (et - st).total_seconds() / 86400.0
            else:
                cand_dur_days = profile_snapshot.duration_days
                et = datetime.fromtimestamp(st.timestamp() + cand_dur_days * 86400.0, tz=timezone.utc)
                cand_end_iso = et.isoformat().replace("+00:00", "Z")

            cand_total_duration_hours = cand_dur_days * 24.0
            cand_analysis_period_str = f"{cand_start_iso} to {cand_end_iso} ({cand_dur_days:.2f} Earth days / {cand_total_duration_hours:.1f} h)"

            summary = self._evaluate_single_candidate(
                scenario=sc,
                profile=profile_snapshot,
                start_iso=cand_start_iso,
                end_iso=cand_end_iso,
                dur_days=cand_dur_days,
                observer_height_m=observer_height_m,
                step_hours=step_hours,
                az_res_deg=az_res_deg,
                max_dist_m=max_dist_m,
                aberr_corr=aberr_corr,
                analysis_period_str=cand_analysis_period_str,
            )
            candidate_summaries.append(summary)

        # 5. Overall Summary Aggregation
        total_cand = len(candidate_summaries)
        compliant_count = sum(1 for c in candidate_summaries if c.overall_status == OverallCandidateStatus.COMPLIANT)
        non_compliant_count = sum(1 for c in candidate_summaries if c.overall_status == OverallCandidateStatus.NON_COMPLIANT)
        indeterminate_count = sum(1 for c in candidate_summaries if c.overall_status == OverallCandidateStatus.INDETERMINATE)

        run_id = f"screening-{uuid.uuid4().hex[:8]}"
        run_name = req.name or f"Screening: {profile_snapshot.name} ({len(scenarios)} candidates)"
        now_iso = datetime.now(timezone.utc).isoformat()

        record = ScreeningRunRecord(
            id=run_id,
            name=run_name,
            created_at_iso=now_iso,
            profile_id=profile_snapshot.id,
            profile_name=profile_snapshot.name,
            profile_version=profile_snapshot.version,
            profile_snapshot=profile_snapshot,
            start_timestamp_iso=start_iso,
            end_timestamp_iso=end_iso,
            duration_days=dur_days,
            observer_height_m=observer_height_m,
            calculation_config=calc_config,
            candidates=candidate_summaries,
            overall_summary={
                "total_candidates": total_cand,
                "compliant_candidates": compliant_count,
                "non_compliant_candidates": non_compliant_count,
                "indeterminate_candidates": indeterminate_count,
            },
        )

        with self._lock:
            self._runs[run_id] = record
            self._save_to_storage_unlocked()

        return record

    def _evaluate_single_candidate(
        self,
        scenario: Any,
        profile: MissionProfile,
        start_iso: str,
        end_iso: str,
        dur_days: float,
        observer_height_m: float,
        step_hours: float,
        az_res_deg: float,
        max_dist_m: float,
        aberr_corr: str,
        analysis_period_str: str,
    ) -> CandidateScreeningSummary:
        warnings: List[str] = []
        scientific_disclaimers: List[str] = [
            "Geometric solar illumination does not model photovoltaic panel incidence angle, dust degradation, or electrical conversion efficiency.",
            "Geometric Earth line-of-sight does not evaluate RF telecommunications link budget, DSN ground station schedules, or radio hardware margin.",
            "Local slope and surface elevation alone do not guarantee touchdown safety; sub-pixel boulders and micro-craters are unmodeled.",
            "Starter templates and scenario evaluation are engineering decision-support metrics, not certified NASA flight rules.",
        ]

        # 1. Run Visibility Engine Analysis
        vis_req = VisibilityAnalysisRequest(
            latitude=scenario.latitude,
            longitude=scenario.longitude,
            start_timestamp_iso=start_iso,
            end_timestamp_iso=end_iso,
            step_interval_hours=step_hours,
            observer_height_m=observer_height_m,
            dataset_id=scenario.site_id,
            azimuth_resolution_deg=az_res_deg,
            max_search_distance_m=max_dist_m,
            aberration_correction=aberr_corr,
        )
        vis_resp = self.vis_svc.compute_visibility_analysis(vis_req)
        warnings.extend(vis_resp.warnings)

        # Analysis vs Profile Scope Determination
        analysis_dur_hours = dur_days * 24.0
        profile_dur_hours = profile.duration_days * 24.0
        scope_mismatch = abs(analysis_dur_hours - profile_dur_hours) > 1.0

        if scope_mismatch:
            warnings.append(
                f"Scope mismatch: Mission Profile is configured for {profile.duration_days:.1f} Earth days ({profile_dur_hours:.1f} h), "
                f"while evaluated scenario analysis interval is {dur_days:.1f} Earth days ({analysis_dur_hours:.1f} h). "
                f"Mission-wide cumulative requirements cannot be evaluated over this truncated window."
            )

        # 2. Sample Terrain Point
        pt_sample = self.dem_loader_svc.sample_point(scenario.latitude, scenario.longitude)
        dem_meta = self.dem_loader_svc.get_metadata()
        dataset_rec = self.catalogue_svc.get_by_id(scenario.site_id)

        in_bounds = pt_sample.get("in_bounds", False)
        if not in_bounds:
            warnings.append("Observer point is outside active DEM extent; elevation and slope are unmodeled or indeterminate.")

        # 3. Determine Data Completeness and Coverage
        cov_status_raw = vis_resp.terrain_horizon_summary.coverage_status
        valid_rays = vis_resp.terrain_horizon_summary.valid_samples_count
        total_rays = vis_resp.terrain_horizon_summary.total_azimuths_computed
        has_indeterminate_in_series = any(
            getattr(pt, "sun_visibility_state", None) == "INDETERMINATE"
            or getattr(pt, "earth_visibility_state", None) == "INDETERMINATE"
            for pt in vis_resp.series
        )

        if not in_bounds:
            cov_certainty = "OUT_OF_BOUNDS"
            cov_status = DataCoverageStatus.UNAVAILABLE
        elif has_indeterminate_in_series:
            cov_certainty = "INDETERMINATE_PARTIAL_DEM"
            cov_status = DataCoverageStatus.PARTIAL
        elif cov_status_raw == "complete":
            cov_certainty = "COMPLETE_DEM"
            cov_status = DataCoverageStatus.COMPLETE
        elif cov_status_raw == "partial":
            cov_certainty = "PARTIAL_DEM"
            cov_status = DataCoverageStatus.PARTIAL
        else:
            cov_certainty = "NO_DATA"
            cov_status = DataCoverageStatus.INCOMPATIBLE

        # 4. Calculate Daily Metrics from Visibility Series (non-overlapping 24.0h Earth days)
        daily_sun_res = self._compute_daily_sunlight_metrics(vis_resp.series, start_iso, end_iso, dur_days)
        daily_earth_res = self._compute_daily_earth_metrics(vis_resp.series, start_iso, end_iso, dur_days)

        # 5. Evaluate Requirements
        hard_results: List[RequirementEvaluationResult] = []
        soft_results: List[SoftPreferenceItem] = []
        info_metrics: List[InformationalMetricItem] = []

        is_coverage_indeterminate = (
            cov_certainty in ("INDETERMINATE_PARTIAL_DEM", "OUT_OF_BOUNDS", "NO_DATA")
            or cov_status == DataCoverageStatus.UNAVAILABLE
        )

        req_set = profile.requirements

        # --- Evaluate Solar Requirements ---
        self._eval_requirement(
            req=req_set.solar.min_total_sunlight_hours,
            measured=vis_resp.solar_metrics.total_sun_visible_hours,
            category="solar",
            is_coverage_indeterminate=is_coverage_indeterminate,
            source="Visibility Engine (MVP 5) - Cumulative Illumination Duration",
            analysis_period=analysis_period_str,
            hard_results=hard_results,
            soft_results=soft_results,
            info_metrics=info_metrics,
            analysis_duration_hours=analysis_dur_hours,
            profile_duration_hours=profile_dur_hours,
            scope_mismatch=scope_mismatch,
        )

        self._eval_requirement(
            req=req_set.solar.min_full_sunlight_hours,
            measured=vis_resp.solar_metrics.total_sun_full_hours,
            category="solar",
            is_coverage_indeterminate=is_coverage_indeterminate,
            source="Visibility Engine (MVP 5) - Full Solar Disk Clearance (100% visible)",
            analysis_period=analysis_period_str,
            hard_results=hard_results,
            soft_results=soft_results,
            info_metrics=info_metrics,
            analysis_duration_hours=analysis_dur_hours,
            profile_duration_hours=profile_dur_hours,
            scope_mismatch=scope_mismatch,
        )

        self._eval_requirement(
            req=req_set.solar.max_continuous_darkness_hours,
            measured=vis_resp.solar_metrics.longest_darkness_hours,
            category="solar",
            is_coverage_indeterminate=is_coverage_indeterminate,
            source="Visibility Engine (MVP 5) - Longest Continuous Zero-Illumination Duration",
            analysis_period=analysis_period_str,
            hard_results=hard_results,
            soft_results=soft_results,
            info_metrics=info_metrics,
            analysis_duration_hours=analysis_dur_hours,
            profile_duration_hours=profile_dur_hours,
            scope_mismatch=scope_mismatch,
        )

        self._eval_requirement(
            req=req_set.solar.min_sunlight_percentage,
            measured=vis_resp.solar_metrics.illumination_fraction * 100.0,
            category="solar",
            is_coverage_indeterminate=is_coverage_indeterminate,
            source="Visibility Engine (MVP 5) - Illumination Fraction of Total Duration",
            analysis_period=analysis_period_str,
            hard_results=hard_results,
            soft_results=soft_results,
            info_metrics=info_metrics,
            analysis_duration_hours=analysis_dur_hours,
            profile_duration_hours=profile_dur_hours,
            scope_mismatch=scope_mismatch,
        )

        self._eval_daily_requirement(
            req=req_set.solar.min_daily_sunlight_hours,
            daily_data=daily_sun_res,
            category="solar",
            is_coverage_indeterminate=is_coverage_indeterminate,
            source="Visibility Engine (MVP 5) - 24.0h Earth Day Illumination Time Series",
            analysis_period=analysis_period_str,
            hard_results=hard_results,
            soft_results=soft_results,
            info_metrics=info_metrics,
        )

        # --- Evaluate Earth Visibility Requirements ---
        self._eval_requirement(
            req=req_set.earth.min_total_earth_visible_hours,
            measured=vis_resp.earth_metrics.total_earth_visible_hours,
            category="earth",
            is_coverage_indeterminate=is_coverage_indeterminate,
            source="Visibility Engine (MVP 5) - Geometric Direct-to-Earth Line-of-Sight",
            analysis_period=analysis_period_str,
            hard_results=hard_results,
            soft_results=soft_results,
            info_metrics=info_metrics,
            analysis_duration_hours=analysis_dur_hours,
            profile_duration_hours=profile_dur_hours,
            scope_mismatch=scope_mismatch,
        )

        self._eval_requirement(
            req=req_set.earth.max_continuous_earth_blackout_hours,
            measured=vis_resp.earth_metrics.longest_earth_blackout_hours,
            category="earth",
            is_coverage_indeterminate=is_coverage_indeterminate,
            source="Visibility Engine (MVP 5) - Longest Continuous Earth Line-of-Sight Blackout",
            analysis_period=analysis_period_str,
            hard_results=hard_results,
            soft_results=soft_results,
            info_metrics=info_metrics,
            analysis_duration_hours=analysis_dur_hours,
            profile_duration_hours=profile_dur_hours,
            scope_mismatch=scope_mismatch,
        )

        self._eval_daily_requirement(
            req=req_set.earth.min_daily_earth_visible_hours,
            daily_data=daily_earth_res,
            category="earth",
            is_coverage_indeterminate=is_coverage_indeterminate,
            source="Visibility Engine (MVP 5) - 24.0h Earth Day Communication Window",
            analysis_period=analysis_period_str,
            hard_results=hard_results,
            soft_results=soft_results,
            info_metrics=info_metrics,
        )

        self._eval_requirement(
            req=req_set.earth.min_full_disk_earth_visible_hours,
            measured=vis_resp.earth_metrics.total_earth_full_hours,
            category="earth",
            is_coverage_indeterminate=is_coverage_indeterminate,
            source="Visibility Engine (MVP 5) - 100% Unoccluded Earth Disk Clearance",
            analysis_period=analysis_period_str,
            hard_results=hard_results,
            soft_results=soft_results,
            info_metrics=info_metrics,
            analysis_duration_hours=analysis_dur_hours,
            profile_duration_hours=profile_dur_hours,
            scope_mismatch=scope_mismatch,
        )

        # --- Evaluate Terrain Requirements ---
        actual_slope = pt_sample.get("slope_deg")
        actual_elev = pt_sample.get("elevation_m") if in_bounds else vis_resp.observer_surface_elevation_m

        self._eval_requirement(
            req=req_set.terrain.max_local_slope_deg,
            measured=actual_slope,
            category="terrain",
            is_coverage_indeterminate=(actual_slope is None),
            source="NASA LOLA 5 m DEM (Site 01) - Local Geomorphic Gradient",
            analysis_period=analysis_period_str,
            hard_results=hard_results,
            soft_results=soft_results,
            info_metrics=info_metrics,
        )

        self._eval_requirement(
            req=req_set.terrain.min_elevation_m,
            measured=actual_elev,
            category="terrain",
            is_coverage_indeterminate=(actual_elev is None),
            source="NASA LOLA 5 m DEM (Site 01) - IAU Moon 2000 Sphere Datum",
            analysis_period=analysis_period_str,
            hard_results=hard_results,
            soft_results=soft_results,
            info_metrics=info_metrics,
        )

        self._eval_requirement(
            req=req_set.terrain.max_elevation_m,
            measured=actual_elev,
            category="terrain",
            is_coverage_indeterminate=(actual_elev is None),
            source="NASA LOLA 5 m DEM (Site 01) - IAU Moon 2000 Sphere Datum",
            analysis_period=analysis_period_str,
            hard_results=hard_results,
            soft_results=soft_results,
            info_metrics=info_metrics,
        )

        # Roughness Evaluation (Special handling: not loaded in current DEM product)
        roughness_req = req_set.terrain.max_roughness_factor
        if roughness_req.enabled:
            if roughness_req.classification == RequirementClassification.HARD_CONSTRAINT:
                hard_results.append(RequirementEvaluationResult(
                    requirement_id=roughness_req.id,
                    requirement_name=roughness_req.name,
                    category="terrain",
                    classification=roughness_req.classification,
                    operator=roughness_req.operator,
                    threshold_value=roughness_req.value,
                    threshold_str=f"{roughness_req.operator} {roughness_req.value} {roughness_req.unit}",
                    actual_value=None,
                    actual_value_str="Unavailable",
                    unit=roughness_req.unit,
                    verdict=ScreeningVerdict.INDETERMINATE,
                    explanation="Terrain roughness raster is not loaded for this candidate; metric is scientifically unavailable. Do not substitute slope for roughness.",
                    supporting_data_source="NASA LOLA 5 m Companion Layers (Unloaded)",
                    analysis_period=analysis_period_str,
                ))
            elif roughness_req.classification == RequirementClassification.SOFT_PREFERENCE:
                soft_results.append(SoftPreferenceItem(
                    requirement_id=roughness_req.id,
                    requirement_name=roughness_req.name,
                    category="terrain",
                    operator=roughness_req.operator,
                    threshold_value=roughness_req.value,
                    threshold_str=f"{roughness_req.operator} {roughness_req.value} {roughness_req.unit}",
                    actual_value=None,
                    actual_value_str="Unavailable",
                    unit=roughness_req.unit,
                    is_available=False,
                    notes="Roughness layer unavailable. Slope cannot be substituted for micro-relief roughness.",
                ))
            else:
                info_metrics.append(InformationalMetricItem(
                    id=roughness_req.id,
                    name=roughness_req.name,
                    category="terrain",
                    value=None,
                    value_str="Unavailable",
                    unit=roughness_req.unit,
                    source="NASA LOLA 5 m DEM (Roughness layer unloaded)",
                ))

        grid_res = getattr(dem_meta, "pixel_spacing_m", 5.0) if dem_meta else 5.0
        bounds_dict = dem_meta.bounds_projected.model_dump() if hasattr(dem_meta, "bounds_projected") else None

        # Add Core Informational Metrics
        info_metrics.extend([
            InformationalMetricItem(
                id="latitude",
                name="Observer Latitude",
                category="spatial",
                value=scenario.latitude,
                value_str=f"{scenario.latitude:.4f}°",
                unit="deg",
                source="Scenario Definition",
            ),
            InformationalMetricItem(
                id="longitude",
                name="Observer Longitude",
                category="spatial",
                value=scenario.longitude,
                value_str=f"{scenario.longitude:.4f}°",
                unit="deg",
                source="Scenario Definition",
            ),
            InformationalMetricItem(
                id="surface_elevation",
                name="Surface Elevation",
                category="terrain",
                value=actual_elev,
                value_str=f"{actual_elev:.1f} m" if actual_elev is not None else "N/A",
                unit="m",
                source="NASA LOLA 5 m DEM",
            ),
            InformationalMetricItem(
                id="local_slope",
                name="Local Slope",
                category="terrain",
                value=actual_slope,
                value_str=f"{actual_slope:.1f}°" if actual_slope is not None else "N/A",
                unit="deg",
                source="NASA LOLA 5 m DEM",
            ),
            InformationalMetricItem(
                id="dem_nominal_resolution",
                name="DEM Grid Spacing",
                category="terrain",
                value=grid_res,
                value_str=f"{grid_res:.1f} m/px",
                unit="m/px",
                source="LOLA PDS Metadata",
            ),
            InformationalMetricItem(
                id="total_sunlight_hours",
                name="Total Geometric Sunlight",
                category="solar",
                value=vis_resp.solar_metrics.total_sun_visible_hours,
                value_str=f"{vis_resp.solar_metrics.total_sun_visible_hours:.1f} h",
                unit="hours",
                source="Visibility Engine (MVP 5)",
            ),
            InformationalMetricItem(
                id="total_earth_visible_hours",
                name="Total Earth Line-of-Sight",
                category="earth",
                value=vis_resp.earth_metrics.total_earth_visible_hours,
                value_str=f"{vis_resp.earth_metrics.total_earth_visible_hours:.1f} h",
                unit="hours",
                source="Visibility Engine (MVP 5)",
            ),
            InformationalMetricItem(
                id="horizon_ray_coverage",
                name="Horizon Ray Sampling",
                category="horizon",
                value=f"{valid_rays}/{total_rays}",
                value_str=f"{valid_rays}/{total_rays} valid rays ({(valid_rays/max(1,total_rays))*100:.1f}%)",
                unit="rays",
                source="Terrain Horizon Engine (MVP 3)",
            ),
        ])

        # 6. Overall Candidate Status Determination
        hard_passed = sum(1 for r in hard_results if r.verdict == ScreeningVerdict.PASS)
        hard_failed = sum(1 for r in hard_results if r.verdict == ScreeningVerdict.FAIL)
        hard_indet = sum(1 for r in hard_results if r.verdict == ScreeningVerdict.INDETERMINATE)
        hard_scope_mismatch = sum(1 for r in hard_results if r.verdict == ScreeningVerdict.NOT_EVALUABLE_SCOPE_MISMATCH)
        hard_impossible = sum(1 for r in hard_results if r.verdict == ScreeningVerdict.IMPOSSIBLE_THRESHOLD)
        total_hard = len(hard_results)

        if hard_failed > 0:
            overall_status = OverallCandidateStatus.NON_COMPLIANT
        elif hard_scope_mismatch > 0 or hard_indet > 0 or hard_impossible > 0:
            overall_status = OverallCandidateStatus.INDETERMINATE
        else:
            overall_status = OverallCandidateStatus.COMPLIANT

        # 7. Provenance Metadata
        dem_prov = {
            "dataset_id": scenario.site_id,
            "product_name": dataset_rec.name if dataset_rec else "NASA LOLA 5 m Polar DEM",
            "citation": dataset_rec.citation if dataset_rec else "Barker et al. (2016, 2021)",
            "bounds": bounds_dict,
            "grid_resolution_m": grid_res,
            "vertical_datum": "IAU Moon 2000 Sphere (R = 1,737,400 m)",
        }

        kernel_status = self.kernel_mgr.get_status()
        spice_prov = {
            "spice_toolkit": "CSPICE_N0067 via SpiceyPy",
            "reference_frame": "MOON_ME (Lunar Mean Earth / Polar Axis DE421)",
            "target_observer": "Topocentric Lunar Observer",
            "active_kernels": kernel_status.get("loaded_kernels", []),
            "ephemeris_model": "NASA JPL DE421 (1900-2050)",
        }

        return CandidateScreeningSummary(
            candidate_id=scenario.id,
            candidate_name=scenario.name,
            site_id=scenario.site_id,
            latitude=scenario.latitude,
            longitude=scenario.longitude,
            observer_height_m=observer_height_m,
            surface_elevation_m=actual_elev,
            local_slope_deg=actual_slope,
            overall_status=overall_status,
            hard_constraints_passed=hard_passed,
            hard_constraints_failed=hard_failed,
            hard_constraints_indeterminate=hard_indet,
            hard_constraints_scope_mismatch=hard_scope_mismatch,
            hard_constraints_impossible=hard_impossible,
            total_hard_constraints=total_hard,
            analysis_duration_hours=round(analysis_dur_hours, 2),
            profile_duration_hours=round(profile_dur_hours, 2),
            scope_mismatch_detected=scope_mismatch,
            hard_constraint_results=hard_results,
            soft_preference_results=soft_results,
            informational_metrics=info_metrics,
            coverage_status=cov_status,
            coverage_certainty=cov_certainty,
            valid_ray_count=valid_rays,
            total_ray_count=total_rays,
            dem_provenance=dem_prov,
            spice_provenance=spice_prov,
            warnings=warnings,
            scientific_disclaimers=scientific_disclaimers,
        )

    def _eval_requirement(
        self,
        req: SingleRequirement,
        measured: Optional[float],
        category: str,
        is_coverage_indeterminate: bool,
        source: str,
        analysis_period: str,
        hard_results: List[RequirementEvaluationResult],
        soft_results: List[SoftPreferenceItem],
        info_metrics: List[InformationalMetricItem],
        analysis_duration_hours: float = 72.0,
        profile_duration_hours: float = 72.0,
        scope_mismatch: bool = False,
    ):
        if not req.enabled:
            return

        threshold = req.value
        op = req.operator or "ge"
        unit = req.unit
        crit_str = f"{self._operator_symbol(op)} {threshold} {unit}" if threshold is not None else "Informational"

        if req.classification == RequirementClassification.HARD_CONSTRAINT:
            if measured is None:
                verdict = ScreeningVerdict.INDETERMINATE
                actual_str = "N/A"
                expl = f"Measurement unavailable for {req.name}."
            elif is_coverage_indeterminate and category in ("solar", "earth"):
                verdict = ScreeningVerdict.INDETERMINATE
                actual_str = f"{measured:.1f} {unit}"
                expl = (
                    f"Measured {measured:.1f} {unit}, but candidate has partial DEM coverage with target paths "
                    f"crossing unmodeled external sectors (INDETERMINATE_PARTIAL_DEM). Visibility cannot be certified."
                )
            elif req.id in ("min_total_sunlight_hours", "min_full_sunlight_hours", "min_total_earth_visible_hours", "min_full_disk_earth_visible_hours"):
                actual_str = f"{measured:.1f} {unit}"
                if threshold is not None and threshold > analysis_duration_hours:
                    if scope_mismatch:
                        verdict = ScreeningVerdict.NOT_EVALUABLE_SCOPE_MISMATCH
                        expl = (
                            f"Scope mismatch: Requirement specifies >= {threshold:.1f} {unit} across full mission "
                            f"({profile_duration_hours:.1f} h), but evaluated analysis window is only {analysis_duration_hours:.1f} h. "
                            f"A {analysis_duration_hours:.1f} h window cannot establish whether the candidate meets this mission-wide requirement. "
                            f"This is an interval scope mismatch, not a candidate site failure."
                        )
                    else:
                        verdict = ScreeningVerdict.IMPOSSIBLE_THRESHOLD
                        expl = (
                            f"Impossible threshold: Requirement threshold of {threshold:.1f} {unit} exceeds the entire "
                            f"{analysis_duration_hours:.1f} h analysis duration. This threshold cannot be satisfied by any landing site."
                        )
                elif scope_mismatch and threshold is not None and measured < threshold:
                    verdict = ScreeningVerdict.NOT_EVALUABLE_SCOPE_MISMATCH
                    expl = (
                        f"Scope mismatch: Candidate accumulated {measured:.1f} {unit} during evaluated {analysis_duration_hours:.1f} h window "
                        f"(full mission profile: {profile_duration_hours:.1f} h). A truncated window cannot establish whether the candidate "
                        f"satisfies the >= {threshold:.1f} {unit} mission-wide requirement."
                    )
                else:
                    passed = self._compare_values(measured, op, threshold)
                    if passed:
                        verdict = ScreeningVerdict.PASS
                        expl = f"Observed value of {actual_str} satisfies criterion of {crit_str} (evaluated over {analysis_duration_hours:.1f} h window)."
                    else:
                        verdict = ScreeningVerdict.FAIL
                        expl = f"Observed value of {actual_str} violates mandatory criterion of {crit_str} across evaluated {analysis_duration_hours:.1f} h window."

            elif req.id in ("max_continuous_darkness_hours", "max_continuous_earth_blackout_hours"):
                actual_str = f"{measured:.1f} {unit}"
                passed = self._compare_values(measured, op, threshold)
                if passed:
                    verdict = ScreeningVerdict.PASS
                    expl = f"Longest continuous interval of {actual_str} satisfies maximum limit of {crit_str} over evaluated {analysis_duration_hours:.1f} h window."
                else:
                    verdict = ScreeningVerdict.FAIL
                    expl = f"Longest continuous interval of {actual_str} violates maximum allowable limit of {crit_str} in evaluated window."

            elif req.id == "min_sunlight_percentage":
                actual_str = f"{measured:.1f} {unit}"
                if threshold is not None and threshold > 100.0:
                    verdict = ScreeningVerdict.IMPOSSIBLE_THRESHOLD
                    expl = f"Impossible threshold: Required illumination percentage of {threshold:.1f}% exceeds 100%."
                else:
                    passed = self._compare_values(measured, op, threshold)
                    if passed:
                        verdict = ScreeningVerdict.PASS
                        expl = f"Observed illumination fraction of {actual_str} satisfies criterion of {crit_str}."
                    else:
                        verdict = ScreeningVerdict.FAIL
                        expl = f"Observed illumination fraction of {actual_str} violates criterion of {crit_str}."

            else:
                actual_str = f"{measured:.1f} {unit}"
                passed = self._compare_values(measured, op, threshold)
                if passed:
                    verdict = ScreeningVerdict.PASS
                    expl = f"Observed value of {actual_str} satisfies criterion of {crit_str}."
                else:
                    verdict = ScreeningVerdict.FAIL
                    expl = f"Observed value of {actual_str} violates mandatory criterion of {crit_str}."

            hard_results.append(RequirementEvaluationResult(
                requirement_id=req.id,
                requirement_name=req.name,
                category=category,
                classification=req.classification,
                operator=op,
                threshold_value=threshold,
                threshold_str=crit_str,
                actual_value=measured,
                actual_value_str=actual_str,
                unit=unit,
                verdict=verdict,
                explanation=expl,
                supporting_data_source=source,
                analysis_period=analysis_period,
            ))

        elif req.classification == RequirementClassification.SOFT_PREFERENCE:
            actual_str = f"{measured:.1f} {unit}" if measured is not None else "Unavailable"
            if req.id in ("min_total_sunlight_hours", "min_full_sunlight_hours", "min_total_earth_visible_hours", "min_full_disk_earth_visible_hours") and threshold is not None and threshold > analysis_duration_hours and scope_mismatch:
                note = f"Observed: {actual_str} over {analysis_duration_hours:.1f} h. Preference threshold: {crit_str} across {profile_duration_hours:.1f} h [Scope mismatch: partial evaluation window]."
            else:
                note = f"Observed: {actual_str}. Preference threshold: {crit_str}."
            if is_coverage_indeterminate and category in ("solar", "earth"):
                note += " [Partial DEM uncertainty present]"

            soft_results.append(SoftPreferenceItem(
                requirement_id=req.id,
                requirement_name=req.name,
                category=category,
                operator=op,
                threshold_value=threshold,
                threshold_str=crit_str,
                actual_value=measured,
                actual_value_str=actual_str,
                unit=unit,
                is_available=(measured is not None),
                notes=note,
            ))

        else:  # INFORMATIONAL_METRIC
            actual_str = f"{measured:.1f} {unit}" if measured is not None else "Unavailable"
            info_metrics.append(InformationalMetricItem(
                id=req.id,
                name=req.name,
                category=category,
                value=measured,
                value_str=actual_str,
                unit=unit,
                source=source,
            ))

    def _eval_daily_requirement(
        self,
        req: SingleRequirement,
        daily_data: Dict[str, Any],
        category: str,
        is_coverage_indeterminate: bool,
        source: str,
        analysis_period: str,
        hard_results: List[RequirementEvaluationResult],
        soft_results: List[SoftPreferenceItem],
        info_metrics: List[InformationalMetricItem],
    ):
        if not req.enabled:
            return

        threshold = req.value  # e.g., 6.0 hours/day
        op = req.operator or "ge"
        unit = req.unit
        crit_str = f"{self._operator_symbol(op)} {threshold} {unit}" if threshold is not None else "Informational"

        min_observed_daily = daily_data.get("min_daily_hours")
        day_count = daily_data.get("day_count", 0)
        complete_days_count = daily_data.get("complete_days_count", day_count)
        has_partial_day = daily_data.get("has_partial_day", False)
        complete_hours = daily_data.get("complete_daily_hours_list", daily_data.get("daily_hours_list", []))

        worst_complete = min(complete_hours) if complete_hours else min_observed_daily
        all_complete_passed = (
            all(h >= threshold for h in complete_hours) if (complete_hours and threshold is not None) else True
        )

        if req.classification == RequirementClassification.HARD_CONSTRAINT:
            if min_observed_daily is None or day_count == 0:
                verdict = ScreeningVerdict.INDETERMINATE
                actual_str = "N/A"
                expl = "Daily time-series integration data unavailable."
            elif is_coverage_indeterminate:
                verdict = ScreeningVerdict.INDETERMINATE
                actual_str = f"{worst_complete:.1f} {unit}"
                expl = (
                    f"Minimum daily value was {worst_complete:.1f} {unit}, but unmodeled external terrain "
                    f"creates indeterminate horizon sectors during solar/Earth tracking."
                )
            else:
                actual_str = f"{worst_complete:.1f} {unit} (worst complete day)"
                if all_complete_passed:
                    verdict = ScreeningVerdict.PASS
                    partial_note = f" Final partial day ({daily_data.get('partial_day_hours', 0.0):.1f} h) achieved {daily_data.get('partial_day_sun_hours', 0.0):.1f} h." if has_partial_day else ""
                    expl = (
                        f"All {complete_days_count} complete 24.0h Earth day intervals satisfied requirement "
                        f"(worst observed: {actual_str} vs criterion {crit_str}).{partial_note}"
                    )
                else:
                    verdict = ScreeningVerdict.FAIL
                    first_fail_idx = next((i + 1 for i, h in enumerate(complete_hours) if threshold is not None and h < threshold), 1)
                    first_fail_h = complete_hours[first_fail_idx - 1] if complete_hours else 0.0
                    expl = (
                        f"Day {first_fail_idx} failed daily requirement with only {first_fail_h:.1f} h "
                        f"(required: {crit_str})."
                    )

            hard_results.append(RequirementEvaluationResult(
                requirement_id=req.id,
                requirement_name=req.name,
                category=category,
                classification=req.classification,
                operator=op,
                threshold_value=threshold,
                threshold_str=crit_str,
                actual_value=worst_complete,
                actual_value_str=actual_str,
                unit=unit,
                verdict=verdict,
                explanation=expl,
                supporting_data_source=source,
                analysis_period=analysis_period,
            ))

        elif req.classification == RequirementClassification.SOFT_PREFERENCE:
            actual_str = f"{worst_complete:.1f} {unit}" if worst_complete is not None else "Unavailable"
            partial_note = f" (Partial tail day: {daily_data.get('partial_day_sun_hours', 0.0):.1f} h in {daily_data.get('partial_day_hours', 0.0):.1f} h)" if has_partial_day else ""
            soft_results.append(SoftPreferenceItem(
                requirement_id=req.id,
                requirement_name=req.name,
                category=category,
                operator=op,
                threshold_value=threshold,
                threshold_str=crit_str,
                actual_value=worst_complete,
                actual_value_str=actual_str,
                unit=unit,
                is_available=(worst_complete is not None),
                notes=f"Minimum observed across {complete_days_count} complete Earth days: {actual_str}. Preference: {crit_str}.{partial_note}",
            ))

        else:
            actual_str = f"{worst_complete:.1f} {unit}" if worst_complete is not None else "Unavailable"
            info_metrics.append(InformationalMetricItem(
                id=req.id,
                name=req.name,
                category=category,
                value=worst_complete,
                value_str=actual_str,
                unit=unit,
                source=source,
            ))

    def _compute_daily_sunlight_metrics(
        self, series: List[Any], start_iso: str, end_iso: str, dur_days: float
    ) -> Dict[str, Any]:
        """
        Calculates non-overlapping 24.0-hour Earth day illumination hours.
        Incomplete fractional tail intervals are tracked separately and not counted as 24h days.
        """
        if not series or len(series) < 2:
            return {
                "min_daily_hours": None, "day_count": 0, "complete_days_count": 0,
                "has_partial_day": False, "all_days_passed": True
            }

        st = datetime.fromisoformat(start_iso.replace("Z", "+00:00")).timestamp()
        total_hours = dur_days * 24.0
        n_days = max(1, math.ceil(total_hours / 24.0))

        daily_illum = [0.0] * n_days
        daily_dt = [0.0] * n_days

        for i in range(len(series) - 1):
            pt0 = series[i]
            pt1 = series[i + 1]
            t1 = datetime.fromisoformat(pt0.timestamp_iso.replace("Z", "+00:00")).timestamp()
            t2 = datetime.fromisoformat(pt1.timestamp_iso.replace("Z", "+00:00")).timestamp()
            dt_h = (t2 - t1) / 3600.0
            if dt_h <= 0.0:
                continue

            t_mid = (t1 + t2) / 2.0
            day_idx = min(n_days - 1, max(0, int((t_mid - st) // 86400)))

            daily_dt[day_idx] += dt_h
            if getattr(pt0, "sun_visible_fraction", 0.0) > 0.0 or getattr(pt1, "sun_visible_fraction", 0.0) > 0.0:
                daily_illum[day_idx] += dt_h

        # Separate complete 24h days from partial tail day
        complete_illum = []
        has_partial = False
        partial_dur = 0.0
        partial_sun = 0.0

        for d in range(n_days):
            if daily_dt[d] >= 23.9:
                complete_illum.append(round(daily_illum[d], 2))
            else:
                has_partial = True
                partial_dur = round(daily_dt[d], 2)
                partial_sun = round(daily_illum[d], 2)

        worst_daily = min(daily_illum) if daily_illum else 0.0
        worst_complete = min(complete_illum) if complete_illum else worst_daily

        return {
            "min_daily_hours": round(worst_daily, 2),
            "worst_complete_day_hours": round(worst_complete, 2),
            "day_count": n_days,
            "complete_days_count": len(complete_illum),
            "complete_daily_hours_list": complete_illum,
            "has_partial_day": has_partial,
            "partial_day_hours": partial_dur,
            "partial_day_sun_hours": partial_sun,
            "daily_hours_list": [round(h, 2) for h in daily_illum],
            "all_days_passed": True,
        }

    def _compute_daily_earth_metrics(
        self, series: List[Any], start_iso: str, end_iso: str, dur_days: float
    ) -> Dict[str, Any]:
        """
        Calculates non-overlapping 24.0-hour Earth day line-of-sight hours.
        """
        if not series or len(series) < 2:
            return {
                "min_daily_hours": None, "day_count": 0, "complete_days_count": 0,
                "has_partial_day": False, "all_days_passed": True
            }

        st = datetime.fromisoformat(start_iso.replace("Z", "+00:00")).timestamp()
        total_hours = dur_days * 24.0
        n_days = max(1, math.ceil(total_hours / 24.0))

        daily_vis = [0.0] * n_days
        daily_dt = [0.0] * n_days

        for i in range(len(series) - 1):
            pt0 = series[i]
            pt1 = series[i + 1]
            t1 = datetime.fromisoformat(pt0.timestamp_iso.replace("Z", "+00:00")).timestamp()
            t2 = datetime.fromisoformat(pt1.timestamp_iso.replace("Z", "+00:00")).timestamp()
            dt_h = (t2 - t1) / 3600.0
            if dt_h <= 0.0:
                continue

            t_mid = (t1 + t2) / 2.0
            day_idx = min(n_days - 1, max(0, int((t_mid - st) // 86400)))

            daily_dt[day_idx] += dt_h
            if getattr(pt0, "earth_visible_fraction", 0.0) > 0.0 or getattr(pt1, "earth_visible_fraction", 0.0) > 0.0:
                daily_vis[day_idx] += dt_h

        complete_vis = []
        has_partial = False
        partial_dur = 0.0
        partial_earth = 0.0

        for d in range(n_days):
            if daily_dt[d] >= 23.9:
                complete_vis.append(round(daily_vis[d], 2))
            else:
                has_partial = True
                partial_dur = round(daily_dt[d], 2)
                partial_earth = round(daily_vis[d], 2)

        worst_daily = min(daily_vis) if daily_vis else 0.0
        worst_complete = min(complete_vis) if complete_vis else worst_daily

        return {
            "min_daily_hours": round(worst_daily, 2),
            "worst_complete_day_hours": round(worst_complete, 2),
            "day_count": n_days,
            "complete_days_count": len(complete_vis),
            "complete_daily_hours_list": complete_vis,
            "has_partial_day": has_partial,
            "partial_day_hours": partial_dur,
            "partial_day_earth_hours": partial_earth,
            "daily_hours_list": [round(h, 2) for h in daily_vis],
            "all_days_passed": True,
        }

    def _compare_values(self, actual: float, op: str, threshold: Optional[float]) -> bool:
        if threshold is None:
            return True
        if op in ("ge", ">="):
            return actual >= threshold
        elif op in ("gt", ">"):
            return actual > threshold
        elif op in ("le", "<="):
            return actual <= threshold
        elif op in ("lt", "<"):
            return actual < threshold
        elif op in ("eq", "=="):
            return math.isclose(actual, threshold, rel_tol=1e-5, abs_tol=1e-5)
        return False

    def _operator_symbol(self, op: str) -> str:
        symbols = {
            "ge": "≥",
            ">=": "≥",
            "le": "≤",
            "<=": "≤",
            "gt": ">",
            ">": ">",
            "lt": "<",
            "<": "<",
            "eq": "==",
            "==": "==",
        }
        return symbols.get(op, op)

    def export_run_json(self, run_id: str) -> Dict[str, Any]:
        run = self.get_run(run_id)
        if not run:
            raise KeyError(f"Screening run '{run_id}' not found.")
        return run.model_dump()

    def export_run_csv(self, run_id: str) -> str:
        run = self.get_run(run_id)
        if not run:
            raise KeyError(f"Screening run '{run_id}' not found.")

        output = io.StringIO()
        writer = csv.writer(output)

        # Header metadata
        writer.writerow(["# LUNAVISTA CANDIDATE SCREENING REPORT (MVP 7.2)"])
        writer.writerow(["Run ID", run.id])
        writer.writerow(["Run Name", run.name])
        writer.writerow(["Execution Timestamp (UTC)", run.created_at_iso])
        writer.writerow(["Mission Profile", f"{run.profile_name} (v{run.profile_version})"])
        writer.writerow(["Analysis Period", f"{run.start_timestamp_iso} to {run.end_timestamp_iso} ({run.duration_days:.2f} Earth days)"])
        writer.writerow(["Observer Height", f"{run.observer_height_m} m"])
        writer.writerow([])

        # Table 1: Candidate Summaries
        writer.writerow([
            "Candidate ID",
            "Candidate Name",
            "Site ID",
            "Latitude (deg)",
            "Longitude (deg)",
            "Elevation (m)",
            "Slope (deg)",
            "Overall Status",
            "Hard Constraints Passed",
            "Hard Constraints Failed",
            "Hard Constraints Indeterminate",
            "Coverage Certainty",
        ])
        for c in run.candidates:
            writer.writerow([
                c.candidate_id,
                c.candidate_name,
                c.site_id,
                f"{c.latitude:.4f}",
                f"{c.longitude:.4f}",
                f"{c.surface_elevation_m:.1f}" if c.surface_elevation_m is not None else "N/A",
                f"{c.local_slope_deg:.1f}" if c.local_slope_deg is not None else "N/A",
                c.overall_status.value,
                c.hard_constraints_passed,
                c.hard_constraints_failed,
                c.hard_constraints_indeterminate,
                c.coverage_certainty,
            ])
        writer.writerow([])

        # Table 2: Detailed Hard Constraint Evaluations
        writer.writerow([
            "Candidate ID",
            "Requirement ID",
            "Requirement Name",
            "Category",
            "Classification",
            "Criterion",
            "Measured Value",
            "Verdict",
            "Explanation",
            "Data Source",
        ])
        for c in run.candidates:
            for r in c.hard_constraint_results:
                writer.writerow([
                    c.candidate_id,
                    r.requirement_id,
                    r.requirement_name,
                    r.category,
                    r.classification.value,
                    r.threshold_str,
                    r.actual_value_str,
                    r.verdict.value,
                    r.explanation,
                    r.supporting_data_source,
                ])
        writer.writerow([])

        # Table 3: Soft Preferences
        writer.writerow([
            "Candidate ID",
            "Preference ID",
            "Preference Name",
            "Category",
            "Threshold",
            "Measured Value",
            "Available",
            "Notes",
        ])
        for c in run.candidates:
            for s in c.soft_preference_results:
                writer.writerow([
                    c.candidate_id,
                    s.requirement_id,
                    s.requirement_name,
                    s.category,
                    s.threshold_str,
                    s.actual_value_str,
                    "Yes" if s.is_available else "No",
                    s.notes,
                ])
        writer.writerow([])

        # Table 4: Scientific Disclaimers
        writer.writerow(["# MANDATORY SCIENTIFIC DISCLAIMERS"])
        writer.writerow(["1. Geometric solar illumination does not model photovoltaic panel incidence angle, dust degradation, or electrical conversion efficiency."])
        writer.writerow(["2. Geometric Earth line-of-sight does not evaluate RF telecommunications link budget, DSN ground station schedules, or radio hardware margin."])
        writer.writerow(["3. Local slope and surface elevation alone do not guarantee touchdown safety; sub-pixel boulders and micro-craters are unmodeled."])
        writer.writerow(["4. Starter templates and scenario evaluation are engineering decision-support metrics, not certified NASA flight rules."])

        return output.getvalue()

# Singleton instance
screening_service = CandidateScreeningService()
