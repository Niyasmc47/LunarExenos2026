import math
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import numpy as np
import spiceypy as spice

from app.schemas.visibility import (
    VisibilityState,
    CoverageCertainty,
    CombinedVisibilityState,
    CelestialDiskVisibility,
    VisibilityInstantRequest,
    VisibilityInstantResponse,
    VisibilityTransitionPoint,
    VisibilityTimeSeriesPoint,
    SolarMetrics,
    EarthMetrics,
    CombinedMetrics,
    VisibilityAnalysisRequest,
    VisibilityAnalysisResponse,
)
from app.schemas.horizon import HorizonAnalysisRequest, HorizonAnalysisResponse, HorizonPoint
from app.schemas.ephemeris import EphemerisPositionRequest
from app.services.horizon_service import horizon_service
from app.services.ephemeris_service import (
    ephemeris_service,
    SUN_RADIUS_KM,
    EARTH_EQUATORIAL_RADIUS_KM,
    MOON_RADIUS_KM,
)
from app.services.kernel_manager import kernel_manager, SPICE_LOCK
from app.services.dem_loader import dem_loader

class VisibilityEngineService:
    def __init__(self):
        self.horizon_svc = horizon_service
        self.ephemeris_svc = ephemeris_service
        self.kernel_mgr = kernel_manager

    def compute_instant_visibility(self, req: VisibilityInstantRequest) -> VisibilityInstantResponse:
        """
        Calculates terrain-aware Sun and Earth visibility at a single observation epoch.
        """
        # 1. Compute Horizon Profile for observer location and height
        h_req = HorizonAnalysisRequest(
            latitude=req.latitude,
            longitude=req.longitude,
            observer_height_m=req.observer_height_m,
            azimuth_resolution_deg=req.azimuth_resolution_deg,
            max_search_distance_m=req.max_search_distance_m,
            dataset_id=req.dataset_id,
        )
        h_resp = self.horizon_svc.calculate_horizon(h_req)

        # 2. Compute Ephemeris Topocentric Positions for Sun and Earth
        e_req = EphemerisPositionRequest(
            latitude=req.latitude,
            longitude=req.longitude,
            observer_height_m=req.observer_height_m,
            timestamp_iso=req.timestamp_iso,
            dataset_id=req.dataset_id,
            aberration_correction=req.aberration_correction,
        )
        e_resp = self.ephemeris_svc.calculate_position(e_req)

        # 3. Build horizon lookup structure
        horizon_az, horizon_el, horizon_comp, horizon_bound = self._extract_horizon_arrays(h_resp.horizon_profile)

        # 4. Evaluate Sun Disk Visibility
        sun_vis = self._evaluate_disk_visibility(
            body_name="Sun",
            azimuth_deg=e_resp.sun.azimuth_deg,
            elevation_deg=e_resp.sun.elevation_deg,
            angular_diameter_deg=e_resp.sun.apparent_angular_diameter_deg,
            distance_km=e_resp.sun.distance_km,
            light_time_seconds=e_resp.sun.light_time_seconds,
            horizon_az=horizon_az,
            horizon_el=horizon_el,
            coverage_status=h_resp.summary.coverage_status,
            horizon_comp=horizon_comp,
            horizon_bound=horizon_bound,
        )

        # 5. Evaluate Earth Disk Visibility
        earth_vis = self._evaluate_disk_visibility(
            body_name="Earth",
            azimuth_deg=e_resp.earth.azimuth_deg,
            elevation_deg=e_resp.earth.elevation_deg,
            angular_diameter_deg=e_resp.earth.apparent_angular_diameter_deg,
            distance_km=e_resp.earth.distance_km,
            light_time_seconds=e_resp.earth.light_time_seconds,
            horizon_az=horizon_az,
            horizon_el=horizon_el,
            coverage_status=h_resp.summary.coverage_status,
            horizon_comp=horizon_comp,
            horizon_bound=horizon_bound,
        )

        # 6. Combined Visibility State
        combined_state = self._determine_combined_state(sun_vis, earth_vis)

        warnings = list(h_resp.warnings) + list(e_resp.warnings)
        if h_resp.summary.coverage_status != "complete":
            warnings.append(
                f"Terrain horizon has partial coverage ({h_resp.summary.coverage_status}); "
                f"distant terrain beyond active DEM boundary could affect low-elevation celestial visibility."
            )

        provenance = {
            "terrain_dem": h_resp.dataset_name,
            "dem_reference_frame": h_resp.reference_frame,
            "dem_citation": h_resp.citation,
            "ephemeris_provenance": e_resp.kernel_provenance,
            "horizon_search_radius_m": req.max_search_distance_m,
            "horizon_azimuth_resolution_deg": req.azimuth_resolution_deg,
            "partial_disk_integration_slices": 31,
            "coordinate_frame": "MOON_ME (DE421)",
        }

        return VisibilityInstantResponse(
            latitude=req.latitude,
            longitude=req.longitude,
            observer_surface_elevation_m=h_resp.observer_surface_elevation_m,
            observer_height_m=req.observer_height_m,
            total_observer_elevation_m=h_resp.total_observer_elevation_m,
            timestamp_iso=req.timestamp_iso,
            ephemeris_time_tdb=e_resp.ephemeris_time_tdb_seconds,
            sun=sun_vis,
            earth=earth_vis,
            combined_state=combined_state,
            terrain_horizon_summary=h_resp.summary,
            horizon_profile=h_resp.horizon_profile,
            warnings=warnings,
            provenance=provenance,
        )

    def compute_visibility_analysis(self, req: VisibilityAnalysisRequest) -> VisibilityAnalysisResponse:
        """
        Calculates terrain-aware Sun and Earth visibility time series and transitions across a time interval.
        """
        self.kernel_mgr.ensure_kernels_loaded()
        warnings: List[str] = []

        # 1. Parse and validate time interval
        try:
            with SPICE_LOCK:
                et_start = spice.str2et(req.start_timestamp_iso)
                et_end = spice.str2et(req.end_timestamp_iso)
        except Exception as e:
            raise ValueError(f"Invalid timestamp format: {e}")

        if et_end <= et_start:
            raise ValueError("end_timestamp_iso must be strictly after start_timestamp_iso.")

        et_min = -3155760000.0  # 1900-01-01
        et_max = 1609459200.0   # 2050-12-31
        if not (et_min <= et_start <= et_max) or not (et_min <= et_end <= et_max):
            raise ValueError("Requested time interval is outside DE421 / PCK coverage window (1900-2050).")

        step_seconds = req.step_interval_hours * 3600.0
        total_steps = int(math.ceil((et_end - et_start) / step_seconds)) + 1
        if total_steps > 1500:
            raise ValueError(
                f"Requested interval yields {total_steps} epochs, exceeding the 1500 limit. "
                f"Increase step_interval_hours or shorten time interval."
            )

        # 2. Compute Horizon Profile ONCE for the observer location & height
        h_req = HorizonAnalysisRequest(
            latitude=req.latitude,
            longitude=req.longitude,
            observer_height_m=req.observer_height_m,
            azimuth_resolution_deg=req.azimuth_resolution_deg,
            max_search_distance_m=req.max_search_distance_m,
            dataset_id=req.dataset_id,
        )
        h_resp = self.horizon_svc.calculate_horizon(h_req)
        horizon_az, horizon_el, horizon_comp, horizon_bound = self._extract_horizon_arrays(h_resp.horizon_profile)

        # 3. Setup observer coordinates and local ENU basis in MOON_ME
        sample = dem_loader.sample_point(req.latitude, req.longitude)
        surface_elev_m = float(sample["elevation_m"]) if (sample.get("in_bounds") and sample.get("elevation_m") is not None) else 0.0
        total_obs_elev_m = surface_elev_m + req.observer_height_m
        obs_radius_km = MOON_RADIUS_KM + (total_obs_elev_m / 1000.0)

        phi = math.radians(req.latitude)
        lam = math.radians(req.longitude)
        obs_pos_moon_me = np.array([
            obs_radius_km * math.cos(phi) * math.cos(lam),
            obs_radius_km * math.cos(phi) * math.sin(lam),
            obs_radius_km * math.sin(phi),
        ], dtype=np.float64)

        u_east = np.array([-math.sin(lam), math.cos(lam), 0.0], dtype=np.float64)
        u_north = np.array([-math.sin(phi) * math.cos(lam), -math.sin(phi) * math.sin(lam), math.cos(phi)], dtype=np.float64)
        u_up = np.array([math.cos(phi) * math.cos(lam), math.cos(phi) * math.sin(lam), math.sin(phi)], dtype=np.float64)

        abcorr = req.aberration_correction.upper()
        if abcorr not in ["NONE", "LT", "LT+S"]:
            abcorr = "LT+S"

        # 4. Generate Time-Series Points under thread safety lock
        series: List[VisibilityTimeSeriesPoint] = []
        cur_et = et_start
        for _ in range(total_steps):
            if cur_et > et_end + 1e-3:
                break

            with SPICE_LOCK:
                cur_iso = spice.et2utc(cur_et, "ISOC", 0) + "Z"

                # Topocentric Sun
                sun_pos = self.ephemeris_svc._calculate_topocentric_body(
                    body_name="Sun",
                    target_spice_id="SUN",
                    et=cur_et,
                    obs_pos=obs_pos_moon_me,
                    u_east=u_east,
                    u_north=u_north,
                    u_up=u_up,
                    body_radius_km=SUN_RADIUS_KM,
                    abcorr=abcorr,
                )

                # Topocentric Earth
                earth_pos = self.ephemeris_svc._calculate_topocentric_body(
                    body_name="Earth",
                    target_spice_id="EARTH",
                    et=cur_et,
                    obs_pos=obs_pos_moon_me,
                    u_east=u_east,
                    u_north=u_north,
                    u_up=u_up,
                    body_radius_km=EARTH_EQUATORIAL_RADIUS_KM,
                    abcorr=abcorr,
                )

            # Evaluate Terrain Visibility for Sun & Earth
            sun_vis = self._evaluate_disk_visibility(
                body_name="Sun",
                azimuth_deg=sun_pos.azimuth_deg,
                elevation_deg=sun_pos.elevation_deg,
                angular_diameter_deg=sun_pos.apparent_angular_diameter_deg,
                distance_km=sun_pos.distance_km,
                light_time_seconds=sun_pos.light_time_seconds,
                horizon_az=horizon_az,
                horizon_el=horizon_el,
                coverage_status=h_resp.summary.coverage_status,
                horizon_comp=horizon_comp,
                horizon_bound=horizon_bound,
            )

            earth_vis = self._evaluate_disk_visibility(
                body_name="Earth",
                azimuth_deg=earth_pos.azimuth_deg,
                elevation_deg=earth_pos.elevation_deg,
                angular_diameter_deg=earth_pos.apparent_angular_diameter_deg,
                distance_km=earth_pos.distance_km,
                light_time_seconds=earth_pos.light_time_seconds,
                horizon_az=horizon_az,
                horizon_el=horizon_el,
                coverage_status=h_resp.summary.coverage_status,
                horizon_comp=horizon_comp,
                horizon_bound=horizon_bound,
            )

            combined_st = self._determine_combined_state(sun_vis, earth_vis)

            h_sun = float(np.interp(sun_pos.azimuth_deg % 360.0, horizon_az, horizon_el, period=360.0))
            h_earth = float(np.interp(earth_pos.azimuth_deg % 360.0, horizon_az, horizon_el, period=360.0))

            series.append(
                VisibilityTimeSeriesPoint(
                    timestamp_iso=cur_iso,
                    ephemeris_time_tdb=round(float(cur_et), 4),
                    sun_azimuth_deg=sun_pos.azimuth_deg,
                    sun_elevation_deg=sun_pos.elevation_deg,
                    sun_visible_fraction=sun_vis.visible_fraction,
                    sun_visibility_state=sun_vis.visibility_state,
                    earth_azimuth_deg=earth_pos.azimuth_deg,
                    earth_elevation_deg=earth_pos.elevation_deg,
                    earth_visible_fraction=earth_vis.visible_fraction,
                    earth_visibility_state=earth_vis.visibility_state,
                    combined_state=combined_st,
                    terrain_elevation_sun_az_deg=round(h_sun, 3),
                    terrain_elevation_earth_az_deg=round(h_earth, 3),
                )
            )

            cur_et += step_seconds

        # 5. Detect and Refine Transitions (Sunrise, Sunset, Earthrise, Earthset)
        transitions = self._detect_transitions(
            series=series,
            obs_pos=obs_pos_moon_me,
            u_east=u_east,
            u_north=u_north,
            u_up=u_up,
            abcorr=abcorr,
            horizon_az=horizon_az,
            horizon_el=horizon_el,
            coverage_status=h_resp.summary.coverage_status,
            horizon_comp=horizon_comp,
            horizon_bound=horizon_bound,
        )

        # 6. Calculate Rigorous Mission Metrics
        solar_metrics, earth_metrics, combined_metrics = self._calculate_metrics(
            series=series,
            transitions=transitions,
            step_hours=req.step_interval_hours,
            total_duration_hours=(et_end - et_start) / 3600.0,
        )

        provenance = {
            "terrain_dem": h_resp.dataset_name,
            "dem_reference_frame": h_resp.reference_frame,
            "ephemeris_provenance": self.kernel_mgr.get_provenance_metadata(),
            "step_interval_hours": req.step_interval_hours,
            "total_epochs": len(series),
            "disk_integration_method": "SLICED_SPHERICAL_DISK_INTEGRATION (31 horizontal slices)",
            "transition_refinement_tolerance_seconds": 15.0,
        }

        return VisibilityAnalysisResponse(
            latitude=req.latitude,
            longitude=req.longitude,
            observer_surface_elevation_m=round(surface_elev_m, 2),
            observer_height_m=req.observer_height_m,
            start_timestamp_iso=req.start_timestamp_iso,
            end_timestamp_iso=req.end_timestamp_iso,
            step_interval_hours=req.step_interval_hours,
            total_epochs_computed=len(series),
            series=series,
            transitions=transitions,
            solar_metrics=solar_metrics,
            earth_metrics=earth_metrics,
            combined_metrics=combined_metrics,
            terrain_horizon_summary=h_resp.summary,
            horizon_profile=h_resp.horizon_profile,
            warnings=warnings,
            provenance=provenance,
        )

    def _extract_horizon_arrays(
        self, profile: List[HorizonPoint]
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        """
        Extracts sorted azimuth, elevation, completeness, and external elevation bound
        arrays with 360-degree wrapping for circular interpolation.
        """
        az_list = [p.azimuth_deg for p in profile]
        el_list = [p.horizon_elevation_deg for p in profile]
        comp_list = [1.0 if getattr(p, "ray_coverage_complete", True) else 0.0 for p in profile]
        bound_list = [float(getattr(p, "external_elevation_bound_deg", 90.0)) for p in profile]

        # Ensure sorted
        order = np.argsort(az_list)
        az_sorted = np.array(az_list)[order]
        el_sorted = np.array(el_list)[order]
        comp_sorted = np.array(comp_list)[order]
        bound_sorted = np.array(bound_list)[order]

        # Append 360.0 duplicate if 0.0 is present for seamless interpolation
        if len(az_sorted) > 0 and az_sorted[0] == 0.0 and az_sorted[-1] < 360.0:
            az_sorted = np.append(az_sorted, 360.0)
            el_sorted = np.append(el_sorted, el_sorted[0])
            comp_sorted = np.append(comp_sorted, comp_sorted[0])
            bound_sorted = np.append(bound_sorted, bound_sorted[0])

        return az_sorted, el_sorted, comp_sorted, bound_sorted

    def _evaluate_disk_visibility(
        self,
        body_name: str,
        azimuth_deg: float,
        elevation_deg: float,
        angular_diameter_deg: float,
        distance_km: float,
        light_time_seconds: float,
        horizon_az: np.ndarray,
        horizon_el: np.ndarray,
        coverage_status: str,
        horizon_comp: Optional[np.ndarray] = None,
        horizon_bound: Optional[np.ndarray] = None,
        n_slices: int = 31,
    ) -> CelestialDiskVisibility:
        """
        Integrates visible area of celestial disk against local terrain skyline.
        Accounts for terrain variation across the horizontal angular width of the disk.
        Conservatively evaluates coverage certainty based on physical topography bounds.
        """
        ang_radius = angular_diameter_deg / 2.0
        h_center = float(np.interp(azimuth_deg % 360.0, horizon_az, horizon_el, period=360.0))

        if horizon_comp is None:
            if coverage_status == "complete":
                horizon_comp = np.ones_like(horizon_az)
                horizon_bound = np.zeros_like(horizon_az)
            else:
                horizon_comp = np.zeros_like(horizon_az)
                horizon_bound = np.full_like(horizon_az, 90.0)
        elif horizon_bound is None:
            horizon_bound = np.zeros_like(horizon_az) if coverage_status == "complete" else np.full_like(horizon_az, 90.0)

        upper_limb_el = elevation_deg + ang_radius
        lower_limb_el = elevation_deg - ang_radius
        upper_clearance = upper_limb_el - h_center
        lower_clearance = lower_limb_el - h_center

        # Numerical slice integration across horizontal width of disk: xi in [-R, +R]
        cos_el = max(0.01, math.cos(math.radians(elevation_deg)))
        xi_vals = np.linspace(-ang_radius, ang_radius, n_slices)
        d_xi = (2.0 * ang_radius) / (n_slices - 1)

        vis_area = 0.0
        total_unoccluded_area = 0.0
        has_indeterminate_slice = False

        for i, xi in enumerate(xi_vals):
            # Trapezoidal quadrature weight
            w = 0.5 if (i == 0 or i == n_slices - 1) else 1.0

            # Vertical half-chord of circle at offset xi
            y_span = math.sqrt(max(0.0, ang_radius**2 - xi**2))
            y_top = elevation_deg + y_span
            y_bot = elevation_deg - y_span

            # Horizontal angular offset xi is in degrees. On the celestial sphere,
            # daz = xi / cos(elevation) yields the true azimuth offset in degrees.
            az_offset_deg = xi / cos_el
            az_slice = (azimuth_deg + az_offset_deg + 360.0) % 360.0
            h_slice = float(np.interp(az_slice, horizon_az, horizon_el, period=360.0))
            c_slice = float(np.interp(az_slice, horizon_az, horizon_comp, period=360.0))
            b_slice = float(np.interp(az_slice, horizon_az, horizon_bound, period=360.0))

            # Effective lower boundary of visible celestial segment
            effective_bot = max(y_bot, h_slice)
            slice_thickness = max(0.0, y_top - effective_bot)

            vis_area += w * slice_thickness * d_xi
            total_unoccluded_area += w * (2.0 * y_span) * d_xi

            # Conservative Coverage Assessment:
            # If DEM terrain leaves this slice unoccluded, but ray coverage along this azimuth
            # is incomplete and the chord top does not exceed the maximum physical external topography bound,
            # external unmodeled terrain could block this sightline.
            if slice_thickness > 0.0 and c_slice < 0.99 and y_top <= b_slice:
                has_indeterminate_slice = True

        if total_unoccluded_area > 0:
            visible_fraction = float(np.clip(vis_area / total_unoccluded_area, 0.0, 1.0))
        else:
            visible_fraction = 1.0 if elevation_deg > h_center else 0.0

        visible_pct = round(visible_fraction * 100.0, 2)

        # State classification based on DEM skyline
        if visible_fraction >= 0.999:
            state = VisibilityState.FULLY_VISIBLE
            visible_fraction = 1.0
            visible_pct = 100.0
        elif visible_fraction <= 0.001:
            state = VisibilityState.FULLY_OBSTRUCTED
            visible_fraction = 0.0
            visible_pct = 0.0
        else:
            state = VisibilityState.PARTIALLY_VISIBLE

        # Scientific DEM Coverage Certainty:
        # 1. Definite Obstruction: If local DEM already completely obstructs the disk,
        #    it is confirmed because adding unmodeled external terrain cannot un-block it.
        # 2. Definite Visibility: If every slice is unoccluded AND either all contributing rays
        #    are complete or the disk elevation is above the maximum possible external obstacle.
        # 3. Indeterminate: Available DEM terrain does not obstruct the disk, but the sightline
        #    passes through an incomplete or nodata sector below the external obstruction bound.
        certainty = CoverageCertainty.CONFIRMED_EVALUATED
        if state == VisibilityState.FULLY_OBSTRUCTED:
            certainty = CoverageCertainty.CONFIRMED_EVALUATED
        elif has_indeterminate_slice:
            certainty = CoverageCertainty.INDETERMINATE_PARTIAL_DEM
            state = VisibilityState.INDETERMINATE
        elif coverage_status != "complete" and state in (VisibilityState.FULLY_VISIBLE, VisibilityState.PARTIALLY_VISIBLE):
            b_center = float(np.interp(azimuth_deg % 360.0, horizon_az, horizon_bound, period=360.0))
            if upper_limb_el <= b_center:
                certainty = CoverageCertainty.INDETERMINATE_PARTIAL_DEM
                state = VisibilityState.INDETERMINATE

        return CelestialDiskVisibility(
            body_name=body_name,
            azimuth_deg=round(azimuth_deg, 3),
            elevation_deg=round(elevation_deg, 3),
            angular_diameter_deg=round(angular_diameter_deg, 4),
            angular_radius_deg=round(ang_radius, 4),
            distance_km=round(distance_km, 1),
            horizon_elevation_at_azimuth_deg=round(h_center, 3),
            upper_limb_elevation_deg=round(upper_limb_el, 3),
            lower_limb_elevation_deg=round(lower_limb_el, 3),
            upper_limb_clearance_deg=round(upper_clearance, 3),
            lower_limb_clearance_deg=round(lower_clearance, 3),
            visible_fraction=round(visible_fraction, 4),
            visible_percentage=visible_pct,
            visibility_state=state,
            coverage_certainty=certainty,
            light_time_seconds=round(light_time_seconds, 4),
        )

    def _determine_combined_state(
        self, sun_vis: CelestialDiskVisibility, earth_vis: CelestialDiskVisibility
    ) -> CombinedVisibilityState:
        """
        Determines the unified combined visibility classification between Sun and Earth.
        """
        if (
            sun_vis.coverage_certainty == CoverageCertainty.INDETERMINATE_PARTIAL_DEM
            or earth_vis.coverage_certainty == CoverageCertainty.INDETERMINATE_PARTIAL_DEM
            or sun_vis.visibility_state == VisibilityState.INDETERMINATE
            or earth_vis.visibility_state == VisibilityState.INDETERMINATE
        ):
            return CombinedVisibilityState.INDETERMINATE

        sun_on = sun_vis.visible_fraction > 0.0
        earth_on = earth_vis.visible_fraction > 0.0

        if sun_on and earth_on:
            if sun_vis.visible_fraction >= 0.999 and earth_vis.visible_fraction >= 0.999:
                return CombinedVisibilityState.SUN_AND_EARTH_VISIBLE
            return CombinedVisibilityState.PARTIAL_DUAL_VISIBILITY
        elif sun_on and not earth_on:
            return CombinedVisibilityState.SUN_VISIBLE_ONLY
        elif not sun_on and earth_on:
            return CombinedVisibilityState.EARTH_VISIBLE_ONLY
        else:
            return CombinedVisibilityState.NEITHER_VISIBLE

    def _detect_transitions(
        self,
        series: List[VisibilityTimeSeriesPoint],
        obs_pos: np.ndarray,
        u_east: np.ndarray,
        u_north: np.ndarray,
        u_up: np.ndarray,
        abcorr: str,
        horizon_az: np.ndarray,
        horizon_el: np.ndarray,
        coverage_status: str,
        horizon_comp: Optional[np.ndarray] = None,
        horizon_bound: Optional[np.ndarray] = None,
    ) -> List[VisibilityTransitionPoint]:
        """
        Detects visibility state transitions between discrete time-series points
        and refines the exact transition timestamp using bisection root-finding.
        """
        transitions: List[VisibilityTransitionPoint] = []
        if len(series) < 2:
            return transitions

        for i in range(len(series) - 1):
            p0 = series[i]
            p1 = series[i + 1]

            # 1. Sun State Transitions
            if p0.sun_visibility_state != p1.sun_visibility_state:
                # Classify transition type
                if p0.sun_visible_fraction == 0.0 and p1.sun_visible_fraction > 0.0:
                    tr_type = "SUNRISE_START"  # First light (upper limb crosses horizon)
                elif p0.sun_visible_fraction < 1.0 and p1.sun_visible_fraction >= 0.999:
                    tr_type = "SUNRISE_END"    # Full disk risen (lower limb crosses horizon)
                elif p0.sun_visible_fraction >= 0.999 and p1.sun_visible_fraction < 1.0:
                    tr_type = "SUNSET_START"   # Lower limb contacts horizon
                else:
                    tr_type = "SUNSET_END"     # Total darkness (upper limb submerges)

                tr_pt = self._refine_transition(
                    body_name="Sun",
                    target_id="SUN",
                    body_radius_km=SUN_RADIUS_KM,
                    et_a=p0.ephemeris_time_tdb,
                    et_b=p1.ephemeris_time_tdb,
                    tr_type=tr_type,
                    obs_pos=obs_pos,
                    u_east=u_east,
                    u_north=u_north,
                    u_up=u_up,
                    abcorr=abcorr,
                    horizon_az=horizon_az,
                    horizon_el=horizon_el,
                    coverage_status=coverage_status,
                    horizon_comp=horizon_comp,
                    horizon_bound=horizon_bound,
                )
                if tr_pt:
                    transitions.append(tr_pt)

            # 2. Earth State Transitions
            if p0.earth_visibility_state != p1.earth_visibility_state:
                if p0.earth_visible_fraction == 0.0 and p1.earth_visible_fraction > 0.0:
                    tr_type = "EARTHRISE_START"
                elif p0.earth_visible_fraction < 1.0 and p1.earth_visible_fraction >= 0.999:
                    tr_type = "EARTHRISE_END"
                elif p0.earth_visible_fraction >= 0.999 and p1.earth_visible_fraction < 1.0:
                    tr_type = "EARTHSET_START"
                else:
                    tr_type = "EARTHSET_END"

                tr_pt = self._refine_transition(
                    body_name="Earth",
                    target_id="EARTH",
                    body_radius_km=EARTH_EQUATORIAL_RADIUS_KM,
                    et_a=p0.ephemeris_time_tdb,
                    et_b=p1.ephemeris_time_tdb,
                    tr_type=tr_type,
                    obs_pos=obs_pos,
                    u_east=u_east,
                    u_north=u_north,
                    u_up=u_up,
                    abcorr=abcorr,
                    horizon_az=horizon_az,
                    horizon_el=horizon_el,
                    coverage_status=coverage_status,
                    horizon_comp=horizon_comp,
                    horizon_bound=horizon_bound,
                )
                if tr_pt:
                    transitions.append(tr_pt)

        # Sort transitions chronologically
        transitions.sort(key=lambda t: t.ephemeris_time_tdb)
        return transitions

    def _refine_transition(
        self,
        body_name: str,
        target_id: str,
        body_radius_km: float,
        et_a: float,
        et_b: float,
        tr_type: str,
        obs_pos: np.ndarray,
        u_east: np.ndarray,
        u_north: np.ndarray,
        u_up: np.ndarray,
        abcorr: str,
        horizon_az: np.ndarray,
        horizon_el: np.ndarray,
        coverage_status: str,
        horizon_comp: Optional[np.ndarray] = None,
        horizon_bound: Optional[np.ndarray] = None,
        max_iters: int = 7,
    ) -> Optional[VisibilityTransitionPoint]:
        """
        Bisection root-finder to refine the exact timestamp of an ingress/egress limb crossing.
        """
        low = min(et_a, et_b)
        high = max(et_a, et_b)

        best_et = (low + high) / 2.0
        best_vis = None

        for _ in range(max_iters):
            mid = (low + high) / 2.0
            best_et = mid

            with SPICE_LOCK:
                pos = self.ephemeris_svc._calculate_topocentric_body(
                    body_name=body_name,
                    target_spice_id=target_id,
                    et=mid,
                    obs_pos=obs_pos,
                    u_east=u_east,
                    u_north=u_north,
                    u_up=u_up,
                    body_radius_km=body_radius_km,
                    abcorr=abcorr,
                )

            best_vis = self._evaluate_disk_visibility(
                body_name=body_name,
                azimuth_deg=pos.azimuth_deg,
                elevation_deg=pos.elevation_deg,
                angular_diameter_deg=pos.apparent_angular_diameter_deg,
                distance_km=pos.distance_km,
                light_time_seconds=pos.light_time_seconds,
                horizon_az=horizon_az,
                horizon_el=horizon_el,
                coverage_status=coverage_status,
                horizon_comp=horizon_comp,
                horizon_bound=horizon_bound,
            )

            # Check if mid epoch has crossed the threshold based on transition type
            is_start_tr = "START" in tr_type
            if is_start_tr:
                # Target threshold: visible_fraction near 0.05
                if best_vis.visible_fraction > 0.05:
                    high = mid
                else:
                    low = mid
            else:
                # Target threshold: visible_fraction near 0.95
                if best_vis.visible_fraction > 0.95:
                    high = mid
                else:
                    low = mid

        tolerance_sec = (high - low) / 2.0
        with SPICE_LOCK:
            iso = spice.et2utc(best_et, "ISOC", 0) + "Z"

        return VisibilityTransitionPoint(
            transition_type=tr_type,
            timestamp_iso=iso,
            ephemeris_time_tdb=round(float(best_et), 3),
            azimuth_deg=best_vis.azimuth_deg if best_vis else 0.0,
            elevation_deg=best_vis.elevation_deg if best_vis else 0.0,
            visible_fraction=best_vis.visible_fraction if best_vis else 0.0,
            convergence_tolerance_seconds=round(float(tolerance_sec), 2),
        )

    def _calculate_metrics(
        self,
        series: List[VisibilityTimeSeriesPoint],
        transitions: List[VisibilityTransitionPoint],
        step_hours: float,
        total_duration_hours: float,
    ) -> Tuple[SolarMetrics, EarthMetrics, CombinedMetrics]:
        """
        Computes rigorous, mathematically consistent mission durations, run-lengths, and counts.
        Guarantees that all sub-durations sum up exactly to the total duration.
        """
        if not series:
            empty_sol = SolarMetrics(
                total_sun_visible_hours=0.0, total_sun_full_hours=0.0, total_sun_partial_hours=0.0,
                total_darkness_hours=0.0, longest_darkness_hours=0.0, longest_illumination_hours=0.0,
                illumination_fraction=0.0, sunrise_count=0, sunset_count=0,
                max_sun_elevation_deg=0.0, min_sun_elevation_deg=0.0
            )
            empty_earth = EarthMetrics(
                total_earth_visible_hours=0.0, total_earth_full_hours=0.0, total_earth_partial_hours=0.0,
                total_earth_blackout_hours=0.0, longest_earth_blackout_hours=0.0, longest_earth_visible_hours=0.0,
                earth_visibility_fraction=0.0, earthrise_count=0, earthset_count=0,
                max_earth_elevation_deg=0.0, min_earth_elevation_deg=0.0
            )
            empty_comb = CombinedMetrics(
                both_visible_hours=0.0, sun_only_hours=0.0, earth_only_hours=0.0,
                neither_visible_hours=0.0, longest_both_visible_hours=0.0,
                longest_neither_visible_hours=0.0, total_interval_hours=0.0
            )
            return empty_sol, empty_earth, empty_comb

        dt = step_hours
        n = len(series)

        # 1. Solar metrics summation
        sun_full_pts = sum(1 for p in series if p.sun_visibility_state == VisibilityState.FULLY_VISIBLE)
        sun_partial_pts = sum(1 for p in series if p.sun_visibility_state == VisibilityState.PARTIALLY_VISIBLE)
        sun_dark_pts = sum(1 for p in series if p.sun_visibility_state == VisibilityState.FULLY_OBSTRUCTED)

        # Normalization to ensure exact sum = total_duration_hours
        total_pts = float(n)
        sun_full_hours = round((sun_full_pts / total_pts) * total_duration_hours, 2)
        sun_partial_hours = round((sun_partial_pts / total_pts) * total_duration_hours, 2)
        sun_dark_hours = round(max(0.0, total_duration_hours - sun_full_hours - sun_partial_hours), 2)
        sun_vis_hours = round(sun_full_hours + sun_partial_hours, 2)

        # Run-length analysis for longest uninterrupted darkness and illumination
        longest_dark_hrs, dark_start, dark_end = self._calculate_longest_streak(
            series, lambda p: p.sun_visibility_state == VisibilityState.FULLY_OBSTRUCTED, dt
        )
        longest_illum_hrs, _, _ = self._calculate_longest_streak(
            series, lambda p: p.sun_visible_fraction > 0.0, dt
        )

        sunrise_cnt = sum(1 for t in transitions if "SUNRISE" in t.transition_type)
        sunset_cnt = sum(1 for t in transitions if "SUNSET" in t.transition_type)
        sun_elevs = [p.sun_elevation_deg for p in series]

        sol_metrics = SolarMetrics(
            total_sun_visible_hours=sun_vis_hours,
            total_sun_full_hours=sun_full_hours,
            total_sun_partial_hours=sun_partial_hours,
            total_darkness_hours=sun_dark_hours,
            longest_darkness_hours=round(longest_dark_hrs, 2),
            longest_darkness_start_iso=dark_start,
            longest_darkness_end_iso=dark_end,
            longest_illumination_hours=round(longest_illum_hrs, 2),
            illumination_fraction=round(sun_vis_hours / max(0.01, total_duration_hours), 4),
            sunrise_count=sunrise_cnt,
            sunset_count=sunset_cnt,
            max_sun_elevation_deg=round(float(np.max(sun_elevs)), 2),
            min_sun_elevation_deg=round(float(np.min(sun_elevs)), 2),
        )

        # 2. Earth metrics summation
        earth_full_pts = sum(1 for p in series if p.earth_visibility_state == VisibilityState.FULLY_VISIBLE)
        earth_partial_pts = sum(1 for p in series if p.earth_visibility_state == VisibilityState.PARTIALLY_VISIBLE)
        earth_blackout_pts = sum(1 for p in series if p.earth_visibility_state == VisibilityState.FULLY_OBSTRUCTED)

        earth_full_hours = round((earth_full_pts / total_pts) * total_duration_hours, 2)
        earth_partial_hours = round((earth_partial_pts / total_pts) * total_duration_hours, 2)
        earth_blackout_hours = round(max(0.0, total_duration_hours - earth_full_hours - earth_partial_hours), 2)
        earth_vis_hours = round(earth_full_hours + earth_partial_hours, 2)

        longest_blackout_hrs, blk_start, blk_end = self._calculate_longest_streak(
            series, lambda p: p.earth_visibility_state == VisibilityState.FULLY_OBSTRUCTED, dt
        )
        longest_earth_vis_hrs, _, _ = self._calculate_longest_streak(
            series, lambda p: p.earth_visible_fraction > 0.0, dt
        )

        earthrise_cnt = sum(1 for t in transitions if "EARTHRISE" in t.transition_type)
        earthset_cnt = sum(1 for t in transitions if "EARTHSET" in t.transition_type)
        earth_elevs = [p.earth_elevation_deg for p in series]

        earth_metrics = EarthMetrics(
            total_earth_visible_hours=earth_vis_hours,
            total_earth_full_hours=earth_full_hours,
            total_earth_partial_hours=earth_partial_hours,
            total_earth_blackout_hours=earth_blackout_hours,
            longest_earth_blackout_hours=round(longest_blackout_hrs, 2),
            longest_earth_blackout_start_iso=blk_start,
            longest_earth_blackout_end_iso=blk_end,
            longest_earth_visible_hours=round(longest_earth_vis_hrs, 2),
            earth_visibility_fraction=round(earth_vis_hours / max(0.01, total_duration_hours), 4),
            earthrise_count=earthrise_cnt,
            earthset_count=earthset_cnt,
            max_earth_elevation_deg=round(float(np.max(earth_elevs)), 2),
            min_earth_elevation_deg=round(float(np.min(earth_elevs)), 2),
        )

        # 3. Combined metrics summation
        both_pts = sum(1 for p in series if p.sun_visible_fraction > 0.0 and p.earth_visible_fraction > 0.0)
        sun_only_pts = sum(1 for p in series if p.sun_visible_fraction > 0.0 and p.earth_visible_fraction == 0.0)
        earth_only_pts = sum(1 for p in series if p.sun_visible_fraction == 0.0 and p.earth_visible_fraction > 0.0)
        neither_pts = sum(1 for p in series if p.sun_visible_fraction == 0.0 and p.earth_visible_fraction == 0.0)

        both_hrs = round((both_pts / total_pts) * total_duration_hours, 2)
        sun_only_hrs = round((sun_only_pts / total_pts) * total_duration_hours, 2)
        earth_only_hrs = round((earth_only_pts / total_pts) * total_duration_hours, 2)
        neither_hrs = round(max(0.0, total_duration_hours - both_hrs - sun_only_hrs - earth_only_hrs), 2)

        longest_both_hrs, _, _ = self._calculate_longest_streak(
            series, lambda p: p.sun_visible_fraction > 0.0 and p.earth_visible_fraction > 0.0, dt
        )
        longest_neither_hrs, _, _ = self._calculate_longest_streak(
            series, lambda p: p.sun_visible_fraction == 0.0 and p.earth_visible_fraction == 0.0, dt
        )

        comb_metrics = CombinedMetrics(
            both_visible_hours=both_hrs,
            sun_only_hours=sun_only_hrs,
            earth_only_hours=earth_only_hrs,
            neither_visible_hours=neither_hrs,
            longest_both_visible_hours=round(longest_both_hrs, 2),
            longest_neither_visible_hours=round(longest_neither_hrs, 2),
            total_interval_hours=round(total_duration_hours, 2),
        )

        return sol_metrics, earth_metrics, comb_metrics

    def _calculate_longest_streak(
        self,
        series: List[VisibilityTimeSeriesPoint],
        condition,
        dt_hours: float,
    ) -> Tuple[float, Optional[str], Optional[str]]:
        """
        Finds the longest consecutive streak of epochs satisfying `condition`.
        Returns (duration_hours, start_iso, end_iso).
        """
        max_len = 0
        cur_len = 0
        best_start = None
        best_end = None
        cur_start = None

        for p in series:
            if condition(p):
                if cur_len == 0:
                    cur_start = p.timestamp_iso
                cur_len += 1
                if cur_len > max_len:
                    max_len = cur_len
                    best_start = cur_start
                    best_end = p.timestamp_iso
            else:
                cur_len = 0
                cur_start = None

        duration_hours = max_len * dt_hours
        return duration_hours, best_start, best_end

visibility_service = VisibilityEngineService()
