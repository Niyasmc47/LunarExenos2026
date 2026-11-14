import math
from typing import Dict, Any, List, Tuple
from datetime import datetime
import numpy as np
import spiceypy as spice

from app.schemas.ephemeris import (
    EphemerisPositionRequest,
    EphemerisPositionResponse,
    CelestialBodyPosition,
    EphemerisTimeSeriesRequest,
    EphemerisTimeSeriesResponse,
    EphemerisTimeSeriesPoint,
)
from app.services.kernel_manager import kernel_manager, SPICE_LOCK
from app.services.dem_loader import dem_loader
from app.services.coordinate_transform import LUNAR_RADIUS_M

# Standard physical volumetric radii in kilometers from IAU / SPICE PCK
SUN_RADIUS_KM = 696000.0
EARTH_EQUATORIAL_RADIUS_KM = 6378.1366
MOON_RADIUS_KM = LUNAR_RADIUS_M / 1000.0  # 1737.4 km

class EphemerisEngineService:
    def __init__(self):
        self.kernel_mgr = kernel_manager

    def calculate_position(self, req: EphemerisPositionRequest) -> EphemerisPositionResponse:
        """
        Calculates exact topocentric positions of Sun and Earth as observed from
        a specific lunar surface location and observer instrument height at epoch.
        """
        with SPICE_LOCK:
            try:
                self.kernel_mgr.ensure_kernels_loaded()
                warnings: List[str] = []

                # 1. Parse Time: convert ISO 8601 string to SPICE Ephemeris Time (ET / TDB seconds past J2000)
                try:
                    et = spice.str2et(req.timestamp_iso)
                except Exception as e:
                    raise ValueError(f"Invalid timestamp format or out-of-range epoch: '{req.timestamp_iso}'. Error: {e}")

                # Validate epoch within high-precision DE421 / PCK coverage window (1900-01-01 to 2050-12-31)
                et_min = -3155760000.0  # 1900-01-01T00:00:00Z
                et_max = 1609459200.0   # 2050-12-31T23:59:59Z
                if not (et_min <= et <= et_max):
                    raise ValueError(
                        f"Requested epoch '{req.timestamp_iso}' (ET {et:.1f}s) is outside high-precision DE421 / PCK "
                        f"coverage window (1900-01-01 to 2050-12-31)."
                    )

                # 2. Sample Surface Elevation from LOLA DEM
                sample = dem_loader.sample_point(req.latitude, req.longitude)
                if sample.get("in_bounds") and sample.get("elevation_m") is not None:
                    surface_elev_m = float(sample["elevation_m"])
                else:
                    surface_elev_m = 0.0
                    warnings.append(
                        f"Coordinates ({req.latitude:.4f}°, {req.longitude:.4f}°) are outside the active high-resolution DEM; "
                        f"assuming 0.0 m elevation relative to IAU 1,737.4 km lunar sphere."
                    )

                total_observer_elev_m = surface_elev_m + req.observer_height_m
                obs_radius_km = MOON_RADIUS_KM + (total_observer_elev_m / 1000.0)

                # 3. Observer Cartesian Position and Local Tangent Basis in MOON_ME
                phi = math.radians(req.latitude)
                lam = math.radians(req.longitude)

                # Observer position vector in MOON_ME (km)
                obs_pos_moon_me = np.array([
                    obs_radius_km * math.cos(phi) * math.cos(lam),
                    obs_radius_km * math.cos(phi) * math.sin(lam),
                    obs_radius_km * math.sin(phi),
                ], dtype=np.float64)

                # Local Tangent Orthonormal Basis:
                # Local East: direction of increasing longitude along parallel
                u_east = np.array([-math.sin(lam), math.cos(lam), 0.0], dtype=np.float64)
                # Local North: direction of increasing latitude along meridian toward +90°
                u_north = np.array([-math.sin(phi) * math.cos(lam), -math.sin(phi) * math.sin(lam), math.cos(phi)], dtype=np.float64)
                # Local Up: outward surface normal
                u_up = np.array([math.cos(phi) * math.cos(lam), math.cos(phi) * math.sin(lam), math.sin(phi)], dtype=np.float64)

                # Validate aberration correction input
                abcorr = req.aberration_correction.upper()
                if abcorr not in ["NONE", "LT", "LT+S"]:
                    abcorr = "LT+S"
                    warnings.append(f"Unsupported aberration correction requested; defaulted to 'LT+S' (apparent position).")

                # 4. Topocentric Sun Position
                sun_pos = self._calculate_topocentric_body(
                    body_name="Sun",
                    target_spice_id="SUN",
                    et=et,
                    obs_pos=obs_pos_moon_me,
                    u_east=u_east,
                    u_north=u_north,
                    u_up=u_up,
                    body_radius_km=SUN_RADIUS_KM,
                    abcorr=abcorr,
                )

                # 5. Topocentric Earth Position
                earth_pos = self._calculate_topocentric_body(
                    body_name="Earth",
                    target_spice_id="EARTH",
                    et=et,
                    obs_pos=obs_pos_moon_me,
                    u_east=u_east,
                    u_north=u_north,
                    u_up=u_up,
                    body_radius_km=EARTH_EQUATORIAL_RADIUS_KM,
                    abcorr=abcorr,
                )

                return EphemerisPositionResponse(
                    observer_latitude=round(req.latitude, 6),
                    observer_longitude=round(req.longitude, 6),
                    observer_surface_elevation_m=round(surface_elev_m, 2),
                    observer_height_m=req.observer_height_m,
                    total_observer_elevation_m=round(total_observer_elev_m, 2),
                    observer_cartesian_moon_me_km=[round(float(c), 4) for c in obs_pos_moon_me],
                    requested_timestamp_iso=req.timestamp_iso,
                    ephemeris_time_tdb_seconds=round(float(et), 4),
                    sun=sun_pos,
                    earth=earth_pos,
                    reference_frame="MOON_ME (DE421)",
                    aberration_correction=abcorr,
                    lunar_radius_model_m=LUNAR_RADIUS_M,
                    dataset_id=req.dataset_id,
                    kernel_provenance=self.kernel_mgr.get_provenance_metadata(),
                    warnings=warnings,
                )
            except Exception:
                try:
                    spice.reset()
                except Exception:
                    pass
                raise

    def calculate_timeseries(self, req: EphemerisTimeSeriesRequest) -> EphemerisTimeSeriesResponse:
        """
        Calculates time-series trajectories of Sun and Earth positions across a defined time interval.
        """
        with SPICE_LOCK:
            try:
                self.kernel_mgr.ensure_kernels_loaded()
                warnings: List[str] = []

                try:
                    et_start = spice.str2et(req.start_timestamp_iso)
                    et_end = spice.str2et(req.end_timestamp_iso)
                except Exception as e:
                    raise ValueError(f"Invalid start or end timestamp format: {e}")

                # Validate epochs within high-precision DE421 / PCK coverage window (1900-01-01 to 2050-12-31)
                et_min = -3155760000.0  # 1900-01-01T00:00:00Z
                et_max = 1609459200.0   # 2050-12-31T23:59:59Z
                if not (et_min <= et_start <= et_max) or not (et_min <= et_end <= et_max):
                    raise ValueError(
                        f"Requested interval [{req.start_timestamp_iso}, {req.end_timestamp_iso}] is outside "
                        f"high-precision DE421 / PCK coverage window (1900-01-01 to 2050-12-31)."
                    )

                if et_end <= et_start:
                    raise ValueError("End timestamp must be strictly after start timestamp.")

                step_seconds = req.step_interval_hours * 3600.0
                total_steps = int(math.ceil((et_end - et_start) / step_seconds)) + 1

                if total_steps > 1500:
                    raise ValueError(
                        f"Requested interval yields {total_steps} epochs, which exceeds the limit of 1500 samples. "
                        f"Increase step_interval_hours or narrow the time window."
                    )

                # Sample Surface Elevation
                sample = dem_loader.sample_point(req.latitude, req.longitude)
                if sample.get("in_bounds") and sample.get("elevation_m") is not None:
                    surface_elev_m = float(sample["elevation_m"])
                else:
                    surface_elev_m = 0.0

                total_observer_elev_m = surface_elev_m + req.observer_height_m
                obs_radius_km = MOON_RADIUS_KM + (total_observer_elev_m / 1000.0)

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

                series: List[EphemerisTimeSeriesPoint] = []
                cur_et = et_start
                for _ in range(total_steps):
                    if cur_et > et_end + 1e-3:
                        break

                    # Format UTC ISO string for this epoch
                    cur_iso = spice.et2utc(cur_et, "ISOC", 0) + "Z"

                    sun_pt = self._calculate_topocentric_body(
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

                    earth_pt = self._calculate_topocentric_body(
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

                    series.append(
                        EphemerisTimeSeriesPoint(
                            timestamp_iso=cur_iso,
                            ephemeris_time_tdb=round(float(cur_et), 4),
                            sun_azimuth_deg=sun_pt.azimuth_deg,
                            sun_elevation_deg=sun_pt.elevation_deg,
                            sun_distance_km=sun_pt.distance_km,
                            sun_angular_diameter_deg=sun_pt.apparent_angular_diameter_deg,
                            earth_azimuth_deg=earth_pt.azimuth_deg,
                            earth_elevation_deg=earth_pt.elevation_deg,
                            earth_distance_km=earth_pt.distance_km,
                            earth_angular_diameter_deg=earth_pt.apparent_angular_diameter_deg,
                        )
                    )

                    cur_et += step_seconds

                return EphemerisTimeSeriesResponse(
                    observer_latitude=round(req.latitude, 6),
                    observer_longitude=round(req.longitude, 6),
                    observer_surface_elevation_m=round(surface_elev_m, 2),
                    observer_height_m=req.observer_height_m,
                    start_timestamp_iso=req.start_timestamp_iso,
                    end_timestamp_iso=req.end_timestamp_iso,
                    step_interval_hours=req.step_interval_hours,
                    total_epochs_computed=len(series),
                    series=series,
                    reference_frame="MOON_ME (DE421)",
                    aberration_correction=abcorr,
                    kernel_provenance=self.kernel_mgr.get_provenance_metadata(),
                    warnings=warnings,
                )
            except Exception:
                try:
                    spice.reset()
                except Exception:
                    pass
                raise

    def _calculate_topocentric_body(
        self,
        body_name: str,
        target_spice_id: str,
        et: float,
        obs_pos: np.ndarray,
        u_east: np.ndarray,
        u_north: np.ndarray,
        u_up: np.ndarray,
        body_radius_km: float,
        abcorr: str = "LT+S",
    ) -> CelestialBodyPosition:
        """
        Calculates rigorous topocentric direction vector, azimuth, elevation, and angular diameter
        using SPICE spkcpo (constant-position observer state evaluation with surface light-time solution).
        """
        # Rigorous topocentric state using SPICE spkcpo:
        # Evaluates light-time iteration and stellar aberration directly from the observer surface location
        state, lt = spice.spkcpo(
            target_spice_id,
            et,
            "MOON_ME",
            "OBSERVER",
            abcorr,
            obs_pos,
            "MOON",
            "MOON_ME",
        )
        rho = np.array(state[:3], dtype=np.float64)
        dist_km = float(np.linalg.norm(rho))

        # Project into local tangent orthonormal coordinates
        x_east = float(np.dot(rho, u_east))
        y_north = float(np.dot(rho, u_north))
        z_up = float(np.dot(rho, u_up))

        # Local Elevation: angle above horizontal tangent plane
        horiz_dist = math.hypot(x_east, y_north)
        elevation_rad = math.atan2(z_up, horiz_dist)
        elevation_deg = math.degrees(elevation_rad)

        # Local Azimuth: clockwise angle from North (0° = N, 90° = E, 180° = S, 270° = W)
        azimuth_deg = (math.degrees(math.atan2(x_east, y_north)) + 360.0) % 360.0

        # Apparent Angular Diameter (subtended angle of disk)
        # sin(theta/2) = R / dist => theta = 2 * arcsin(R / dist)
        if dist_km > body_radius_km:
            ang_diam_deg = math.degrees(2.0 * math.asin(body_radius_km / dist_km))
        else:
            ang_diam_deg = 180.0

        return CelestialBodyPosition(
            body_name=body_name,
            azimuth_deg=round(azimuth_deg, 3),
            elevation_deg=round(elevation_deg, 3),
            distance_km=round(dist_km, 1),
            apparent_angular_diameter_deg=round(ang_diam_deg, 4),
            topocentric_vector_moon_me_km=[round(float(c), 3) for c in rho],
            light_time_seconds=round(float(lt), 4),
        )

ephemeris_service = EphemerisEngineService()
