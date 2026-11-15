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
import numpy as np
import rasterio
from rasterio.windows import Window

from app.schemas.mission_profile import (
    MissionProfile,
    RequirementClassification,
    SingleRequirement,
)
from app.schemas.scenario import ScenarioRecord
from app.schemas.screening import (
    ScreeningVerdict,
    DataCoverageStatus,
)
from app.schemas.terrain_assessment import (
    TerrainSuitabilityStatus,
    ElevationAssessmentMetrics,
    SlopeAssessmentMetrics,
    RoughnessAssessmentMetrics,
    FootprintDataQuality,
    EvaluatedTerrainRequirement,
    CandidateTerrainAssessment,
    TerrainAssessmentRequest,
    TerrainAssessmentRecord,
    TerrainAssessmentResponse,
)
from app.services.mission_profile_service import mission_profile_service, MissionProfileService
from app.services.scenario_service import scenario_service, ScenarioEngineService
from app.services.dem_loader import dem_loader, DemLoaderService
from app.services.dataset_catalogue import catalogue_service, DatasetCatalogueService
from app.services.coordinate_transform import transformer
from app.services.slope_service import slope_service

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
TERRAIN_ASSESSMENTS_FILE = DATA_DIR / "terrain_assessments.json"

MANDATORY_SCIENTIFIC_DISCLAIMERS: List[str] = [
    "Elevation measurements are referenced to the IAU Moon 2000 Reference Sphere (R = 1,737,400.0 m) and do not represent spacecraft altitude above ground.",
    "Surface slope alone does not guarantee lunar landing safety, regolith trafficability, or rover navigability.",
    "Terrain roughness is not a substitute for boulder detection. Small-scale meter-level boulder hazards are below LOLA 5 m/pixel raster resolution.",
    "A digital elevation model does not establish subsurface bearing capacity, soil cohesion, or geotechnical mechanical properties.",
    "A 5 m nominal grid spacing does not guarantee 5 m effective measurement resolution (raster values between LOLA ground tracks are interpolated).",
    "A point measurement does not certify the suitability of an entire landing footprint.",
    "Partial DEM coverage cannot certify the missing terrain.",
]

