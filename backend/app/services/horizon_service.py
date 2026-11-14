import math
from typing import Dict, Any, List, Optional, Tuple
from pathlib import Path
import numpy as np
import scipy.ndimage as ndimage
import rasterio
from rasterio.windows import Window

from app.schemas.horizon import (
    HorizonAnalysisRequest,
    HorizonAnalysisResponse,
    HorizonPoint,
    HorizonSummary,
)
from app.services.coordinate_transform import (
    transformer,
    LUNAR_RADIUS_M,
)
from app.services.dem_loader import DemLoaderService, SITE01_DIR
from app.services.dataset_catalogue import catalogue_service

class HorizonEngineService:
    def __init__(self, data_dir: Path = SITE01_DIR):
        self.data_dir = data_dir
        self.default_loader = DemLoaderService(data_dir=data_dir)
        self.catalogue = catalogue_service

    def calculate_horizon(self, request: HorizonAnalysisRequest) -> HorizonAnalysisResponse:
        """
        Calculates the 360-degree lunar terrain horizon elevation profile from an observer location.
        Accounts for:
        1. Observer surface elevation from NASA LOLA DEM.
        2. Configurable observer instrument height (e.g., 0m, 1m, 2m, 10m).
        3. Exact lunar spherical curvature (Moon reference radius R = 1,737,400.0 m).
        4. Elevation angle relative to the observer's local horizontal tangent plane.
        """
        # Determine dataset source
        record = self.catalogue.get_by_id(request.dataset_id)
        if not record:
            record = self.catalogue.get_by_id("site01")

        dataset_name = record.name if record else "NASA LOLA 5m DEM"
        citation = (
            record.citation
            if record and record.citation
            else "Barker et al. (2021), Planetary and Space Science, 203, 105119"
        )
        reference_frame = record.reference_frame if record else "MOON_ME (DE421)"

        surf_path = None
        if record and record.is_local_available and record.local_surf_path:
            surf_path = record.local_surf_path
        elif self.default_loader.is_available():
            surf_path = str(self.default_loader.surf_path)

        if not surf_path or not Path(surf_path).exists():
            raise FileNotFoundError(f"Terrain DEM raster not found for dataset {request.dataset_id}")

        # Open DEM raster and compute horizon
        with rasterio.open(surf_path) as src:
            return self.calculate_horizon_from_raster(
                src=src,
                lat=request.latitude,
                lon=request.longitude,
                observer_height_m=request.observer_height_m,
                azimuth_resolution_deg=request.azimuth_resolution_deg,
                max_search_distance_m=request.max_search_distance_m,
                sampling_interval_m=request.sampling_interval_m,
                dataset_id=request.dataset_id,
                dataset_name=dataset_name,
                reference_frame=reference_frame,
                citation=citation,
            )

    def calculate_horizon_from_raster(
        self,
        src: rasterio.DatasetReader,
        lat: float,
        lon: float,
        observer_height_m: float = 2.0,
        azimuth_resolution_deg: float = 1.0,
        max_search_distance_m: float = 15000.0,
        sampling_interval_m: float = 15.0,
        dataset_id: str = "site01",
        dataset_name: str = "NASA LOLA 5m DEM",
        reference_frame: str = "MOON_ME (DE421)",
        citation: str = "Barker et al. (2021)",
    ) -> HorizonAnalysisResponse:
        """
        Core vectorized horizon calculation given an open rasterio dataset reader or array.
        """
        warnings: List[str] = []

        # 1. Observer Projected Coordinates (South Polar Stereographic)
        obs_x, obs_y = transformer.lat_lon_to_xy(lat, lon)
        bounds = src.bounds

        # Check if observer is inside DEM bounds
        if not (bounds.left <= obs_x <= bounds.right and bounds.bottom <= obs_y <= bounds.top):
            warnings.append(
                f"Observer coordinates ({lat:.4f}°, {lon:.4f}°) are outside the active DEM boundary."
            )
            return self._build_empty_response(
                lat=lat,
                lon=lon,
                obs_height=observer_height_m,
                status="no_data",
                warnings=warnings,
                dataset_id=dataset_id,
                dataset_name=dataset_name,
                reference_frame=reference_frame,
                citation=citation,
                params={
                    "azimuth_resolution_deg": azimuth_resolution_deg,
                    "max_search_distance_m": max_search_distance_m,
                    "sampling_interval_m": sampling_interval_m,
                },
            )

        # 2. Windowed Raster Read around Observer (Observer ± max_search_distance_m)
        buffer_m = max_search_distance_m + 100.0
        win_left = max(bounds.left, obs_x - buffer_m)
        win_right = min(bounds.right, obs_x + buffer_m)
        win_bottom = max(bounds.bottom, obs_y - buffer_m)
        win_top = min(bounds.top, obs_y + buffer_m)

        # Window in pixel space
        inv_transform = ~src.transform
        col_min, row_max = inv_transform @ (win_left, win_bottom)
        col_max, row_min = inv_transform @ (win_right, win_top)

        col_start = int(math.floor(min(col_min, col_max)))
        col_end = int(math.ceil(max(col_min, col_max)))
        row_start = int(math.floor(min(row_min, row_max)))
        row_end = int(math.ceil(max(row_min, row_max)))

        col_start = max(0, min(src.width - 1, col_start))
        col_end = max(col_start + 1, min(src.width, col_end))
        row_start = max(0, min(src.height - 1, row_start))
        row_end = max(row_start + 1, min(src.height, row_end))

        window = Window(
            col_off=col_start,
            row_off=row_start,
            width=col_end - col_start,
            height=row_end - row_start,
        )

        win_data = src.read(1, window=window).astype(np.float32)
        nodata = src.nodata
        if nodata is not None:
            win_data[win_data == nodata] = np.nan

        # Affine transform for the extracted window
        win_transform = src.window_transform(window)
        win_inv_transform = ~win_transform

        # 3. Sample Observer Ground Elevation h0
        obs_col, obs_row = win_inv_transform @ (obs_x, obs_y)
        obs_h0_val = ndimage.map_coordinates(
            win_data,
            [[obs_row], [obs_col]],
            order=1,
            mode="constant",
            cval=np.nan,
        )[0]

        if np.isnan(obs_h0_val):
            warnings.append(
                "Observer ground elevation is NoData in this DEM region."
            )
            return self._build_empty_response(
                lat=lat,
                lon=lon,
                obs_height=observer_height_m,
                status="no_data",
                warnings=warnings,
                dataset_id=dataset_id,
                dataset_name=dataset_name,
                reference_frame=reference_frame,
                citation=citation,
                params={
                    "azimuth_resolution_deg": azimuth_resolution_deg,
                    "max_search_distance_m": max_search_distance_m,
                    "sampling_interval_m": sampling_interval_m,
                },
            )

        obs_h0 = float(obs_h0_val)
        r_moon = LUNAR_RADIUS_M
        # Total observer distance from Moon center
        r0 = r_moon + obs_h0 + observer_height_m

        # 4. Generate Vectorized Ray Sample Grid
        azimuths = np.arange(0.0, 360.0, azimuth_resolution_deg, dtype=np.float32)
        distances = np.arange(
            sampling_interval_m,
            max_search_distance_m + 1e-4,
            sampling_interval_m,
            dtype=np.float32,
        )

        n_az = len(azimuths)
        n_dist = len(distances)

        # Azimuth angle direction in South Polar Stereographic:
        # At meridian lambda_0 = lon_0, North is away from pole, East is +longitude.
        # Identity: vx = sin(lambda_0 + azimuth), vy = cos(lambda_0 + azimuth)
        lam0_rad = lon * (math.pi / 180.0)
        az_rad = azimuths * (np.pi / 180.0)
        total_angle = lam0_rad + az_rad

        vx = np.sin(total_angle).astype(np.float32)  # shape (n_az,)
        vy = np.cos(total_angle).astype(np.float32)  # shape (n_az,)

        # Broadcast 2D coordinates: shape (n_az, n_dist)
        # ray_x = obs_x + vx[:, None] * distances[None, :]
        ray_x = obs_x + np.outer(vx, distances)
        ray_y = obs_y + np.outer(vy, distances)

        # Convert projected coordinates to window pixel coordinates
        # Using affine transform coefficients:
        # col = a*x + b*y + c, row = d*x + e*y + f
        inv_a, inv_b, inv_c = win_inv_transform.a, win_inv_transform.b, win_inv_transform.c
        inv_d, inv_e, inv_f = win_inv_transform.d, win_inv_transform.e, win_inv_transform.f

        ray_cols = inv_a * ray_x + inv_b * ray_y + inv_c
        ray_rows = inv_d * ray_x + inv_e * ray_y + inv_f

        # Bilinear sample elevations using scipy.ndimage
        sampled_elevations = ndimage.map_coordinates(
            win_data,
            [ray_rows.ravel(), ray_cols.ravel()],
            order=1,
            mode="constant",
            cval=np.nan,
        ).reshape((n_az, n_dist))

        # Check bounds: coordinates outside the window must be NaN
        out_of_win_mask = (
            (ray_cols < 0)
            | (ray_cols >= win_data.shape[1] - 1)
            | (ray_rows < 0)
            | (ray_rows >= win_data.shape[0] - 1)
        )
        sampled_elevations[out_of_win_mask] = np.nan

        # 5. Scientific Curvature and Horizon Calculation
        # Distance arc on sphere: alpha = d / R_moon
        # Rs = R_moon + h(d)
        # tan(gamma) = (Rs * cos(alpha) - R0) / (Rs * sin(alpha))
        alphas = distances / r_moon  # shape (n_dist,)
        cos_alphas = np.cos(alphas)  # shape (n_dist,)
        sin_alphas = np.sin(alphas)  # shape (n_dist,)

        rs = r_moon + sampled_elevations  # shape (n_az, n_dist)
        delta_z = rs * cos_alphas[None, :] - r0
        delta_x = rs * sin_alphas[None, :]

        # Apparent elevation angle in degrees
        elevation_angles_deg = np.arctan2(delta_z, delta_x) * (180.0 / np.pi)

        # 6. Extract Horizon (Maximum Elevation Angle per Azimuth Ray)
        valid_mask = ~np.isnan(elevation_angles_deg)

        horizon_profile: List[HorizonPoint] = []
        max_angles = []
        min_angles = []
        partial_count = 0
        nodata_count = 0

        for i in range(n_az):
            az_deg = float(azimuths[i])
            row_valid = valid_mask[i]
            valid_count_i = int(np.sum(row_valid))

            if valid_count_i == 0:
                # No valid samples along this ray
                nodata_count += 1
                horizon_profile.append(
                    HorizonPoint(
                        azimuth_deg=az_deg,
                        horizon_elevation_deg=0.0,
                        distance_to_horizon_m=0.0,
                        horizon_surface_elevation_m=obs_h0,
                        horizon_lat=lat,
                        horizon_lon=lon,
                    )
                )
                continue

            if valid_count_i < n_dist:
                partial_count += 1

            valid_angles = elevation_angles_deg[i, row_valid]
            valid_dist = distances[row_valid]
            valid_elev = sampled_elevations[i, row_valid]
            valid_x = ray_x[i, row_valid]
            valid_y = ray_y[i, row_valid]

            best_idx = int(np.argmax(valid_angles))
            max_ang = float(valid_angles[best_idx])
            best_dist = float(valid_dist[best_idx])
            best_elev = float(valid_elev[best_idx])
            best_px = float(valid_x[best_idx])
            best_py = float(valid_y[best_idx])

            h_lat, h_lon = transformer.xy_to_lat_lon(best_px, best_py)

            max_angles.append(max_ang)
            horizon_profile.append(
                HorizonPoint(
                    azimuth_deg=round(az_deg, 2),
                    horizon_elevation_deg=round(max_ang, 3),
                    distance_to_horizon_m=round(best_dist, 1),
                    horizon_surface_elevation_m=round(best_elev, 2),
                    horizon_lat=round(h_lat, 6),
                    horizon_lon=round(h_lon, 6),
                )
            )

        # 7. Coverage Assessment and Warnings
        if nodata_count == n_az:
            coverage_status = "no_data"
            warnings.append("Entire search radius contains no valid DEM elevation data.")
        elif partial_count > 0 or nodata_count > 0:
            coverage_status = "partial"
            warnings.append(
                f"Partial DEM coverage: {partial_count} rays exited dataset boundary before "
                f"reaching maximum search radius ({max_search_distance_m:.0f} m)."
            )
        else:
            coverage_status = "complete"

        if max_angles:
            max_elev = float(np.max(max_angles))
            max_elev_idx = int(np.argmax(max_angles))
            max_elev_az = float(horizon_profile[max_elev_idx].azimuth_deg)

            min_elev = float(np.min(max_angles))
            min_elev_idx = int(np.argmin(max_angles))
            min_elev_az = float(horizon_profile[min_elev_idx].azimuth_deg)

            mean_elev = float(np.mean(max_angles))
        else:
            max_elev = 0.0
            max_elev_az = 0.0
            min_elev = 0.0
            min_elev_az = 0.0
            mean_elev = 0.0

        summary = HorizonSummary(
            max_horizon_elevation_deg=round(max_elev, 3),
            max_horizon_azimuth_deg=round(max_elev_az, 2),
            min_horizon_elevation_deg=round(min_elev, 3),
            min_horizon_azimuth_deg=round(min_elev_az, 2),
            mean_horizon_elevation_deg=round(mean_elev, 3),
            total_azimuths_computed=n_az,
            valid_samples_count=int(np.sum(valid_mask)),
            coverage_status=coverage_status,
        )

        return HorizonAnalysisResponse(
            observer_lat=round(lat, 6),
            observer_lon=round(lon, 6),
            observer_surface_elevation_m=round(obs_h0, 2),
            observer_height_m=observer_height_m,
            total_observer_elevation_m=round(obs_h0 + observer_height_m, 2),
            summary=summary,
            horizon_profile=horizon_profile,
            parameters={
                "azimuth_resolution_deg": azimuth_resolution_deg,
                "max_search_distance_m": max_search_distance_m,
                "sampling_interval_m": sampling_interval_m,
                "lunar_radius_m": r_moon,
            },
            warnings=warnings,
            dataset_id=dataset_id,
            dataset_name=dataset_name,
            reference_frame=reference_frame,
            citation=citation,
        )

    def _build_empty_response(
        self,
        lat: float,
        lon: float,
        obs_height: float,
        status: str,
        warnings: List[str],
        dataset_id: str,
        dataset_name: str,
        reference_frame: str,
        citation: str,
        params: Dict[str, Any],
    ) -> HorizonAnalysisResponse:
        return HorizonAnalysisResponse(
            observer_lat=lat,
            observer_lon=lon,
            observer_surface_elevation_m=0.0,
            observer_height_m=obs_height,
            total_observer_elevation_m=obs_height,
            summary=HorizonSummary(
                max_horizon_elevation_deg=0.0,
                max_horizon_azimuth_deg=0.0,
                min_horizon_elevation_deg=0.0,
                min_horizon_azimuth_deg=0.0,
                mean_horizon_elevation_deg=0.0,
                total_azimuths_computed=0,
                valid_samples_count=0,
                coverage_status=status,
            ),
            horizon_profile=[],
            parameters=params,
            warnings=warnings,
            dataset_id=dataset_id,
            dataset_name=dataset_name,
            reference_frame=reference_frame,
            citation=citation,
        )

horizon_service = HorizonEngineService()
