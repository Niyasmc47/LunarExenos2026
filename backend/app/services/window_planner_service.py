import os
import io
import csv
import json
import uuid
import math
import shutil
import tempfile
import threading
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

from app.schemas.window_planner import (
    WindowClassification,
    WindowSolarSummary,
    WindowEarthSummary,
    EvaluatedMissionWindow,
    MissionWindowSearchRequest,
    MissionWindowSearchRecord,
    WindowComparisonItem,
    WindowComparisonResponse,
)
from app.schemas.screening import (
    ScreeningVerdict,
    DataCoverageStatus,
    RequirementEvaluationResult,
    SoftPreferenceItem,
    InformationalMetricItem,
)
from app.schemas.mission_profile import (
    MissionProfile,
    RequirementClassification,
    SingleRequirement,
)
from app.schemas.visibility import (
    VisibilityAnalysisRequest,
    VisibilityState,
)
from app.services.mission_profile_service import MissionProfileService, mission_profile_service
from app.services.scenario_service import ScenarioEngineService, scenario_service
from app.services.visibility_service import VisibilityEngineService, visibility_service
from app.services.dem_loader import dem_loader
from app.services.dataset_catalogue import catalogue_service
from app.services.kernel_manager import kernel_manager, SPICE_LOCK
import spiceypy as spice

WINDOW_SEARCH_STORAGE_FILE = Path(__file__).resolve().parent.parent.parent / "data" / "mission_window_searches.json"