class TerrainAssessmentService:
    def __init__(
        self,
        storage_path: Optional[Path] = None,
        profile_svc: Optional[MissionProfileService] = None,
        scen_svc: Optional[ScenarioEngineService] = None,
        dem_loader_svc: Optional[DemLoaderService] = None,
        catalogue_svc: Optional[DatasetCatalogueService] = None,
    ):
        self.storage_file = storage_path or TERRAIN_ASSESSMENTS_FILE
        self.profile_svc = profile_svc or mission_profile_service
        self.scenario_svc = scen_svc or scenario_service
        self.dem_loader_svc = dem_loader_svc or dem_loader
        self.catalogue_svc = catalogue_svc or catalogue_service

        self._lock = threading.Lock()
        self._assessments: Dict[str, TerrainAssessmentRecord] = {}
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
                                    rec = TerrainAssessmentRecord.model_validate(item)
                                    self._assessments[rec.id] = rec
                                except Exception:
                                    pass
                except Exception:
                    self._assessments = {}

    def _save_to_storage_unlocked(self):
        self.storage_file.parent.mkdir(parents=True, exist_ok=True)
        temp_file = self.storage_file.with_suffix(".tmp")
        try:
            records = [rec.model_dump(mode="json") for rec in self._assessments.values()]
            with open(temp_file, "w", encoding="utf-8") as f:
                json.dump(records, f, indent=2)
            temp_file.replace(self.storage_file)
        except Exception:
            if temp_file.exists():
                try:
                    temp_file.unlink()
                except Exception:
                    pass

    def list_assessments(self) -> List[TerrainAssessmentRecord]:
        with self._lock:
            items = list(self._assessments.values())
            items.sort(key=lambda r: r.created_at_iso, reverse=True)
            return items

    def get_assessment(self, assessment_id: str) -> Optional[TerrainAssessmentRecord]:
        with self._lock:
            return self._assessments.get(assessment_id)

    def delete_assessment(self, assessment_id: str) -> bool:
        with self._lock:
            if assessment_id in self._assessments:
                del self._assessments[assessment_id]
                self._save_to_storage_unlocked()
                return True
            return False

    def assess_candidates(self, req: TerrainAssessmentRequest) -> TerrainAssessmentRecord:
        """
        Executes a deterministic scientific terrain suitability assessment for candidate
        lunar scenarios against the configured mission profile terrain requirements.
        """
        # 1. Resolve Profile Snapshot
        profile = self.profile_svc.get_profile(req.profile_id)
        if not profile:
            raise KeyError(f"Mission profile '{req.profile_id}' not found.")
        profile_snapshot = profile.model_copy(deep=True)

        # 2. Resolve Candidate Scenario Snapshots
        scenario_snapshots: List[ScenarioRecord] = []
        for sid in req.scenario_ids:
            scen = self.scenario_svc.get_scenario(sid)
            if not scen:
                raise KeyError(f"Candidate scenario '{sid}' not found.")
            scenario_snapshots.append(scen.model_copy(deep=True))

        # 3. Retrieve DEM Dataset Metadata
        dataset_id = req.override_dataset_id or scenario_snapshots[0].site_id
        dem_rec = self.catalogue_svc.get_by_id(dataset_id) or self.catalogue_svc.get_by_id("site01")
        dem_meta = self.dem_loader_svc.get_metadata()

        dataset_meta_dict = {
            "dataset_id": dataset_id,
            "name": dem_meta.name,
            "region_name": dem_meta.region_name,
            "pixel_spacing_m": dem_meta.pixel_spacing_m,
            "reference_frame": dem_meta.reference_frame,
            "projection_crs": dem_meta.projection_crs,
            "publication_ref": dem_meta.publication_ref,
            "effective_resolution_note": dem_meta.effective_resolution_note,
            "quality_summary": dem_meta.quality_summary,
        }

        # 4. Evaluate each candidate scenario
        evaluated_candidates: List[CandidateTerrainAssessment] = []
        for scen in scenario_snapshots:
            cand_assessment = self._assess_single_candidate(
                scen=scen,
                profile=profile_snapshot,
                radius_m=req.assessment_radius_m,
                dem_meta=dem_meta,
            )
            evaluated_candidates.append(cand_assessment)

        # 5. Aggregate summary counts
        compliant_count = sum(1 for c in evaluated_candidates if c.overall_status == TerrainSuitabilityStatus.COMPLIANT)
        non_compliant_count = sum(1 for c in evaluated_candidates if c.overall_status == TerrainSuitabilityStatus.NON_COMPLIANT)
        indeterminate_count = sum(1 for c in evaluated_candidates if c.overall_status == TerrainSuitabilityStatus.INDETERMINATE)

        now_iso = datetime.now(timezone.utc).isoformat()
        assessment_id = f"terrain-eval-{uuid.uuid4().hex[:8]}"
        title = req.name.strip() if req.name and req.name.strip() else f"Terrain Assessment: {profile_snapshot.name} ({len(evaluated_candidates)} Candidates)"

        assessment_record = TerrainAssessmentRecord(
            id=assessment_id,
            name=title,
            created_at_iso=now_iso,
            profile_id=profile_snapshot.id,
            profile_name=profile_snapshot.name,
            profile_version=profile_snapshot.version,
            profile_snapshot=profile_snapshot,
            scenario_snapshots=scenario_snapshots,
            assessment_radius_m=req.assessment_radius_m,
            dataset_metadata=dataset_meta_dict,
            calculation_method="LUNAVISTA Terrain Suitability Engine v1.0 (NASA LOLA 5m/px)",
            total_candidates_evaluated=len(evaluated_candidates),
            compliant_candidates_count=compliant_count,
            non_compliant_candidates_count=non_compliant_count,
            indeterminate_candidates_count=indeterminate_count,
            candidates=evaluated_candidates,
            scientific_disclaimers=MANDATORY_SCIENTIFIC_DISCLAIMERS,
            warnings=[],
        )

        with self._lock:
            self._assessments[assessment_id] = assessment_record
            self._save_to_storage_unlocked()

        return assessment_record

    def _assess_single_candidate(
        self,
        scen: ScenarioRecord,
        profile: MissionProfile,
        radius_m: float,
        dem_meta: Any,
    ) -> CandidateTerrainAssessment:
        """
        Samples elevation, slope, and spatial coverage across the candidate's footprint
        and evaluates active mission profile terrain requirements.
        """
        lat = scen.latitude
        lon = scen.longitude
        warnings: List[str] = []

        # Coordinate transformation
        proj_x, proj_y = transformer.lat_lon_to_xy(lat, lon)

        # 1. Resolve site-specific DEM loader for this candidate
        target_site = scen.site_id or self.dem_loader_svc.dataset_id
        from app.services.dem_loader import get_dem_loader
        candidate_loader = get_dem_loader(target_site)

        # Point sample
        point_sample = candidate_loader.sample_point(lat, lon)
        in_bounds = point_sample.get("in_bounds", False)
        point_elev = point_sample.get("elevation_m")
        point_slope = point_sample.get("slope_deg")

        if not in_bounds:
            warnings.append(f"Candidate coordinate ({lat:.4f}°, {lon:.4f}°) is outside {candidate_loader.cfg['name']} DEM raster extent.")

        # 2. Footprint sampling
        slope_req = getattr(profile.requirements.terrain, "max_local_slope_deg", None) or getattr(profile.requirements.terrain, "max_slope_deg", None)
        configured_max_slope = slope_req.value if (slope_req and slope_req.enabled) else 15.0

        elev_metrics, slope_metrics, data_quality = self._sample_footprint(
            lat=lat,
            lon=lon,
            proj_x=proj_x,
            proj_y=proj_y,
            radius_m=radius_m,
            point_elev=point_elev,
            point_slope=point_slope,
            in_bounds=in_bounds,
            configured_max_slope=configured_max_slope,
            loader=candidate_loader,
        )

        # 3. Roughness metrics
        rough_req = profile.requirements.terrain.max_roughness_factor
        rough_metrics = RoughnessAssessmentMetrics(
            status="UNSUPPORTED",
            is_supported=False,
            scientific_justification=(
                "Official LOLA terrain roughness product is not loaded in repository data directory. "
                "In accordance with lunar landing site evaluation guidelines, slope or elevation variance "
                "cannot be substituted for micro-relief roughness or boulder hazard detection."
            ),
            measured_value=None,
            unit=rough_req.unit if rough_req else "deg_std",
            derived_slope_std_deg=slope_metrics.std_slope_deg,
        )

        # 4. Evaluate terrain requirements
        hard_results: List[EvaluatedTerrainRequirement] = []
        soft_results: List[EvaluatedTerrainRequirement] = []
        info_results: List[EvaluatedTerrainRequirement] = []

        trn_cfg = profile.requirements.terrain

        # A. Maximum Slope
        if slope_req and slope_req.enabled:
            item = self._eval_slope_requirement(
                req=slope_req,
                point_slope=slope_metrics.point_slope_deg,
                max_footprint_slope=slope_metrics.max_slope_deg,
                exceedance_pct=slope_metrics.exceedance_percentage,
                dq=data_quality,
            )
            self._classify_req_result(item, hard_results, soft_results, info_results)

        # B. Minimum Surface Elevation
        if trn_cfg.min_elevation_m.enabled:
            item = self._eval_elevation_min_requirement(
                req=trn_cfg.min_elevation_m,
                point_elev=elev_metrics.point_elevation_m,
                min_footprint_elev=elev_metrics.min_elevation_m,
                dq=data_quality,
            )
            self._classify_req_result(item, hard_results, soft_results, info_results)

        # C. Maximum Surface Elevation
        if trn_cfg.max_elevation_m.enabled:
            item = self._eval_elevation_max_requirement(
                req=trn_cfg.max_elevation_m,
                point_elev=elev_metrics.point_elevation_m,
                max_footprint_elev=elev_metrics.max_elevation_m,
                dq=data_quality,
            )
            self._classify_req_result(item, hard_results, soft_results, info_results)

        # D. Maximum Roughness Factor
        if trn_cfg.max_roughness_factor.enabled:
            item = EvaluatedTerrainRequirement(
                requirement_id=trn_cfg.max_roughness_factor.id,
                requirement_name=trn_cfg.max_roughness_factor.name,
                classification=trn_cfg.max_roughness_factor.classification,
                operator=trn_cfg.max_roughness_factor.operator,
                threshold_value=trn_cfg.max_roughness_factor.value,
                threshold_str=f"{trn_cfg.max_roughness_factor.operator} {trn_cfg.max_roughness_factor.value} {trn_cfg.max_roughness_factor.unit}",
                actual_value=None,
                actual_value_str="UNAVAILABLE (No Roughness Product)",
                unit=trn_cfg.max_roughness_factor.unit,
                verdict=ScreeningVerdict.INDETERMINATE,
                explanation="Terrain roughness product is not loaded; metric cannot be verified without substituting slope.",
                supporting_data_source="NASA LOLA Terrain Suite",
            )
            self._classify_req_result(item, hard_results, soft_results, info_results)

        # 5. Determine Overall Candidate Compliance Status
        passed_hc = sum(1 for r in hard_results if r.verdict == ScreeningVerdict.PASS)
        failed_hc = sum(1 for r in hard_results if r.verdict == ScreeningVerdict.FAIL)
        indet_hc = sum(1 for r in hard_results if r.verdict == ScreeningVerdict.INDETERMINATE)
        total_hc = len(hard_results)

        # Strict Precedence Rule:
        # Any hard constraint failure strictly overrides indeterminate metrics to produce NON_COMPLIANT.
        if failed_hc > 0:
            overall_status = TerrainSuitabilityStatus.NON_COMPLIANT
        elif indet_hc > 0:
            overall_status = TerrainSuitabilityStatus.INDETERMINATE
        else:
            overall_status = TerrainSuitabilityStatus.COMPLIANT

        cand_disclaimers = [
            f"Meets configured terrain requirements within evaluated data coverage." if overall_status == TerrainSuitabilityStatus.COMPLIANT else f"Candidate does not satisfy configured terrain requirements (or data coverage is indeterminate).",
            "This assessment does not declare the site safe to land on.",
        ]

        return CandidateTerrainAssessment(
            candidate_id=scen.id,
            candidate_name=scen.name,
            site_id=scen.site_id,
            latitude=lat,
            longitude=lon,
            projected_x=round(proj_x, 2) if proj_x is not None else None,
            projected_y=round(proj_y, 2) if proj_y is not None else None,
            overall_status=overall_status,
            hard_constraints_passed=passed_hc,
            hard_constraints_failed=failed_hc,
            hard_constraints_indeterminate=indet_hc,
            total_hard_constraints=total_hc,
            elevation_metrics=elev_metrics,
            slope_metrics=slope_metrics,
            roughness_metrics=rough_metrics,
            data_quality=data_quality,
            hard_constraint_results=hard_results,
            soft_preference_results=soft_results,
            informational_metrics=info_results,
            scientific_disclaimers=cand_disclaimers,
            warnings=warnings,
        )

    def _sample_footprint(
        self,
        lat: float,
        lon: float,
        proj_x: float,
        proj_y: float,
        radius_m: float,
        point_elev: Optional[float],
        point_slope: Optional[float],
        in_bounds: bool,
        configured_max_slope: float,
        loader: Optional[DemLoaderService] = None,
    ) -> Tuple[ElevationAssessmentMetrics, SlopeAssessmentMetrics, FootprintDataQuality]:
        """
        Samples rasters within a circular footprint around (proj_x, proj_y).
        Returns elevation metrics, slope metrics, and data quality information.
        """
        spacing_m = 5.0
        warnings: List[str] = []

        if not in_bounds:
            # Out of bounds completely
            dq = FootprintDataQuality(
                coverage_status=DataCoverageStatus.UNAVAILABLE,
                coverage_certainty="UNAVAILABLE",
                assessment_mode="POINT" if radius_m <= 0.0 else "CIRCULAR_FOOTPRINT",
                requested_radius_m=radius_m,
                nominal_grid_spacing_m=spacing_m,
                total_pixels_in_footprint=0,
                valid_pixels_in_footprint=0,
                nodata_pixels_in_footprint=0,
                valid_data_percentage=0.0,
                evaluated_area_m2=0.0,
                coverage_warnings=["Coordinate is outside available DEM bounds."],
            )
            elev_m = ElevationAssessmentMetrics(point_elevation_m=None)
            slope_m = SlopeAssessmentMetrics(point_slope_deg=None)
            return elev_m, slope_m, dq

        # Point assessment case (radius == 0.0)
        if radius_m <= 0.0:
            valid_elev = point_elev is not None
            valid_slope = point_slope is not None
            is_valid = valid_elev and valid_slope
            cov_status = DataCoverageStatus.COMPLETE if is_valid else (DataCoverageStatus.UNAVAILABLE if (point_elev is None and point_slope is None) else DataCoverageStatus.PARTIAL)
            cov_cert = "COMPLETE_100PCT" if is_valid else ("UNAVAILABLE" if (point_elev is None and point_slope is None) else "PARTIAL_COVERAGE")

            slope_dist: Dict[str, float] = {}
            exceedance = 0.0
            if valid_slope:
                # 1 pixel distribution
                slope_arr = np.array([point_slope], dtype=np.float32)
                slope_dist = slope_service.compute_slope_distribution(slope_arr)
                exceedance = 100.0 if point_slope > configured_max_slope else 0.0

            dq = FootprintDataQuality(
                coverage_status=cov_status,
                coverage_certainty=cov_cert,
                assessment_mode="POINT",
                requested_radius_m=0.0,
                nominal_grid_spacing_m=spacing_m,
                total_pixels_in_footprint=1,
                valid_pixels_in_footprint=1 if is_valid else 0,
                nodata_pixels_in_footprint=0 if is_valid else 1,
                valid_data_percentage=100.0 if is_valid else 0.0,
                evaluated_area_m2=spacing_m * spacing_m,
                coverage_warnings=[] if is_valid else ["Point sample contains NoData."],
            )
            elev_m = ElevationAssessmentMetrics(
                point_elevation_m=point_elev,
                min_elevation_m=point_elev,
                max_elevation_m=point_elev,
                elevation_range_m=0.0 if point_elev is not None else None,
                mean_elevation_m=point_elev,
                std_elevation_m=0.0 if point_elev is not None else None,
            )
            slope_m = SlopeAssessmentMetrics(
                point_slope_deg=point_slope,
                min_slope_deg=point_slope,
                max_slope_deg=point_slope,
                mean_slope_deg=point_slope,
                median_slope_deg=point_slope,
                std_slope_deg=0.0 if point_slope is not None else None,
                slope_distribution=slope_dist,
                exceedance_percentage=exceedance if valid_slope else None,
            )
            return elev_m, slope_m, dq

        # Circular footprint (radius > 0)
        active_loader = loader or self.dem_loader_svc
        active_loader._ensure_open()
        surf_src = active_loader._surf_src
        slp_src = active_loader._slp_src

        if surf_src is None:
            dq = FootprintDataQuality(
                coverage_status=DataCoverageStatus.UNAVAILABLE,
                coverage_certainty="UNAVAILABLE",
                assessment_mode="CIRCULAR_FOOTPRINT",
                requested_radius_m=radius_m,
                nominal_grid_spacing_m=spacing_m,
                total_pixels_in_footprint=0,
                valid_pixels_in_footprint=0,
                nodata_pixels_in_footprint=0,
                valid_data_percentage=0.0,
                evaluated_area_m2=0.0,
                coverage_warnings=["DEM surface file is not loaded."],
            )
            return ElevationAssessmentMetrics(), SlopeAssessmentMetrics(), dq

        # Raster compatibility verification
        if slp_src is not None:
            if surf_src.crs != slp_src.crs:
                warnings.append(f"CRS mismatch: Surface DEM ({surf_src.crs}) vs Slope product ({slp_src.crs}).")
            if surf_src.transform != slp_src.transform:
                warnings.append("Transform/resolution mismatch between Surface DEM and Slope product.")
            if surf_src.width != slp_src.width or surf_src.height != slp_src.height:
                warnings.append(f"Dimension mismatch: Surface DEM ({surf_src.width}x{surf_src.height}) vs Slope product ({slp_src.width}x{slp_src.height}).")
        else:
            warnings.append("LOLA slope product is not loaded.")

        # Footprint bounding box in projected meters
        left = proj_x - radius_m
        right = proj_x + radius_m
        bottom = proj_y - radius_m
        top = proj_y + radius_m

        transform = surf_src.transform
        c_min, r_max = transformer.xy_to_pixel(left, bottom, transform)
        c_max, r_min = transformer.xy_to_pixel(right, top, transform)

        col_start = int(math.floor(min(c_min, c_max)))
        col_end = int(math.ceil(max(c_min, c_max)))
        row_start = int(math.floor(min(r_min, r_max)))
        row_end = int(math.ceil(max(r_min, r_max)))

        # Check intersection with raster bounds
        src_w, src_h = surf_src.width, surf_src.height
        clip_col_start = max(0, col_start)
        clip_col_end = min(src_w, col_end)
        clip_row_start = max(0, row_start)
        clip_row_end = min(src_h, row_end)

        # Total expected pixels in a full theoretical circle of radius R with 5m pixels
        # A circle of radius R has area pi*R^2; with pixel area (spacing_m^2):
        expected_full_pixels = int(math.ceil(math.pi * (radius_m / spacing_m) ** 2))

        if clip_col_start >= clip_col_end or clip_row_start >= clip_row_end:
            # Completely out of raster
            dq = FootprintDataQuality(
                coverage_status=DataCoverageStatus.UNAVAILABLE,
                coverage_certainty="UNAVAILABLE",
                assessment_mode="CIRCULAR_FOOTPRINT",
                requested_radius_m=radius_m,
                nominal_grid_spacing_m=spacing_m,
                total_pixels_in_footprint=expected_full_pixels,
                valid_pixels_in_footprint=0,
                nodata_pixels_in_footprint=expected_full_pixels,
                valid_data_percentage=0.0,
                evaluated_area_m2=0.0,
                coverage_warnings=["Footprint is entirely outside DEM extent."],
            )
            return ElevationAssessmentMetrics(), SlopeAssessmentMetrics(), dq

        # Read window slice
        window = Window(
            clip_col_start,
            clip_row_start,
            clip_col_end - clip_col_start,
            clip_row_end - clip_row_start,
        )

        surf_data = surf_src.read(1, window=window)
        slp_data = None
        if slp_src is not None and surf_src.width == slp_src.width and surf_src.height == slp_src.height:
            try:
                slp_data = slp_src.read(1, window=window)
            except Exception as e:
                warnings.append(f"Failed to read slope window: {str(e)}")

        # Build projected coordinates for each pixel center in this window
        cols = np.arange(clip_col_start, clip_col_end)
        rows = np.arange(clip_row_start, clip_row_end)
        grid_cols, grid_rows = np.meshgrid(cols, rows)

        # Affine transform with pixel center offset (0.5 * pixel_size)
        px_xs = transform.a * grid_cols + transform.b * grid_rows + transform.c + transform.a * 0.5
        px_ys = transform.d * grid_cols + transform.e * grid_rows + transform.f + transform.e * 0.5

        # Circular mask in metric CRS: distance <= radius_m
        dist_sq = (px_xs - proj_x) ** 2 + (px_ys - proj_y) ** 2
        circle_mask = dist_sq <= (radius_m ** 2)

        intersected_circle_pixels = int(np.sum(circle_mask))
        total_footprint_pixels = max(intersected_circle_pixels, expected_full_pixels)

        if not np.any(circle_mask):
            circle_mask[0, 0] = True
            total_footprint_pixels = max(1, expected_full_pixels)

        elev_footprint = surf_data[circle_mask]
        slp_footprint = slp_data[circle_mask] if slp_data is not None else None

        # Identify valid pixels in surface DEM
        nodata_elev = surf_src.nodata if surf_src.nodata is not None else -32767.0
        valid_elev_mask = (elev_footprint != nodata_elev) & (~np.isnan(elev_footprint))

        valid_elevs = elev_footprint[valid_elev_mask]
        valid_pixel_count = int(np.sum(valid_elev_mask))
        nodata_pixel_count = total_footprint_pixels - valid_pixel_count

        valid_pct = round((valid_pixel_count / max(1, total_footprint_pixels)) * 100.0, 1)

        # Non-overlapping coverage classification:
        # UNAVAILABLE: valid_pct == 0.0%
        # PARTIAL: 0.0% < valid_pct < 95.0%
        # COMPLETE: 95.0% <= valid_pct <= 100.0% (exactly 95.0% belongs unambiguously to COMPLETE)
        if valid_pixel_count == 0:
            cov_status = DataCoverageStatus.UNAVAILABLE
            cov_certainty = "UNAVAILABLE"
            warnings.append(f"Footprint of radius {radius_m:.0f} m contains zero valid elevation pixels.")
        elif valid_pct < 95.0:
            cov_status = DataCoverageStatus.PARTIAL
            cov_certainty = "PARTIAL_COVERAGE"
            warnings.append(
                f"Partial footprint coverage: {valid_pct:.1f}% valid data ({nodata_pixel_count} nodata/uncovered pixels)."
            )
        else:
            cov_status = DataCoverageStatus.COMPLETE
            if nodata_pixel_count == 0:
                cov_certainty = "COMPLETE_100PCT"
            else:
                cov_certainty = "COMPLETE_GE95_UNMEASURED_RESIDUAL"
                warnings.append(
                    f"Footprint has {valid_pct:.1f}% valid coverage with {nodata_pixel_count} unmeasured residual pixel(s)."
                )

        # Elevation stats
        if valid_elevs.size > 0:
            min_e = round(float(np.min(valid_elevs)), 2)
            max_e = round(float(np.max(valid_elevs)), 2)
            mean_e = round(float(np.mean(valid_elevs)), 2)
            std_e = round(float(np.std(valid_elevs)), 2)
            range_e = round(max_e - min_e, 2)
        else:
            min_e, max_e, mean_e, std_e, range_e = None, None, None, None, None

        # Slope stats
        min_s, max_s, mean_s, med_s, std_s = None, None, None, None, None
        slope_dist: Dict[str, float] = {}
        exceedance_pct: Optional[float] = None

        if slp_footprint is not None:
            nodata_slp = slp_src.nodata if slp_src.nodata is not None else -32767.0
            valid_slp_mask = (slp_footprint != nodata_slp) & (~np.isnan(slp_footprint))
            valid_slopes = slp_footprint[valid_slp_mask]

            if valid_slopes.size > 0:
                min_s = round(float(np.min(valid_slopes)), 2)
                max_s = round(float(np.max(valid_slopes)), 2)
                mean_s = round(float(np.mean(valid_slopes)), 2)
                med_s = round(float(np.median(valid_slopes)), 2)
                std_s = round(float(np.std(valid_slopes)), 2)

                slope_dist = slope_service.compute_slope_distribution(valid_slopes)
                exceeding_count = np.sum(valid_slopes > configured_max_slope)
                exceedance_pct = round((float(exceeding_count) / float(len(valid_slopes))) * 100.0, 2)

        dq = FootprintDataQuality(
            coverage_status=cov_status,
            coverage_certainty=cov_certainty,
            assessment_mode="CIRCULAR_FOOTPRINT",
            requested_radius_m=radius_m,
            nominal_grid_spacing_m=spacing_m,
            total_pixels_in_footprint=total_footprint_pixels,
            valid_pixels_in_footprint=valid_pixel_count,
            nodata_pixels_in_footprint=nodata_pixel_count,
            valid_data_percentage=valid_pct,
            evaluated_area_m2=round(valid_pixel_count * (spacing_m ** 2), 1),
            coverage_warnings=warnings,
        )

        elev_m = ElevationAssessmentMetrics(
            point_elevation_m=point_elev,
            min_elevation_m=min_e,
            max_elevation_m=max_e,
            elevation_range_m=range_e,
            mean_elevation_m=mean_e,
            std_elevation_m=std_e,
        )

        slope_m = SlopeAssessmentMetrics(
            point_slope_deg=point_slope,
            min_slope_deg=min_s,
            max_slope_deg=max_s,
            mean_slope_deg=mean_s,
            median_slope_deg=med_s,
            std_slope_deg=std_s,
            slope_distribution=slope_dist,
            exceedance_percentage=exceedance_pct,
            slope_source=f"NASA LOLA 5 m/pixel co-registered slope product ({active_loader.slp_path.name})",
        )

        return elev_m, slope_m, dq

    def _eval_slope_requirement(
        self,
        req: SingleRequirement,
        point_slope: Optional[float],
        max_footprint_slope: Optional[float],
        exceedance_pct: Optional[float],
        dq: FootprintDataQuality,
    ) -> EvaluatedTerrainRequirement:
        """
        Evaluates maximum slope requirement against candidate point slope and footprint max slope.
        Scientifically certifies compliance:
        - If point or footprint slope violates limit -> FAIL (definitive failure preserved even if partial).
        - If missing data/unavailable -> INDETERMINATE.
        - If measured slopes comply, but unmeasured residual pixels exist -> INDETERMINATE (unmeasured terrain could violate limit).
        - If measured slopes comply AND footprint is 100% complete (nodata == 0) -> PASS.
        """
        thresh = req.value
        op = req.operator

        if (point_slope is None and max_footprint_slope is None) or dq.coverage_status == DataCoverageStatus.UNAVAILABLE:
            return EvaluatedTerrainRequirement(
                requirement_id=req.id,
                requirement_name=req.name,
                classification=req.classification,
                operator=op,
                threshold_value=thresh,
                threshold_str=f"{op} {thresh} {req.unit}",
                actual_value=None,
                actual_value_str="UNAVAILABLE (NoData / Out of Bounds)",
                unit=req.unit,
                verdict=ScreeningVerdict.INDETERMINATE,
                explanation="Slope data is missing or candidate coordinate is outside DEM coverage.",
                supporting_data_source="NASA LOLA 5 m Slope Product",
            )

        # Distinguish Point mode vs Circular Footprint mode
        if dq.assessment_mode == "POINT":
            actual_str = f"Point: {point_slope:.1f}°" if point_slope is not None else "Point: N/A"
        else:
            pt_s = f"Point: {point_slope:.1f}°" if point_slope is not None else "Point: N/A"
            max_s = f"Footprint Max: {max_footprint_slope:.1f}°" if max_footprint_slope is not None else "Footprint Max: N/A"
            exc_s = f"Exceedance: {exceedance_pct:.1f}%" if exceedance_pct is not None else "Exceedance: N/A"
            actual_str = f"{pt_s} | {max_s} | {exc_s}"

        # Evaluate compliance
        point_fails = (point_slope is not None) and not self._compare(point_slope, op, thresh)
        footprint_fails = (max_footprint_slope is not None) and not self._compare(max_footprint_slope, op, thresh)

        if point_fails or footprint_fails:
            # Clear Failure: Preserved even if coverage is partial or residual
            verdict = ScreeningVerdict.FAIL
            explanation = f"Slope limit exceeded ({actual_str} vs threshold {op} {thresh} {req.unit})."
        else:
            # Measured pixels satisfy requirement
            if dq.assessment_mode == "POINT":
                verdict = ScreeningVerdict.PASS
                explanation = f"Candidate point slope satisfies requirement ({actual_str} vs threshold {op} {thresh} {req.unit})."
            elif dq.nodata_pixels_in_footprint == 0:
                # 100% complete footprint data
                verdict = ScreeningVerdict.PASS
                explanation = f"Measured slope satisfies requirement across complete 100% evaluated footprint ({actual_str} vs threshold {op} {thresh} {req.unit})."
            else:
                # Incomplete footprint: unmeasured terrain could contain hazardous slope
                verdict = ScreeningVerdict.INDETERMINATE
                explanation = f"Measured slopes comply ({actual_str}), but {dq.nodata_pixels_in_footprint} unmeasured pixel(s) ({dq.valid_data_percentage:.1f}% coverage) prevent conclusive certification against maximum slope limit."

        return EvaluatedTerrainRequirement(
            requirement_id=req.id,
            requirement_name=req.name,
            classification=req.classification,
            operator=op,
            threshold_value=thresh,
            threshold_str=f"{op} {thresh} {req.unit}",
            actual_value=point_slope,
            actual_value_str=actual_str,
            unit=req.unit,
            verdict=verdict,
            explanation=explanation,
            supporting_data_source="NASA LOLA 5 m Slope Product",
        )

    def _eval_elevation_min_requirement(
        self,
        req: SingleRequirement,
        point_elev: Optional[float],
        min_footprint_elev: Optional[float],
        dq: FootprintDataQuality,
    ) -> EvaluatedTerrainRequirement:
        thresh = req.value
        op = req.operator

        if (point_elev is None and min_footprint_elev is None) or dq.coverage_status == DataCoverageStatus.UNAVAILABLE:
            return EvaluatedTerrainRequirement(
                requirement_id=req.id,
                requirement_name=req.name,
                classification=req.classification,
                operator=op,
                threshold_value=thresh,
                threshold_str=f"{op} {thresh} {req.unit}",
                actual_value=None,
                actual_value_str="UNAVAILABLE (NoData / Out of Bounds)",
                unit=req.unit,
                verdict=ScreeningVerdict.INDETERMINATE,
                explanation="Elevation data is unavailable.",
                supporting_data_source="NASA LOLA 5 m Surface DEM",
            )

        if dq.assessment_mode == "POINT":
            actual_str = f"Point: {point_elev:+.1f} m" if point_elev is not None else "Point: N/A"
        else:
            pt_e = f"Point: {point_elev:+.1f} m" if point_elev is not None else "Point: N/A"
            min_e = f"Footprint Min: {min_footprint_elev:+.1f} m" if min_footprint_elev is not None else "Footprint Min: N/A"
            actual_str = f"{pt_e} | {min_e}"

        point_fails = (point_elev is not None) and not self._compare(point_elev, op, thresh)
        footprint_fails = (min_footprint_elev is not None) and not self._compare(min_footprint_elev, op, thresh)

        if point_fails or footprint_fails:
            verdict = ScreeningVerdict.FAIL
            explanation = f"Elevation falls below configured lower limit ({actual_str} vs threshold {op} {thresh} {req.unit})."
        else:
            if dq.assessment_mode == "POINT":
                verdict = ScreeningVerdict.PASS
                explanation = f"Candidate point elevation satisfies minimum limit ({actual_str} vs threshold {op} {thresh} {req.unit})."
            elif dq.nodata_pixels_in_footprint == 0:
                verdict = ScreeningVerdict.PASS
                explanation = f"Surface elevation satisfies minimum limit across complete 100% evaluated footprint ({actual_str} vs threshold {op} {thresh} {req.unit})."
            else:
                verdict = ScreeningVerdict.INDETERMINATE
                explanation = f"Measured elevations comply ({actual_str}), but {dq.nodata_pixels_in_footprint} unmeasured pixel(s) ({dq.valid_data_percentage:.1f}% coverage) prevent conclusive certification against minimum elevation limit."

        return EvaluatedTerrainRequirement(
            requirement_id=req.id,
            requirement_name=req.name,
            classification=req.classification,
            operator=op,
            threshold_value=thresh,
            threshold_str=f"{op} {thresh} {req.unit}",
            actual_value=point_elev,
            actual_value_str=actual_str,
            unit=req.unit,
            verdict=verdict,
            explanation=explanation,
            supporting_data_source="NASA LOLA 5 m Surface DEM",
        )

    def _eval_elevation_max_requirement(
        self,
        req: SingleRequirement,
        point_elev: Optional[float],
        max_footprint_elev: Optional[float],
        dq: FootprintDataQuality,
    ) -> EvaluatedTerrainRequirement:
        thresh = req.value
        op = req.operator

        if (point_elev is None and max_footprint_elev is None) or dq.coverage_status == DataCoverageStatus.UNAVAILABLE:
            return EvaluatedTerrainRequirement(
                requirement_id=req.id,
                requirement_name=req.name,
                classification=req.classification,
                operator=op,
                threshold_value=thresh,
                threshold_str=f"{op} {thresh} {req.unit}",
                actual_value=None,
                actual_value_str="UNAVAILABLE (NoData / Out of Bounds)",
                unit=req.unit,
                verdict=ScreeningVerdict.INDETERMINATE,
                explanation="Elevation data is unavailable.",
                supporting_data_source="NASA LOLA 5 m Surface DEM",
            )

        if dq.assessment_mode == "POINT":
            actual_str = f"Point: {point_elev:+.1f} m" if point_elev is not None else "Point: N/A"
        else:
            pt_e = f"Point: {point_elev:+.1f} m" if point_elev is not None else "Point: N/A"
            max_e = f"Footprint Max: {max_footprint_elev:+.1f} m" if max_footprint_elev is not None else "Footprint Max: N/A"
            actual_str = f"{pt_e} | {max_e}"

        point_fails = (point_elev is not None) and not self._compare(point_elev, op, thresh)
        footprint_fails = (max_footprint_elev is not None) and not self._compare(max_footprint_elev, op, thresh)

        if point_fails or footprint_fails:
            verdict = ScreeningVerdict.FAIL
            explanation = f"Elevation exceeds configured upper limit ({actual_str} vs threshold {op} {thresh} {req.unit})."
        else:
            if dq.assessment_mode == "POINT":
                verdict = ScreeningVerdict.PASS
                explanation = f"Candidate point elevation satisfies upper limit ({actual_str} vs threshold {op} {thresh} {req.unit})."
            elif dq.nodata_pixels_in_footprint == 0:
                verdict = ScreeningVerdict.PASS
                explanation = f"Surface elevation satisfies upper limit across complete 100% evaluated footprint ({actual_str} vs threshold {op} {thresh} {req.unit})."
            else:
                verdict = ScreeningVerdict.INDETERMINATE
                explanation = f"Measured elevations comply ({actual_str}), but {dq.nodata_pixels_in_footprint} unmeasured pixel(s) ({dq.valid_data_percentage:.1f}% coverage) prevent conclusive certification against maximum elevation limit."

        return EvaluatedTerrainRequirement(
            requirement_id=req.id,
            requirement_name=req.name,
            classification=req.classification,
            operator=op,
            threshold_value=thresh,
            threshold_str=f"{op} {thresh} {req.unit}",
            actual_value=point_elev,
            actual_value_str=actual_str,
            unit=req.unit,
            verdict=verdict,
            explanation=explanation,
            supporting_data_source="NASA LOLA 5 m Surface DEM",
        )

    def _compare(self, actual: float, op: str, threshold: Optional[float]) -> bool:
        if threshold is None:
            return True
        if op in ("ge", ">="):
            return actual >= threshold - 1e-4
        elif op in ("gt", ">"):
            return actual > threshold + 1e-4
        elif op in ("le", "<="):
            return actual <= threshold + 1e-4
        elif op in ("lt", "<"):
            return actual < threshold - 1e-4
        elif op in ("eq", "=="):
            return abs(actual - threshold) <= 1e-4
        return False

    def _classify_req_result(
        self,
        item: EvaluatedTerrainRequirement,
        hard_results: List[EvaluatedTerrainRequirement],
        soft_results: List[EvaluatedTerrainRequirement],
        info_results: List[EvaluatedTerrainRequirement],
    ):
        if item.classification == RequirementClassification.HARD_CONSTRAINT:
            hard_results.append(item)
        elif item.classification == RequirementClassification.SOFT_PREFERENCE:
            soft_results.append(item)
        else:
            info_results.append(item)

    def export_assessment_json(self, assessment_id: str) -> Dict[str, Any]:
        rec = self.get_assessment(assessment_id)
        if not rec:
            raise KeyError(f"Terrain assessment '{assessment_id}' not found.")
        return rec.model_dump(mode="json")

    def export_assessment_csv(self, assessment_id: str) -> str:
        rec = self.get_assessment(assessment_id)
        if not rec:
            raise KeyError(f"Terrain assessment '{assessment_id}' not found.")

        out = io.StringIO()
        writer = csv.writer(out)

        writer.writerow(["# LUNAVISTA TERRAIN SUITABILITY ASSESSMENT REPORT (MVP 7.4)"])
        writer.writerow(["Assessment ID", rec.id])
        writer.writerow(["Title", rec.name])
        writer.writerow(["Execution Timestamp (UTC)", rec.created_at_iso])
        writer.writerow(["Evaluated Profile", f"{rec.profile_name} (v{rec.profile_version})"])
        writer.writerow(["Assessment Radius (m)", rec.assessment_radius_m])
        writer.writerow(["Calculation Method", rec.calculation_method])
        writer.writerow(["Compliant Candidates", rec.compliant_candidates_count])
        writer.writerow(["Non-Compliant Candidates", rec.non_compliant_candidates_count])
        writer.writerow(["Indeterminate Candidates", rec.indeterminate_candidates_count])
        writer.writerow([])

        # Table 1: Candidate Overview
        writer.writerow([
            "Candidate ID",
            "Candidate Name",
            "Latitude (°)",
            "Longitude (°)",
            "Overall Status",
            "Point Elev (m)",
            "Min Elev (m)",
            "Max Elev (m)",
            "Point Slope (°)",
            "Max Slope (°)",
            "Slope Exceedance (%)",
            "Coverage Status",
            "Valid Coverage (%)",
            "Hard Passed",
            "Hard Failed",
            "Hard Indet",
        ])

        for c in rec.candidates:
            writer.writerow([
                c.candidate_id,
                c.candidate_name,
                f"{c.latitude:.4f}",
                f"{c.longitude:.4f}",
                c.overall_status.value,
                f"{c.elevation_metrics.point_elevation_m:.1f}" if c.elevation_metrics.point_elevation_m is not None else "N/A",
                f"{c.elevation_metrics.min_elevation_m:.1f}" if c.elevation_metrics.min_elevation_m is not None else "N/A",
                f"{c.elevation_metrics.max_elevation_m:.1f}" if c.elevation_metrics.max_elevation_m is not None else "N/A",
                f"{c.slope_metrics.point_slope_deg:.1f}" if c.slope_metrics.point_slope_deg is not None else "N/A",
                f"{c.slope_metrics.max_slope_deg:.1f}" if c.slope_metrics.max_slope_deg is not None else "N/A",
                f"{c.slope_metrics.exceedance_percentage:.1f}%" if c.slope_metrics.exceedance_percentage is not None else "N/A",
                c.data_quality.coverage_status.value,
                f"{c.data_quality.valid_data_percentage:.1f}%",
                c.hard_constraints_passed,
                c.hard_constraints_failed,
                c.hard_constraints_indeterminate,
            ])

        writer.writerow([])
        writer.writerow(["# DETAILED REQUIREMENTS EVALUATION MATRIX"])
        writer.writerow([
            "Candidate ID",
            "Requirement ID",
            "Requirement Name",
            "Classification",
            "Condition",
            "Actual Value",
            "Verdict",
            "Explanation",
        ])

        for c in rec.candidates:
            all_reqs = c.hard_constraint_results + c.soft_preference_results + c.informational_metrics
            for r in all_reqs:
                writer.writerow([
                    c.candidate_id,
                    r.requirement_id,
                    r.requirement_name,
                    r.classification.value,
                    r.threshold_str,
                    r.actual_value_str,
                    r.verdict.value,
                    r.explanation,
                ])

        writer.writerow([])
        writer.writerow(["# SCIENTIFIC ACCURACY DISCLAIMERS"])
        for d in MANDATORY_SCIENTIFIC_DISCLAIMERS:
            writer.writerow(["Disclaimer", d])

        return out.getvalue()

terrain_assessment_service = TerrainAssessmentService()