class MissionWindowPlannerService:
    def __init__(
        self,
        storage_path: Optional[Path] = None,
        profile_svc: Optional[MissionProfileService] = None,
        scen_svc: Optional[ScenarioEngineService] = None,
        vis_svc: Optional[VisibilityEngineService] = None,
    ):
        self.storage_file = storage_path or WINDOW_SEARCH_STORAGE_FILE
        self.profile_svc = profile_svc or mission_profile_service
        self.scenario_svc = scen_svc or scenario_service
        self.vis_svc = vis_svc or visibility_service
        self.dem_loader_svc = dem_loader
        self.catalogue_svc = catalogue_service
        self.kernel_mgr = kernel_manager

        self._lock = threading.Lock()
        self._searches: Dict[str, MissionWindowSearchRecord] = {}
        self._load_from_storage()

    def _load_from_storage(self):
        with self._lock:
            if self.storage_file.exists():
                try:
                    with open(self.storage_file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    loaded = {}
                    for item in data:
                        rec = MissionWindowSearchRecord.model_validate(item)
                        loaded[rec.id] = rec
                    self._searches = loaded
                    return
                except Exception as e:
                    print(f"[MissionWindowPlannerService] Failed to load {self.storage_file}: {e}")
                    try:
                        bak = self.storage_file.with_suffix(".corrupt.bak")
                        shutil.copy2(self.storage_file, bak)
                        print(f"[MissionWindowPlannerService] Quarantined corrupted storage to {bak}")
                    except Exception:
                        pass
            self._searches = {}

    def _save_to_storage_unlocked(self):
        try:
            self.storage_file.parent.mkdir(parents=True, exist_ok=True)
            data = [r.model_dump() for r in self._searches.values()]
            temp_dir = self.storage_file.parent
            with tempfile.NamedTemporaryFile("w", dir=temp_dir, delete=False, encoding="utf-8", suffix=".tmp") as tf:
                json.dump(data, tf, indent=2)
                tf.flush()
                os.fsync(tf.fileno())
                temp_path = Path(tf.name)
            os.replace(temp_path, self.storage_file)
        except Exception as e:
            print(f"[MissionWindowPlannerService] Warning: Failed to persist searches to {self.storage_file}: {e}")
            if "temp_path" in locals() and temp_path.exists():
                try:
                    temp_path.unlink()
                except OSError:
                    pass

    def list_searches(self) -> List[MissionWindowSearchRecord]:
        with self._lock:
            return sorted(list(self._searches.values()), key=lambda s: s.created_at_iso, reverse=True)

    def get_search(self, search_id: str) -> Optional[MissionWindowSearchRecord]:
        with self._lock:
            return self._searches.get(search_id)

    def delete_search(self, search_id: str) -> bool:
        with self._lock:
            if search_id in self._searches:
                del self._searches[search_id]
                self._save_to_storage_unlocked()
                return True
            return False

    def execute_window_search(self, req: MissionWindowSearchRequest) -> MissionWindowSearchRecord:
        """
        Executes a deterministic mission start-window search:
        1. Validates mission profile and candidate scenario.
        2. Validates search interval and duration math.
        3. Generates candidate start times t_i where t_i + D <= T_end.
        4. Evaluates visibility and ephemerides over the overarching search envelope.
        5. Slices and integrates metrics for each candidate window.
        6. Evaluates hard constraints, soft preferences, and data coverage.
        7. Persists historical search record atomically.
        """
        # 1. Resolve Mission Profile
        profile = self.profile_svc.get_profile(req.profile_id)
        if not profile:
            raise KeyError(f"Mission profile '{req.profile_id}' not found.")
        profile_snapshot = profile.model_copy(deep=True)

        # 2. Resolve Candidate Scenario
        scenario = self.scenario_svc.get_scenario(req.scenario_id)
        if not scenario:
            raise KeyError(f"Candidate scenario '{req.scenario_id}' not found.")

        # 3. Parse and Validate Time Boundaries
        try:
            st_search = datetime.fromisoformat(req.search_start_iso.replace("Z", "+00:00"))
            et_search = datetime.fromisoformat(req.search_end_iso.replace("Z", "+00:00"))
        except Exception as e:
            raise ValueError(f"Invalid ISO 8601 timestamp in search boundaries: {e}")

        if et_search <= st_search:
            raise ValueError(f"Search end epoch ({req.search_end_iso}) must be strictly after start epoch ({req.search_start_iso}).")

        search_span_seconds = (et_search - st_search).total_seconds()
        search_span_days = search_span_seconds / 86400.0

        mission_dur_days = req.mission_duration_days
        mission_dur_seconds = mission_dur_days * 86400.0
        mission_dur_hours = mission_dur_days * 24.0

        if mission_dur_days > search_span_days:
            raise ValueError(
                f"Mission duration ({mission_dur_days:.2f} days) exceeds the total search span "
                f"({search_span_days:.2f} days). No valid mission window can fit inside this interval."
            )

        # SPICE boundaries check
        with SPICE_LOCK:
            self.kernel_mgr.ensure_kernels_loaded()
            et_search_start_spice = spice.str2et(req.search_start_iso)
            et_search_end_spice = spice.str2et(req.search_end_iso)

        et_min = -3155760000.0  # 1900-01-01
        et_max = 1609459200.0   # 2050-12-31
        if not (et_min <= et_search_start_spice <= et_max) or not (et_min <= et_search_end_spice <= et_max):
            raise ValueError("Requested search interval is outside DE421 / PCK coverage window (1900-2050).")

        search_step_seconds = req.search_step_hours * 3600.0
        analysis_step_hours = req.analysis_step_hours or 2.0
        observer_height_m = (
            req.override_observer_height_m
            if req.override_observer_height_m is not None
            else profile_snapshot.observer_height_m
        )
        az_res_deg = req.azimuth_resolution_deg or 2.0
        max_dist_m = req.max_search_distance_m or 5000.0

        # 4. Generate Candidate Start Times
        candidate_starts: List[datetime] = []
        cur_t = st_search
        while (cur_t.timestamp() + mission_dur_seconds) <= et_search.timestamp() + 1e-4:
            candidate_starts.append(cur_t)
            cur_t = cur_t + timedelta(seconds=search_step_seconds)

        if not candidate_starts:
            raise ValueError("No candidate mission start times found within the specified search window and step.")

        # Limit maximum windows to prevent denial-of-service / memory exhaustion
        if len(candidate_starts) > 200:
            raise ValueError(
                f"Search parameters generated {len(candidate_starts)} candidate windows, exceeding maximum allowable "
                f"limit of 200. Please increase search_step_hours or narrow search dates."
            )

        # 5. Scientific Analysis Orchestration (Master Visibility Evaluation)
        # Compute master visibility once across the entire search envelope [st_search, et_search]
        vis_req = VisibilityAnalysisRequest(
            latitude=scenario.latitude,
            longitude=scenario.longitude,
            start_timestamp_iso=req.search_start_iso,
            end_timestamp_iso=req.search_end_iso,
            step_interval_hours=analysis_step_hours,
            observer_height_m=observer_height_m,
            dataset_id=scenario.site_id,
            azimuth_resolution_deg=az_res_deg,
            max_search_distance_m=max_dist_m,
            aberration_correction="LT+S",
        )
        master_vis = self.vis_svc.compute_visibility_analysis(vis_req)

        # Terrain sampling for candidate
        pt_sample = self.dem_loader_svc.sample_point(scenario.latitude, scenario.longitude)
        dem_meta = self.dem_loader_svc.get_metadata()
        dataset_rec = self.catalogue_svc.get_by_id(scenario.site_id)

        in_bounds = pt_sample.get("in_bounds", False)
        actual_slope = pt_sample.get("slope_deg")
        actual_elev = pt_sample.get("elevation_m") if in_bounds else master_vis.observer_surface_elevation_m

        cov_status_raw = master_vis.terrain_horizon_summary.coverage_status
        has_indeterminate_series = any(
            getattr(pt, "sun_visibility_state", None) == "INDETERMINATE"
            or getattr(pt, "earth_visibility_state", None) == "INDETERMINATE"
            for pt in master_vis.series
        )

        if not in_bounds:
            cov_certainty = "OUT_OF_BOUNDS"
            cov_status = DataCoverageStatus.UNAVAILABLE
        elif has_indeterminate_series:
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

        is_coverage_indeterminate = (
            cov_certainty in ("INDETERMINATE_PARTIAL_DEM", "OUT_OF_BOUNDS", "NO_DATA")
            or cov_status == DataCoverageStatus.UNAVAILABLE
        )

        # 6. Evaluate Each Candidate Mission Window
        evaluated_windows: List[EvaluatedMissionWindow] = []

        for idx, win_start in enumerate(candidate_starts, start=1):
            win_end = win_start + timedelta(seconds=mission_dur_seconds)
            win_start_iso = win_start.isoformat().replace("+00:00", "Z")
            win_end_iso = win_end.isoformat().replace("+00:00", "Z")

            win_eval = self._evaluate_window(
                window_index=idx,
                start_dt=win_start,
                end_dt=win_end,
                start_iso=win_start_iso,
                end_iso=win_end_iso,
                duration_days=mission_dur_days,
                duration_hours=mission_dur_hours,
                master_series=master_vis.series,
                analysis_step_hours=analysis_step_hours,
                profile=profile_snapshot,
                actual_slope=actual_slope,
                actual_elev=actual_elev,
                cov_certainty=cov_certainty,
                cov_status=cov_status,
                is_coverage_indeterminate=is_coverage_indeterminate,
                scenario=scenario,
            )
            evaluated_windows.append(win_eval)

        # 7. Aggregate Summary Totals
        compliant_count = sum(1 for w in evaluated_windows if w.classification == WindowClassification.COMPLIANT)
        non_compliant_count = sum(1 for w in evaluated_windows if w.classification == WindowClassification.NON_COMPLIANT)
        indeterminate_count = sum(1 for w in evaluated_windows if w.classification == WindowClassification.INDETERMINATE)

        grid_res = getattr(dem_meta, "pixel_spacing_m", 5.0) if dem_meta else 5.0
        bounds_dict = dem_meta.bounds_projected.model_dump() if hasattr(dem_meta, "bounds_projected") else None

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
            "ephemeris_model": "NASA JPL DE421 (1900-2050)",
            "active_kernels": kernel_status.get("loaded_kernels", []),
            "aberration_correction": "LT+S",
        }

        scientific_disclaimers = [
            "Geometric solar illumination does not model photovoltaic panel incidence angle, dust degradation, or electrical conversion efficiency.",
            "Geometric Earth line-of-sight does not evaluate RF telecommunications link budget, DSN ground station schedules, or radio hardware margin.",
            "Local slope and surface elevation alone do not guarantee touchdown safety; sub-pixel boulders and micro-craters are unmodeled.",
            "Candidate window search evaluation provides engineering planning metrics, not certified NASA flight rules.",
        ]

        search_id = f"search-{uuid.uuid4().hex[:8]}"
        search_name = req.name or f"Search: {scenario.name} / {profile_snapshot.name} ({len(evaluated_windows)} windows)"
        now_iso = datetime.now(timezone.utc).isoformat()

        record = MissionWindowSearchRecord(
            id=search_id,
            name=search_name,
            created_at_iso=now_iso,
            profile_id=profile_snapshot.id,
            profile_name=profile_snapshot.name,
            profile_version=profile_snapshot.version,
            profile_snapshot=profile_snapshot,
            scenario_id=scenario.id,
            scenario_name=scenario.name,
            site_id=scenario.site_id,
            latitude=scenario.latitude,
            longitude=scenario.longitude,
            observer_height_m=observer_height_m,
            search_start_iso=req.search_start_iso,
            search_end_iso=req.search_end_iso,
            search_span_days=round(search_span_days, 2),
            mission_duration_days=round(mission_dur_days, 2),
            mission_duration_hours=round(mission_dur_hours, 1),
            search_step_hours=req.search_step_hours,
            analysis_step_hours=analysis_step_hours,
            total_windows_evaluated=len(evaluated_windows),
            compliant_windows_count=compliant_count,
            non_compliant_windows_count=non_compliant_count,
            indeterminate_windows_count=indeterminate_count,
            windows=evaluated_windows,
            dem_provenance=dem_prov,
            spice_provenance=spice_prov,
            scientific_disclaimers=scientific_disclaimers,
            warnings=master_vis.warnings,
        )

        with self._lock:
            self._searches[search_id] = record
            self._save_to_storage_unlocked()

        return record

    def _evaluate_window(
        self,
        window_index: int,
        start_dt: datetime,
        end_dt: datetime,
        start_iso: str,
        end_iso: str,
        duration_days: float,
        duration_hours: float,
        master_series: List[Any],
        analysis_step_hours: float,
        profile: MissionProfile,
        actual_slope: Optional[float],
        actual_elev: Optional[float],
        cov_certainty: str,
        cov_status: DataCoverageStatus,
        is_coverage_indeterminate: bool,
        scenario: Any,
    ) -> EvaluatedMissionWindow:
        win_id = f"win-{window_index:03d}"
        analysis_period_str = f"{start_iso} to {end_iso} ({duration_days:.2f} Earth days)"

        st_ts = start_dt.timestamp()
        et_ts = end_dt.timestamp()

        # Slice points belonging to this window
        win_points = []
        for pt in master_series:
            pt_ts = datetime.fromisoformat(pt.timestamp_iso.replace("Z", "+00:00")).timestamp()
            if (st_ts - 1e-4) <= pt_ts <= (et_ts + 1e-4):
                win_points.append(pt)

        # Numerical integration across window points
        solar_stats = self._integrate_solar_metrics(win_points, duration_hours, analysis_step_hours)
        earth_stats = self._integrate_earth_metrics(win_points, duration_hours, analysis_step_hours)

        # 24.0h Earth day metrics
        daily_sun_res = self._compute_daily_sunlight_metrics(win_points, start_iso, end_iso, duration_days)
        daily_earth_res = self._compute_daily_earth_metrics(win_points, start_iso, end_iso, duration_days)

        solar_stats["min_daily_sunlight_hours"] = daily_sun_res.get("min_daily_hours", 0.0) or 0.0
        earth_stats["min_daily_earth_visible_hours"] = daily_earth_res.get("min_daily_hours", 0.0) or 0.0

        # Evaluate requirements
        hard_results: List[RequirementEvaluationResult] = []
        soft_results: List[SoftPreferenceItem] = []
        info_metrics: List[InformationalMetricItem] = []

        req_set = profile.requirements

        # 1. Total geometric sunlight
        self._eval_metric(
            req=req_set.solar.min_total_sunlight_hours,
            measured=solar_stats["total_sunlight_hours"],
            category="solar",
            is_indeterminate=is_coverage_indeterminate,
            source="Visibility Engine (MVP 5) - Cumulative Solar Illumination",
            period=analysis_period_str,
            hard_results=hard_results,
            soft_results=soft_results,
            info_metrics=info_metrics,
        )

        # 2. Full sunlight
        self._eval_metric(
            req=req_set.solar.min_full_sunlight_hours,
            measured=solar_stats["full_sunlight_hours"],
            category="solar",
            is_indeterminate=is_coverage_indeterminate,
            source="Visibility Engine (MVP 5) - Full Disk Sunlight (100% visible)",
            period=analysis_period_str,
            hard_results=hard_results,
            soft_results=soft_results,
            info_metrics=info_metrics,
        )

        # 3. Maximum continuous darkness
        self._eval_metric(
            req=req_set.solar.max_continuous_darkness_hours,
            measured=solar_stats["longest_darkness_hours"],
            category="solar",
            is_indeterminate=is_coverage_indeterminate,
            source="Visibility Engine (MVP 5) - Longest Darkness Run",
            period=analysis_period_str,
            hard_results=hard_results,
            soft_results=soft_results,
            info_metrics=info_metrics,
        )

        # 4. Sunlight percentage
        self._eval_metric(
            req=req_set.solar.min_sunlight_percentage,
            measured=solar_stats["illumination_percentage"],
            category="solar",
            is_indeterminate=is_coverage_indeterminate,
            source="Visibility Engine (MVP 5) - Illumination Ratio",
            period=analysis_period_str,
            hard_results=hard_results,
            soft_results=soft_results,
            info_metrics=info_metrics,
        )

        # 5. Minimum daily sunlight
        self._eval_daily_metric(
            req=req_set.solar.min_daily_sunlight_hours,
            daily_data=daily_sun_res,
            category="solar",
            is_indeterminate=is_coverage_indeterminate,
            source="Visibility Engine (MVP 5) - 24.0h Earth Day Sunlight Integration",
            period=analysis_period_str,
            hard_results=hard_results,
            soft_results=soft_results,
            info_metrics=info_metrics,
        )

        # 6. Total Earth visibility
        self._eval_metric(
            req=req_set.earth.min_total_earth_visible_hours,
            measured=earth_stats["total_earth_visible_hours"],
            category="earth",
            is_indeterminate=is_coverage_indeterminate,
            source="Visibility Engine (MVP 5) - Geometric Earth Line-of-Sight",
            period=analysis_period_str,
            hard_results=hard_results,
            soft_results=soft_results,
            info_metrics=info_metrics,
        )

        # 7. Maximum continuous Earth blackout
        self._eval_metric(
            req=req_set.earth.max_continuous_earth_blackout_hours,
            measured=earth_stats["longest_earth_blackout_hours"],
            category="earth",
            is_indeterminate=is_coverage_indeterminate,
            source="Visibility Engine (MVP 5) - Longest Earth Blackout Run",
            period=analysis_period_str,
            hard_results=hard_results,
            soft_results=soft_results,
            info_metrics=info_metrics,
        )

        # 8. Minimum daily Earth visibility
        self._eval_daily_metric(
            req=req_set.earth.min_daily_earth_visible_hours,
            daily_data=daily_earth_res,
            category="earth",
            is_indeterminate=is_coverage_indeterminate,
            source="Visibility Engine (MVP 5) - 24.0h Earth Day LOS Integration",
            period=analysis_period_str,
            hard_results=hard_results,
            soft_results=soft_results,
            info_metrics=info_metrics,
        )

        # 9. Full-disk Earth visibility
        self._eval_metric(
            req=req_set.earth.min_full_disk_earth_visible_hours,
            measured=earth_stats["full_disk_earth_visible_hours"],
            category="earth",
            is_indeterminate=is_coverage_indeterminate,
            source="Visibility Engine (MVP 5) - 100% Unoccluded Earth Disk",
            period=analysis_period_str,
            hard_results=hard_results,
            soft_results=soft_results,
            info_metrics=info_metrics,
        )

        # 10. Terrain requirements
        self._eval_metric(
            req=req_set.terrain.max_local_slope_deg,
            measured=actual_slope,
            category="terrain",
            is_indeterminate=(actual_slope is None),
            source="NASA LOLA 5 m DEM (Site 01) - Local Slope",
            period=analysis_period_str,
            hard_results=hard_results,
            soft_results=soft_results,
            info_metrics=info_metrics,
        )

        self._eval_metric(
            req=req_set.terrain.min_elevation_m,
            measured=actual_elev,
            category="terrain",
            is_indeterminate=(actual_elev is None),
            source="NASA LOLA 5 m DEM (Site 01) - Surface Elevation",
            period=analysis_period_str,
            hard_results=hard_results,
            soft_results=soft_results,
            info_metrics=info_metrics,
        )

        self._eval_metric(
            req=req_set.terrain.max_elevation_m,
            measured=actual_elev,
            category="terrain",
            is_indeterminate=(actual_elev is None),
            source="NASA LOLA 5 m DEM (Site 01) - Surface Elevation",
            period=analysis_period_str,
            hard_results=hard_results,
            soft_results=soft_results,
            info_metrics=info_metrics,
        )

        # Roughness handling
        rough_req = req_set.terrain.max_roughness_factor
        if rough_req.enabled:
            if rough_req.classification == RequirementClassification.HARD_CONSTRAINT:
                hard_results.append(RequirementEvaluationResult(
                    requirement_id=rough_req.id,
                    requirement_name=rough_req.name,
                    category="terrain",
                    classification=rough_req.classification,
                    operator=rough_req.operator,
                    threshold_value=rough_req.value,
                    threshold_str=f"{rough_req.operator} {rough_req.value} {rough_req.unit}",
                    actual_value=None,
                    actual_value_str="Unavailable",
                    unit=rough_req.unit,
                    verdict=ScreeningVerdict.INDETERMINATE,
                    explanation="Terrain roughness raster is not loaded; metric is unavailable. Do not substitute slope for roughness.",
                    supporting_data_source="NASA LOLA 5 m DEM Companion Product (Unloaded)",
                    analysis_period=analysis_period_str,
                ))
            elif rough_req.classification == RequirementClassification.SOFT_PREFERENCE:
                soft_results.append(SoftPreferenceItem(
                    requirement_id=rough_req.id,
                    requirement_name=rough_req.name,
                    category="terrain",
                    operator=rough_req.operator,
                    threshold_value=rough_req.value,
                    threshold_str=f"{rough_req.operator} {rough_req.value} {rough_req.unit}",
                    actual_value=None,
                    actual_value_str="Unavailable",
                    unit=rough_req.unit,
                    is_available=False,
                    notes="Roughness layer unavailable; slope cannot replace micro-roughness.",
                ))

        # Core informational metrics
        info_metrics.extend([
            InformationalMetricItem(
                id="window_span",
                name="Mission Window Span",
                category="time",
                value=duration_hours,
                value_str=f"{duration_hours:.1f} hours ({duration_days:.2f} Earth days)",
                unit="hours",
                source="Window Planner Engine",
            ),
            InformationalMetricItem(
                id="start_epoch",
                name="Window Start Epoch (UTC)",
                category="time",
                value=start_iso,
                value_str=start_iso,
                unit=None,
                source="Search Configuration",
            ),
            InformationalMetricItem(
                id="end_epoch",
                name="Window End Epoch (UTC)",
                category="time",
                value=end_iso,
                value_str=end_iso,
                unit=None,
                source="Search Configuration",
            ),
        ])

        # Classification Logic with Precedence:
        # FAIL has strict precedence over INDETERMINATE!
        # If any hard constraint fails -> NON_COMPLIANT.
        # Else if any hard constraint is indeterminate -> INDETERMINATE.
        # Else -> COMPLIANT.
        hard_passed = sum(1 for r in hard_results if r.verdict == ScreeningVerdict.PASS)
        hard_failed = sum(1 for r in hard_results if r.verdict == ScreeningVerdict.FAIL)
        hard_indet = sum(1 for r in hard_results if r.verdict == ScreeningVerdict.INDETERMINATE)
        total_hard = len(hard_results)

        if hard_failed > 0:
            classification = WindowClassification.NON_COMPLIANT
        elif hard_indet > 0:
            classification = WindowClassification.INDETERMINATE
        else:
            classification = WindowClassification.COMPLIANT

        solar_summary = WindowSolarSummary(
            total_sunlight_hours=solar_stats["total_sunlight_hours"],
            full_sunlight_hours=solar_stats["full_sunlight_hours"],
            partial_sunlight_hours=solar_stats["partial_sunlight_hours"],
            darkness_hours=solar_stats["darkness_hours"],
            longest_darkness_hours=solar_stats["longest_darkness_hours"],
            illumination_percentage=solar_stats["illumination_percentage"],
            min_daily_sunlight_hours=solar_stats["min_daily_sunlight_hours"],
            sunrise_transitions=solar_stats["sunrise_transitions"],
            sunset_transitions=solar_stats["sunset_transitions"],
        )

        earth_summary = WindowEarthSummary(
            total_earth_visible_hours=earth_stats["total_earth_visible_hours"],
            full_disk_earth_visible_hours=earth_stats["full_disk_earth_visible_hours"],
            partial_earth_visible_hours=earth_stats["partial_earth_visible_hours"],
            earth_blackout_hours=earth_stats["earth_blackout_hours"],
            longest_earth_blackout_hours=earth_stats["longest_earth_blackout_hours"],
            earth_visibility_percentage=earth_stats["earth_visibility_percentage"],
            min_daily_earth_visible_hours=earth_stats["min_daily_earth_visible_hours"],
            earthrise_transitions=earth_stats["earthrise_transitions"],
            earthset_transitions=earth_stats["earthset_transitions"],
        )

        return EvaluatedMissionWindow(
            window_id=win_id,
            window_index=window_index,
            start_timestamp_iso=start_iso,
            end_timestamp_iso=end_iso,
            duration_days=duration_days,
            duration_hours=duration_hours,
            classification=classification,
            hard_constraints_passed=hard_passed,
            hard_constraints_failed=hard_failed,
            hard_constraints_indeterminate=hard_indet,
            total_hard_constraints=total_hard,
            solar_summary=solar_summary,
            earth_summary=earth_summary,
            surface_elevation_m=actual_elev,
            local_slope_deg=actual_slope,
            hard_constraint_results=hard_results,
            soft_preference_results=soft_results,
            informational_metrics=info_metrics,
            coverage_status=cov_status,
            coverage_certainty=cov_certainty,
            warnings=[],
        )

    def _integrate_solar_metrics(
        self, points: List[Any], duration_hours: float, step_hours: float
    ) -> Dict[str, Any]:
        if not points:
            return {
                "total_sunlight_hours": 0.0,
                "full_sunlight_hours": 0.0,
                "partial_sunlight_hours": 0.0,
                "darkness_hours": duration_hours,
                "longest_darkness_hours": duration_hours,
                "illumination_percentage": 0.0,
                "sunrise_transitions": 0,
                "sunset_transitions": 0,
            }

        total_sun = 0.0
        full_sun = 0.0
        partial_sun = 0.0
        darkness = 0.0
        longest_darkness = 0.0
        current_darkness_run = 0.0
        sunrises = 0
        sunsets = 0
        prev_vis = False
        time_weighted_sun_integral = 0.0

        for i in range(len(points) - 1):
            pt = points[i]
            pt_next = points[i+1]
            t1 = datetime.fromisoformat(points[i].timestamp_iso.replace("Z", "+00:00")).timestamp()
            t2 = datetime.fromisoformat(points[i+1].timestamp_iso.replace("Z", "+00:00")).timestamp()
            dt_h = (t2 - t1) / 3600.0

            f1 = getattr(pt, "sun_visible_fraction", 0.0)
            f2 = getattr(pt_next, "sun_visible_fraction", 0.0)
            time_weighted_sun_integral += 0.5 * (f1 + f2) * dt_h
            is_vis = f1 > 0.0 or f2 > 0.0

            if is_vis:
                total_sun += dt_h
                if f1 >= 0.999 and f2 >= 0.999:
                    full_sun += dt_h
                else:
                    partial_sun += dt_h

                if i > 0 and not prev_vis:
                    sunrises += 1

                current_darkness_run = 0.0
            else:
                darkness += dt_h
                current_darkness_run += dt_h
                if current_darkness_run > longest_darkness:
                    longest_darkness = current_darkness_run

                if i > 0 and prev_vis:
                    sunsets += 1

            prev_vis = is_vis

        total_sun = min(duration_hours, total_sun)
        full_sun = min(total_sun, full_sun)
        partial_sun = max(0.0, total_sun - full_sun)
        darkness = max(0.0, duration_hours - total_sun)
        longest_darkness = min(duration_hours, max(longest_darkness, current_darkness_run))
        
        tw_sun_pct = round(min(100.0, max(0.0, (time_weighted_sun_integral / max(0.01, duration_hours)) * 100.0)), 2)
        full_sun_pct = round((full_sun / max(0.01, duration_hours)) * 100.0, 2)
        partial_sun_pct = round((partial_sun / max(0.01, duration_hours)) * 100.0, 2)
        dark_pct = round(max(0.0, 100.0 - full_sun_pct - partial_sun_pct), 2)
        any_sun_pct = round(full_sun_pct + partial_sun_pct, 2)

        return {
            "total_sunlight_hours": round(total_sun, 2),
            "full_sunlight_hours": round(full_sun, 2),
            "partial_sunlight_hours": round(partial_sun, 2),
            "darkness_hours": round(darkness, 2),
            "longest_darkness_hours": round(longest_darkness, 2),
            "illumination_percentage": tw_sun_pct,
            "time_weighted_sunlight_percentage": tw_sun_pct,
            "any_sunlight_percentage": any_sun_pct,
            "full_sunlight_percentage": full_sun_pct,
            "partial_sunlight_percentage": partial_sun_pct,
            "darkness_percentage": dark_pct,
            "sunrise_transitions": sunrises,
            "sunset_transitions": sunsets,
        }

    def _integrate_earth_metrics(
        self, points: List[Any], duration_hours: float, step_hours: float
    ) -> Dict[str, Any]:
        if not points:
            return {
                "total_earth_visible_hours": 0.0,
                "full_disk_earth_visible_hours": 0.0,
                "partial_earth_visible_hours": 0.0,
                "earth_blackout_hours": duration_hours,
                "longest_earth_blackout_hours": duration_hours,
                "earth_visibility_percentage": 0.0,
                "earthrise_transitions": 0,
                "earthset_transitions": 0,
            }

        total_earth = 0.0
        full_earth = 0.0
        partial_earth = 0.0
        blackout = 0.0
        longest_blackout = 0.0
        current_blackout_run = 0.0
        earthrises = 0
        earthsets = 0
        prev_vis = False
        time_weighted_earth_integral = 0.0

        for i in range(len(points) - 1):
            pt = points[i]
            pt_next = points[i+1]
            t1 = datetime.fromisoformat(points[i].timestamp_iso.replace("Z", "+00:00")).timestamp()
            t2 = datetime.fromisoformat(points[i+1].timestamp_iso.replace("Z", "+00:00")).timestamp()
            dt_h = (t2 - t1) / 3600.0

            f1 = getattr(pt, "earth_visible_fraction", 0.0)
            f2 = getattr(pt_next, "earth_visible_fraction", 0.0)
            time_weighted_earth_integral += 0.5 * (f1 + f2) * dt_h
            is_vis = f1 > 0.0 or f2 > 0.0

            if is_vis:
                total_earth += dt_h
                if f1 >= 0.999 and f2 >= 0.999:
                    full_earth += dt_h
                else:
                    partial_earth += dt_h

                if i > 0 and not prev_vis:
                    earthrises += 1

                current_blackout_run = 0.0
            else:
                blackout += dt_h
                current_blackout_run += dt_h
                if current_blackout_run > longest_blackout:
                    longest_blackout = current_blackout_run

                if i > 0 and prev_vis:
                    earthsets += 1

            prev_vis = is_vis

        total_earth = min(duration_hours, total_earth)
        full_earth = min(total_earth, full_earth)
        partial_earth = max(0.0, total_earth - full_earth)
        blackout = max(0.0, duration_hours - total_earth)
        longest_blackout = min(duration_hours, max(longest_blackout, current_blackout_run))

        tw_earth_pct = round(min(100.0, max(0.0, (time_weighted_earth_integral / max(0.01, duration_hours)) * 100.0)), 2)
        full_earth_pct = round((full_earth / max(0.01, duration_hours)) * 100.0, 2)
        partial_earth_pct = round((partial_earth / max(0.01, duration_hours)) * 100.0, 2)
        blackout_pct = round(max(0.0, 100.0 - full_earth_pct - partial_earth_pct), 2)
        any_earth_pct = round(full_earth_pct + partial_earth_pct, 2)

        return {
            "total_earth_visible_hours": round(total_earth, 2),
            "full_disk_earth_visible_hours": round(full_earth, 2),
            "partial_earth_visible_hours": round(partial_earth, 2),
            "earth_blackout_hours": round(blackout, 2),
            "longest_earth_blackout_hours": round(longest_blackout, 2),
            "earth_visibility_percentage": tw_earth_pct,
            "time_weighted_earth_percentage": tw_earth_pct,
            "any_earth_percentage": any_earth_pct,
            "full_earth_percentage": full_earth_pct,
            "partial_earth_percentage": partial_earth_pct,
            "blackout_percentage": blackout_pct,
            "earthrise_transitions": earthrises,
            "earthset_transitions": earthsets,
        }

    def _compute_daily_sunlight_metrics(
        self, series: List[Any], start_iso: str, end_iso: str, dur_days: float
    ) -> Dict[str, Any]:
        if not series:
            return {"min_daily_hours": None, "day_count": 0, "all_days_passed": True}

        st = datetime.fromisoformat(start_iso.replace("Z", "+00:00")).timestamp()
        total_hours = dur_days * 24.0
        n_days = max(1, math.ceil(total_hours / 24.0))

        daily_illum = [0.0] * n_days

        for i in range(len(series)):
            pt = series[i]
            pt_t = datetime.fromisoformat(pt.timestamp_iso.replace("Z", "+00:00")).timestamp()
            dt_from_start_h = (pt_t - st) / 3600.0
            if dt_from_start_h < 0:
                continue

            day_idx = min(n_days - 1, int(dt_from_start_h // 24.0))

            if i < len(series) - 1:
                next_t = datetime.fromisoformat(series[i+1].timestamp_iso.replace("Z", "+00:00")).timestamp()
                step_h = (next_t - pt_t) / 3600.0
            else:
                step_h = 1.0

            if getattr(pt, "sun_visible_fraction", 0.0) > 0.0:
                daily_illum[day_idx] += step_h

        min_hours = min(daily_illum) if daily_illum else 0.0
        return {
            "min_daily_hours": round(min_hours, 2),
            "day_count": n_days,
            "daily_hours_list": [round(h, 2) for h in daily_illum],
        }

    def _compute_daily_earth_metrics(
        self, series: List[Any], start_iso: str, end_iso: str, dur_days: float
    ) -> Dict[str, Any]:
        if not series:
            return {"min_daily_hours": None, "day_count": 0, "all_days_passed": True}

        st = datetime.fromisoformat(start_iso.replace("Z", "+00:00")).timestamp()
        total_hours = dur_days * 24.0
        n_days = max(1, math.ceil(total_hours / 24.0))

        daily_vis = [0.0] * n_days

        for i in range(len(series)):
            pt = series[i]
            pt_t = datetime.fromisoformat(pt.timestamp_iso.replace("Z", "+00:00")).timestamp()
            dt_from_start_h = (pt_t - st) / 3600.0
            if dt_from_start_h < 0:
                continue

            day_idx = min(n_days - 1, int(dt_from_start_h // 24.0))

            if i < len(series) - 1:
                next_t = datetime.fromisoformat(series[i+1].timestamp_iso.replace("Z", "+00:00")).timestamp()
                step_h = (next_t - pt_t) / 3600.0
            else:
                step_h = 1.0

            if getattr(pt, "earth_visible_fraction", 0.0) > 0.0:
                daily_vis[day_idx] += step_h

        min_hours = min(daily_vis) if daily_vis else 0.0
        return {
            "min_daily_hours": round(min_hours, 2),
            "day_count": n_days,
            "daily_hours_list": [round(h, 2) for h in daily_vis],
        }

    def _eval_metric(
        self,
        req: SingleRequirement,
        measured: Optional[float],
        category: str,
        is_indeterminate: bool,
        source: str,
        period: str,
        hard_results: List[RequirementEvaluationResult],
        soft_results: List[SoftPreferenceItem],
        info_metrics: List[InformationalMetricItem],
    ):
        if not req.enabled:
            return

        threshold = req.value
        op = req.operator or "ge"
        unit = req.unit
        crit_str = f"{self._op_symbol(op)} {threshold} {unit}" if threshold is not None else "Informational"

        if req.classification == RequirementClassification.HARD_CONSTRAINT:
            if measured is None:
                verdict = ScreeningVerdict.INDETERMINATE
                actual_str = "N/A"
                expl = f"Measurement unavailable for {req.name}."
            elif is_indeterminate and category in ("solar", "earth"):
                verdict = ScreeningVerdict.INDETERMINATE
                actual_str = f"{measured:.1f} {unit}"
                expl = (
                    f"Measured {measured:.1f} {unit}, but candidate has partial DEM coverage with target paths "
                    f"crossing unmodeled terrain sectors (INDETERMINATE_PARTIAL_DEM)."
                )
            else:
                actual_str = f"{measured:.1f} {unit}"
                passed = self._compare(measured, op, threshold)
                if passed:
                    verdict = ScreeningVerdict.PASS
                    expl = f"Observed value of {actual_str} satisfies criterion {crit_str}."
                else:
                    verdict = ScreeningVerdict.FAIL
                    expl = f"Observed value of {actual_str} violates criterion {crit_str}."

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
                analysis_period=period,
            ))

        elif req.classification == RequirementClassification.SOFT_PREFERENCE:
            actual_str = f"{measured:.1f} {unit}" if measured is not None else "Unavailable"
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
                notes=f"Observed: {actual_str}. Preference: {crit_str}.",
            ))

        else:
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

    def _eval_daily_metric(
        self,
        req: SingleRequirement,
        daily_data: Dict[str, Any],
        category: str,
        is_indeterminate: bool,
        source: str,
        period: str,
        hard_results: List[RequirementEvaluationResult],
        soft_results: List[SoftPreferenceItem],
        info_metrics: List[InformationalMetricItem],
    ):
        if not req.enabled:
            return

        threshold = req.value
        op = req.operator or "ge"
        unit = req.unit
        crit_str = f"{self._op_symbol(op)} {threshold} {unit}" if threshold is not None else "Informational"

        min_val = daily_data.get("min_daily_hours")
        day_count = daily_data.get("day_count", 0)

        if req.classification == RequirementClassification.HARD_CONSTRAINT:
            if min_val is None or day_count == 0:
                verdict = ScreeningVerdict.INDETERMINATE
                actual_str = "N/A"
                expl = "Daily time-series integration unavailable."
            elif is_indeterminate:
                verdict = ScreeningVerdict.INDETERMINATE
                actual_str = f"{min_val:.1f} {unit}"
                expl = f"Minimum observed {min_val:.1f} {unit}, but unmodeled external terrain limits certainty."
            else:
                passed = self._compare(min_val, op, threshold)
                actual_str = f"{min_val:.1f} {unit} (worst day)"
                if passed:
                    verdict = ScreeningVerdict.PASS
                    expl = f"All {day_count} Earth days satisfied requirement (worst day: {actual_str} vs {crit_str})."
                else:
                    verdict = ScreeningVerdict.FAIL
                    expl = f"Failed daily requirement: worst day observed {actual_str} vs required {crit_str}."

            hard_results.append(RequirementEvaluationResult(
                requirement_id=req.id,
                requirement_name=req.name,
                category=category,
                classification=req.classification,
                operator=op,
                threshold_value=threshold,
                threshold_str=crit_str,
                actual_value=min_val,
                actual_value_str=actual_str,
                unit=unit,
                verdict=verdict,
                explanation=expl,
                supporting_data_source=source,
                analysis_period=period,
            ))

        elif req.classification == RequirementClassification.SOFT_PREFERENCE:
            actual_str = f"{min_val:.1f} {unit}" if min_val is not None else "Unavailable"
            soft_results.append(SoftPreferenceItem(
                requirement_id=req.id,
                requirement_name=req.name,
                category=category,
                operator=op,
                threshold_value=threshold,
                threshold_str=crit_str,
                actual_value=min_val,
                actual_value_str=actual_str,
                unit=unit,
                is_available=(min_val is not None),
                notes=f"Minimum observed across {day_count} Earth days: {actual_str}. Preference: {crit_str}.",
            ))

        else:
            actual_str = f"{min_val:.1f} {unit}" if min_val is not None else "Unavailable"
            info_metrics.append(InformationalMetricItem(
                id=req.id,
                name=req.name,
                category=category,
                value=min_val,
                value_str=actual_str,
                unit=unit,
                source=source,
            ))

    def _compare(self, actual: float, op: str, threshold: Optional[float]) -> bool:
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

    def _op_symbol(self, op: str) -> str:
        symbols = {"ge": "≥", ">=": "≥", "le": "≤", "<=": "≤", "gt": ">", "lt": "<", "eq": "=="}
        return symbols.get(op, op)

    def compare_windows(self, search_id: str, window_ids: List[str]) -> WindowComparisonResponse:
        search = self.get_search(search_id)
        if not search:
            raise KeyError(f"Search record '{search_id}' not found.")

        if len(window_ids) < 2 or len(window_ids) > 4:
            raise ValueError("Window comparison requires between 2 and 4 window IDs.")

        win_map = {w.window_id: w for w in search.windows}
        selected_windows = []
        for wid in window_ids:
            if wid not in win_map:
                raise KeyError(f"Window '{wid}' not found in search '{search_id}'.")
            selected_windows.append(win_map[wid])

        ref = selected_windows[0]
        comp_items: List[WindowComparisonItem] = []
        consistency_notes: List[str] = [
            f"Harmonized Candidate Location: {search.scenario_name} ({search.latitude:.4f}°, {search.longitude:.4f}°)",
            f"Harmonized Mission Duration: {search.mission_duration_days:.2f} Earth days ({search.mission_duration_hours:.1f} hours)",
            f"Harmonized Observer Height: {search.observer_height_m:.1f} m",
            f"Evaluated Profile: {search.profile_name} (v{search.profile_version})",
        ]

        for w in selected_windows:
            diffs = []
            if w.window_id != ref.window_id:
                diff_sun = w.solar_summary.total_sunlight_hours - ref.solar_summary.total_sunlight_hours
                diff_earth = w.earth_summary.total_earth_visible_hours - ref.earth_summary.total_earth_visible_hours
                diff_dark = w.solar_summary.longest_darkness_hours - ref.solar_summary.longest_darkness_hours
                diffs.append(f"Sunlight: {diff_sun:+.1f} h relative to {ref.window_id}")
                diffs.append(f"Earth Visibility: {diff_earth:+.1f} h relative to {ref.window_id}")
                diffs.append(f"Longest Darkness: {diff_dark:+.1f} h relative to {ref.window_id}")

            comp_items.append(WindowComparisonItem(
                window_id=w.window_id,
                start_timestamp_iso=w.start_timestamp_iso,
                end_timestamp_iso=w.end_timestamp_iso,
                classification=w.classification,
                total_sunlight_hours=w.solar_summary.total_sunlight_hours,
                full_sunlight_hours=w.solar_summary.full_sunlight_hours,
                longest_darkness_hours=w.solar_summary.longest_darkness_hours,
                illumination_percentage=w.solar_summary.illumination_percentage,
                total_earth_visible_hours=w.earth_summary.total_earth_visible_hours,
                longest_earth_blackout_hours=w.earth_summary.longest_earth_blackout_hours,
                hard_constraints_passed=w.hard_constraints_passed,
                hard_constraints_failed=w.hard_constraints_failed,
                hard_constraints_indeterminate=w.hard_constraints_indeterminate,
                differences_from_reference=diffs,
            ))

        return WindowComparisonResponse(
            search_id=search_id,
            reference_window_id=ref.window_id,
            compared_windows=comp_items,
            is_fully_consistent=True,
            consistency_notes=consistency_notes,
        )

    def export_search_json(self, search_id: str) -> Dict[str, Any]:
        search = self.get_search(search_id)
        if not search:
            raise KeyError(f"Search record '{search_id}' not found.")
        return search.model_dump()

    def export_search_csv(self, search_id: str) -> str:
        search = self.get_search(search_id)
        if not search:
            raise KeyError(f"Search record '{search_id}' not found.")

        out = io.StringIO()
        writer = csv.writer(out)

        writer.writerow(["# LUNAVISTA MISSION WINDOW SEARCH REPORT (MVP 7.3)"])
        writer.writerow(["Search ID", search.id])
        writer.writerow(["Search Name", search.name])
        writer.writerow(["Execution Timestamp (UTC)", search.created_at_iso])
        writer.writerow(["Candidate Site", f"{search.scenario_name} ({search.latitude:.4f}°, {search.longitude:.4f}° / {search.site_id})"])
        writer.writerow(["Mission Profile", f"{search.profile_name} (v{search.profile_version})"])
        writer.writerow(["Search Interval", f"{search.search_start_iso} to {search.search_end_iso} ({search.search_span_days:.2f} Earth days)"])
        writer.writerow(["Mission Duration", f"{search.mission_duration_days:.2f} Earth days ({search.mission_duration_hours:.1f} hours)"])
        writer.writerow(["Search Step", f"{search.search_step_hours} hours"])
        writer.writerow(["Analysis Step", f"{search.analysis_step_hours} hours"])
        writer.writerow([])

        # Table 1: Evaluated Windows Summary
        writer.writerow([
            "Window ID",
            "Start Epoch (UTC)",
            "End Epoch (UTC)",
            "Duration (h)",
            "Classification",
            "Total Sunlight (h)",
            "Full Sunlight (h)",
            "Illumination (%)",
            "Longest Darkness (h)",
            "Total Earth LOS (h)",
            "Longest Earth Blackout (h)",
            "Hard Constraints Passed",
            "Hard Constraints Failed",
            "Hard Constraints Indeterminate",
        ])
        for w in search.windows:
            writer.writerow([
                w.window_id,
                w.start_timestamp_iso,
                w.end_timestamp_iso,
                f"{w.duration_hours:.1f}",
                w.classification.value,
                f"{w.solar_summary.total_sunlight_hours:.1f}",
                f"{w.solar_summary.full_sunlight_hours:.1f}",
                f"{w.solar_summary.illumination_percentage:.1f}%",
                f"{w.solar_summary.longest_darkness_hours:.1f}",
                f"{w.earth_summary.total_earth_visible_hours:.1f}",
                f"{w.earth_summary.longest_earth_blackout_hours:.1f}",
                w.hard_constraints_passed,
                w.hard_constraints_failed,
                w.hard_constraints_indeterminate,
            ])
        writer.writerow([])

        # Table 2: Detailed Constraint Evaluations across all windows
        writer.writerow([
            "Window ID",
            "Start Epoch (UTC)",
            "Requirement ID",
            "Requirement Name",
            "Category",
            "Required Criterion",
            "Actual Measured",
            "Verdict",
            "Explanation",
        ])
        for w in search.windows:
            for r in w.hard_constraint_results:
                writer.writerow([
                    w.window_id,
                    w.start_timestamp_iso,
                    r.requirement_id,
                    r.requirement_name,
                    r.category,
                    r.threshold_str,
                    r.actual_value_str,
                    r.verdict.value,
                    r.explanation,
                ])
        writer.writerow([])

        # Disclaimers
        writer.writerow(["# MANDATORY SCIENTIFIC DISCLAIMERS"])
        for d in search.scientific_disclaimers:
            writer.writerow([d])

        return out.getvalue()

# Singleton instance
window_planner_service = MissionWindowPlannerService()
