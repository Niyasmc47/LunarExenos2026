import os
import shutil
import tempfile
import threading
import uuid
import io
import csv
import json
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

from app.schemas.scenario import (
    ScenarioRecord,
    ScenarioCreateRequest,
    ScenarioUpdateRequest,
    MissionConstraints,
    ConstraintResult,
    ScenarioTerrainMetrics,
    ScenarioComparisonResult,
    MultiScenarioComparisonRequest,
    MultiScenarioComparisonResponse,
    ScenarioRankingItem,
)
from app.schemas.visibility import VisibilityAnalysisRequest
from app.services.visibility_service import visibility_service
from app.services.dataset_catalogue import catalogue_service
from app.services.dem_loader import dem_loader
from app.services.kernel_manager import kernel_manager
import spiceypy as spice

# Initial Pre-Configured Realistic NASA Candidate Scenarios (Connecting Ridge, Site 01)
INITIAL_SCENARIOS: List[ScenarioRecord] = [
    ScenarioRecord(
        id="scenario-cr-crest",
        name="Connecting Ridge — High Crest (Peak Beta)",
        description="High-elevation crest on the Shackleton-de Gerlache Connecting Ridge with prolonged solar illumination and direct Earth line-of-sight.",
        site_id="site01",
        latitude=-89.4632,
        longitude=-137.4896,
        observer_height_m=2.0,
        start_timestamp_iso="2026-10-04T12:00:00Z",
        end_timestamp_iso="2026-10-07T12:00:00Z",
        step_interval_hours=2.0,
        azimuth_resolution_deg=2.0,
        max_search_distance_m=5000.0,
        aberration_correction="LT+S",
        created_at_iso="2026-10-01T00:00:00Z",
        updated_at_iso="2026-10-01T00:00:00Z",
    ),
    ScenarioRecord(
        id="scenario-cr-alpha",
        name="Connecting Ridge — Candidate 01A",
        description="Artemis candidate landing zone along the southern ridge saddle with moderate local slopes and extended sunlight windows.",
        site_id="site01",
        latitude=-89.3615,
        longitude=-151.2131,
        observer_height_m=2.0,
        start_timestamp_iso="2026-10-04T12:00:00Z",
        end_timestamp_iso="2026-10-07T12:00:00Z",
        step_interval_hours=2.0,
        azimuth_resolution_deg=2.0,
        max_search_distance_m=5000.0,
        aberration_correction="LT+S",
        created_at_iso="2026-10-01T00:00:00Z",
        updated_at_iso="2026-10-01T00:00:00Z",
    ),
    ScenarioRecord(
        id="scenario-cr-south",
        name="Connecting Ridge — South Rim Ridge",
        description="Candidate outpost adjacent to the Shackleton crater outer flank overlooking the permanently shadowed interior.",
        site_id="site01",
        latitude=-89.5800,
        longitude=-135.5000,
        observer_height_m=2.0,
        start_timestamp_iso="2026-10-04T12:00:00Z",
        end_timestamp_iso="2026-10-07T12:00:00Z",
        step_interval_hours=2.0,
        azimuth_resolution_deg=2.0,
        max_search_distance_m=5000.0,
        aberration_correction="LT+S",
        created_at_iso="2026-10-01T00:00:00Z",
        updated_at_iso="2026-10-01T00:00:00Z",
    ),
    ScenarioRecord(
        id="scenario-cr-north",
        name="Connecting Ridge — North Saddle Outpost",
        description="Northern approach shoulder candidate evaluated for rover transit accessibility and landing hazard safety.",
        site_id="site01",
        latitude=-89.2500,
        longitude=-139.8000,
        observer_height_m=2.0,
        start_timestamp_iso="2026-10-04T12:00:00Z",
        end_timestamp_iso="2026-10-07T12:00:00Z",
        step_interval_hours=2.0,
        azimuth_resolution_deg=2.0,
        max_search_distance_m=5000.0,
        aberration_correction="LT+S",
        created_at_iso="2026-10-01T00:00:00Z",
        updated_at_iso="2026-10-01T00:00:00Z",
    ),
    ScenarioRecord(
        id="scenario-sr-peak",
        name="Shackleton Rim — Peak of Eternal Light (ROI #1)",
        description="Authentic NASA Product 78 ROI #1 atop Shackleton crater rim crest. High solar illumination near lunar South Pole.",
        site_id="site04",
        latitude=-89.7614,
        longitude=-157.1156,
        observer_height_m=2.0,
        start_timestamp_iso="2026-10-04T12:00:00Z",
        end_timestamp_iso="2026-10-07T12:00:00Z",
        step_interval_hours=2.0,
        azimuth_resolution_deg=2.0,
        max_search_distance_m=5000.0,
        aberration_correction="LT+S",
        created_at_iso="2026-10-01T00:00:00Z",
        updated_at_iso="2026-10-01T00:00:00Z",
    ),
    ScenarioRecord(
        id="scenario-sr-ridge",
        name="Shackleton Rim — South Ridge Outpost (ROI #2)",
        description="Authentic NASA Product 78 ROI #2 along Shackleton rim saddle overlooking permanently shadowed crater interior.",
        site_id="site04",
        latitude=-89.7717,
        longitude=-156.5151,
        observer_height_m=2.0,
        start_timestamp_iso="2026-10-04T12:00:00Z",
        end_timestamp_iso="2026-10-07T12:00:00Z",
        step_interval_hours=2.0,
        azimuth_resolution_deg=2.0,
        max_search_distance_m=5000.0,
        aberration_correction="LT+S",
        created_at_iso="2026-10-01T00:00:00Z",
        updated_at_iso="2026-10-01T00:00:00Z",
    ),
    ScenarioRecord(
        id="scenario-dg-crest",
        name="de Gerlache Rim — High Ridge Crest (ROI #1)",
        description="Authentic NASA Product 78 ROI #1 atop de Gerlache rim with continuous line-of-sight to Earth and gentle slopes.",
        site_id="site11",
        latitude=-88.6682,
        longitude=-68.3820,
        observer_height_m=2.0,
        start_timestamp_iso="2026-10-04T12:00:00Z",
        end_timestamp_iso="2026-10-07T12:00:00Z",
        step_interval_hours=2.0,
        azimuth_resolution_deg=2.0,
        max_search_distance_m=5000.0,
        aberration_correction="LT+S",
        created_at_iso="2026-10-01T00:00:00Z",
        updated_at_iso="2026-10-01T00:00:00Z",
    ),
    ScenarioRecord(
        id="scenario-dg-shoulder",
        name="de Gerlache Rim — Southern Shoulder (ROI #3)",
        description="Authentic NASA Product 78 ROI #3 offering stable landing terrain adjacent to de Gerlache shadowed interior.",
        site_id="site11",
        latitude=-88.7031,
        longitude=-68.4055,
        observer_height_m=2.0,
        start_timestamp_iso="2026-10-04T12:00:00Z",
        end_timestamp_iso="2026-10-07T12:00:00Z",
        step_interval_hours=2.0,
        azimuth_resolution_deg=2.0,
        max_search_distance_m=5000.0,
        aberration_correction="LT+S",
        created_at_iso="2026-10-01T00:00:00Z",
        updated_at_iso="2026-10-01T00:00:00Z",
    ),
]

from pathlib import Path

STORAGE_FILE = Path(__file__).resolve().parent.parent.parent / "data" / "mission_scenarios.json"

class ScenarioEngineService:
    def __init__(self, storage_path: Optional[Path] = None):
        self.storage_file = storage_path or STORAGE_FILE
        self._lock = threading.Lock()
        self.visibility_svc = visibility_service
        self.catalogue_svc = catalogue_service
        self.dem_loader_svc = dem_loader
        self._scenarios: Dict[str, ScenarioRecord] = {}
        self._load_from_storage()

    def _load_from_storage(self):
        """Loads scenarios from disk storage, or initializes with NASA candidate scenarios."""
        with self._lock:
            if self.storage_file.exists():
                try:
                    with open(self.storage_file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    loaded = {}
                    for item in data:
                        rec = ScenarioRecord.model_validate(item)
                        if rec.id in loaded:
                            raise ValueError(f"Duplicate scenario ID '{rec.id}' detected in storage.")
                        loaded[rec.id] = rec
                    if loaded:
                        self._scenarios = loaded
                        return
                except Exception as e:
                    print(f"[ScenarioEngineService] Failed to load {self.storage_file}: {e}")
                    # Safely quarantine corrupted storage so data can be inspected/recovered
                    try:
                        corrupt_backup = self.storage_file.with_suffix(".corrupt.bak")
                        shutil.copy2(self.storage_file, corrupt_backup)
                        print(f"[ScenarioEngineService] Quarantined corrupted storage to {corrupt_backup}")
                    except Exception as copy_err:
                        print(f"[ScenarioEngineService] Failed to quarantine corrupt file: {copy_err}")

            # Initialize with pre-configured scenarios
            self._scenarios = {s.id: s for s in INITIAL_SCENARIOS}
            self._save_to_storage_unlocked()

    def _save_to_storage(self):
        """Persists all scenarios to JSON storage on disk using atomic file replacement."""
        with self._lock:
            self._save_to_storage_unlocked()

    def _save_to_storage_unlocked(self):
        """Internal helper to atomically write JSON data while lock is held."""
        try:
            self.storage_file.parent.mkdir(parents=True, exist_ok=True)
            data = [s.model_dump() for s in self._scenarios.values()]
            temp_dir = self.storage_file.parent
            with tempfile.NamedTemporaryFile("w", dir=temp_dir, delete=False, encoding="utf-8", suffix=".tmp") as tf:
                json.dump(data, tf, indent=2)
                tf.flush()
                os.fsync(tf.fileno())
                temp_path = Path(tf.name)

            # Atomic replacement guarantees no partial or corrupted file can ever exist at self.storage_file
            os.replace(temp_path, self.storage_file)
        except Exception as e:
            print(f"[ScenarioEngineService] Warning: Failed to persist scenarios to {self.storage_file}: {e}")
            if "temp_path" in locals() and temp_path.exists():
                try:
                    temp_path.unlink()
                except OSError:
                    pass

    def list_scenarios(self) -> List[ScenarioRecord]:
        with self._lock:
            return list(self._scenarios.values())

    def get_scenario(self, scenario_id: str) -> Optional[ScenarioRecord]:
        with self._lock:
            return self._scenarios.get(scenario_id)

    def validate_scenario_parameters(
        self,
        site_id: str,
        latitude: float,
        longitude: float,
        start_iso: str,
        end_iso: str,
    ) -> List[str]:
        """
        Strict validation against real NASA LOLA DEM datasets and time boundaries.
        Never allows synthetic datasets or arbitrary fake coordinates outside DEM.
        """
        errors = []
        dataset = self.catalogue_svc.get_by_id(site_id)
        if not dataset:
            errors.append(f"Site/Dataset '{site_id}' does not exist in NASA LOLA Registry.")
            return errors

        # Check bounds: evaluate stereographic projected bounds for exact polar coverage
        from app.services.coordinate_transform import transformer
        proj_x, proj_y = transformer.lat_lon_to_xy(latitude, longitude)
        bp = dataset.bounds_projected
        if bp:
            if not (bp["left"] <= proj_x <= bp["right"] and bp["bottom"] <= proj_y <= bp["top"]):
                errors.append(
                    f"Coordinates ({latitude:.4f}°, {longitude:.4f}°) lie outside DEM '{site_id}' geographic bounds and coverage."
                )
        else:
            bg = dataset.bounds_geographic
            if not (bg["min_lat"] <= latitude <= bg["max_lat"] and bg["min_lon"] <= longitude <= bg["max_lon"]):
                errors.append(
                    f"Coordinates ({latitude:.4f}°, {longitude:.4f}°) lie outside {dataset.name} geographic bounds."
                )

        # Validate time
        try:
            st = datetime.fromisoformat(start_iso.replace("Z", "+00:00"))
            et = datetime.fromisoformat(end_iso.replace("Z", "+00:00"))
            if et <= st:
                errors.append(f"End timestamp ({end_iso}) must be strictly after start timestamp ({start_iso}).")
            duration_days = (et - st).total_seconds() / 86400.0
            if duration_days > 90.0:
                errors.append(f"Mission duration of {duration_days:.1f} days exceeds maximum supported limit (90 days).")
            if duration_days < (1.0 / 24.0):
                errors.append(f"Mission duration must be at least 1 hour.")
        except Exception as e:
            errors.append(f"Invalid ISO 8601 timestamp format: {str(e)}")

        return errors

    def create_scenario(self, req: ScenarioCreateRequest) -> ScenarioRecord:
        errors = self.validate_scenario_parameters(
            req.site_id, req.latitude, req.longitude, req.start_timestamp_iso, req.end_timestamp_iso
        )
        if errors:
            raise ValueError("; ".join(errors))

        with self._lock:
            scenario_id = f"scenario-{uuid.uuid4().hex[:8]}"
            while scenario_id in self._scenarios:
                scenario_id = f"scenario-{uuid.uuid4().hex[:8]}"
            now_iso = datetime.now(timezone.utc).isoformat()

            record = ScenarioRecord(
                id=scenario_id,
                name=req.name,
                description=req.description or "",
                site_id=req.site_id,
                latitude=req.latitude,
                longitude=req.longitude,
                observer_height_m=req.observer_height_m,
                start_timestamp_iso=req.start_timestamp_iso,
                end_timestamp_iso=req.end_timestamp_iso,
                step_interval_hours=req.step_interval_hours,
                azimuth_resolution_deg=req.azimuth_resolution_deg,
                max_search_distance_m=req.max_search_distance_m,
                aberration_correction=req.aberration_correction,
                created_at_iso=now_iso,
                updated_at_iso=now_iso,
            )
            self._scenarios[scenario_id] = record
            self._save_to_storage_unlocked()
            return record

    def update_scenario(self, scenario_id: str, req: ScenarioUpdateRequest) -> ScenarioRecord:
        with self._lock:
            if scenario_id not in self._scenarios:
                raise KeyError(f"Scenario '{scenario_id}' not found.")

            current = self._scenarios[scenario_id]
            new_site_id = req.site_id if req.site_id is not None else current.site_id
            new_lat = req.latitude if req.latitude is not None else current.latitude
            new_lon = req.longitude if req.longitude is not None else current.longitude
            new_st = req.start_timestamp_iso if req.start_timestamp_iso is not None else current.start_timestamp_iso
            new_et = req.end_timestamp_iso if req.end_timestamp_iso is not None else current.end_timestamp_iso

            errors = self.validate_scenario_parameters(new_site_id, new_lat, new_lon, new_st, new_et)
            if errors:
                raise ValueError("; ".join(errors))

            now_iso = datetime.now(timezone.utc).isoformat()
            updated = ScenarioRecord(
                id=current.id,
                name=req.name if req.name is not None else current.name,
                description=req.description if req.description is not None else current.description,
                site_id=new_site_id,
                latitude=new_lat,
                longitude=new_lon,
                observer_height_m=req.observer_height_m if req.observer_height_m is not None else current.observer_height_m,
                start_timestamp_iso=new_st,
                end_timestamp_iso=new_et,
                step_interval_hours=req.step_interval_hours if req.step_interval_hours is not None else current.step_interval_hours,
                azimuth_resolution_deg=req.azimuth_resolution_deg if req.azimuth_resolution_deg is not None else current.azimuth_resolution_deg,
                max_search_distance_m=req.max_search_distance_m if req.max_search_distance_m is not None else current.max_search_distance_m,
                aberration_correction=req.aberration_correction if req.aberration_correction is not None else current.aberration_correction,
                created_at_iso=current.created_at_iso,
                updated_at_iso=now_iso,
            )
            self._scenarios[scenario_id] = updated
            self._save_to_storage_unlocked()
            return updated

    def duplicate_scenario(self, scenario_id: str) -> ScenarioRecord:
        with self._lock:
            if scenario_id not in self._scenarios:
                raise KeyError(f"Scenario '{scenario_id}' not found.")

            orig = self._scenarios[scenario_id]
            new_id = f"scenario-{uuid.uuid4().hex[:8]}"
            while new_id in self._scenarios:
                new_id = f"scenario-{uuid.uuid4().hex[:8]}"
            now_iso = datetime.now(timezone.utc).isoformat()

            clone = ScenarioRecord(
                id=new_id,
                name=f"{orig.name} (Copy)",
                description=orig.description,
                site_id=orig.site_id,
                latitude=orig.latitude,
                longitude=orig.longitude,
                observer_height_m=orig.observer_height_m,
                start_timestamp_iso=orig.start_timestamp_iso,
                end_timestamp_iso=orig.end_timestamp_iso,
                step_interval_hours=orig.step_interval_hours,
                azimuth_resolution_deg=orig.azimuth_resolution_deg,
                max_search_distance_m=orig.max_search_distance_m,
                aberration_correction=orig.aberration_correction,
                created_at_iso=now_iso,
                updated_at_iso=now_iso,
            )
            self._scenarios[new_id] = clone
            self._save_to_storage_unlocked()
            return clone

    def delete_scenario(self, scenario_id: str) -> bool:
        with self._lock:
            if scenario_id in self._scenarios:
                del self._scenarios[scenario_id]
                self._save_to_storage_unlocked()
                return True
            return False

    def evaluate_constraints(
        self,
        constraints: MissionConstraints,
        solar: Any,
        earth: Any,
        terrain: ScenarioTerrainMetrics,
    ) -> List[ConstraintResult]:
        results: List[ConstraintResult] = []
        is_partial_dem = terrain.dem_coverage_status != "complete"
        partial_note = " [Caution: Observer has partial DEM coverage; unmodeled distant terrain could affect visibility]" if is_partial_dem else ""

        # 1. Minimum Sunlight Hours
        if constraints.min_sunlight_hours is not None:
            req_val = constraints.min_sunlight_hours
            actual = getattr(solar, "total_sun_visible_hours", None)
            if actual is None:
                results.append(ConstraintResult(
                    constraint_id="min_sunlight_hours",
                    constraint_name="Minimum Total Sunlight Duration",
                    required_criterion=f"≥ {req_val:.1f} h (inclusive)",
                    actual_value_str="N/A",
                    status="INDETERMINATE",
                    explanation="Solar visibility metric unavailable for this scenario."
                ))
            else:
                passed = actual >= req_val
                results.append(
                    ConstraintResult(
                        constraint_id="min_sunlight_hours",
                        constraint_name="Minimum Total Sunlight Duration",
                        required_criterion=f"≥ {req_val:.1f} h (inclusive)",
                        actual_value_str=f"{actual:.1f} h",
                        status="PASSED" if passed else "FAILED",
                        explanation=(
                            f"Scenario achieved {actual:.1f} h of geometric sunlight, meeting requirement of {req_val:.1f} h.{partial_note}"
                            if passed else
                            f"Scenario achieved {actual:.1f} h of geometric sunlight, falling short of {req_val:.1f} h requirement.{partial_note}"
                        ),
                    )
                )

        # 2. Minimum Sunlight Percentage
        if constraints.min_sunlight_pct is not None:
            req_pct = constraints.min_sunlight_pct
            frac = getattr(solar, "illumination_fraction", None)
            if frac is None:
                results.append(ConstraintResult(
                    constraint_id="min_sunlight_pct",
                    constraint_name="Minimum Illumination Fraction",
                    required_criterion=f"≥ {req_pct:.1f}% (inclusive)",
                    actual_value_str="N/A",
                    status="INDETERMINATE",
                    explanation="Illumination fraction unavailable for this scenario."
                ))
            else:
                actual_pct = frac * 100.0
                passed = actual_pct >= req_pct
                results.append(
                    ConstraintResult(
                        constraint_id="min_sunlight_pct",
                        constraint_name="Minimum Illumination Fraction",
                        required_criterion=f"≥ {req_pct:.1f}% (inclusive)",
                        actual_value_str=f"{actual_pct:.1f}%",
                        status="PASSED" if passed else "FAILED",
                        explanation=(
                            f"Illumination fraction {actual_pct:.1f}% satisfies criterion of {req_pct:.1f}%.{partial_note}"
                            if passed else
                            f"Illumination fraction {actual_pct:.1f}% is below required {req_pct:.1f}%.{partial_note}"
                        ),
                    )
                )

        # 3. Maximum Continuous Darkness
        if constraints.max_darkness_hours is not None:
            req_dark = constraints.max_darkness_hours
            actual_dark = getattr(solar, "longest_darkness_hours", None)
            if actual_dark is None:
                results.append(ConstraintResult(
                    constraint_id="max_darkness_hours",
                    constraint_name="Maximum Continuous Darkness",
                    required_criterion=f"≤ {req_dark:.1f} h (inclusive)",
                    actual_value_str="N/A",
                    status="INDETERMINATE",
                    explanation="Continuous darkness metric unavailable for this scenario."
                ))
            else:
                passed = actual_dark <= req_dark
                results.append(
                    ConstraintResult(
                        constraint_id="max_darkness_hours",
                        constraint_name="Maximum Continuous Darkness",
                        required_criterion=f"≤ {req_dark:.1f} h (inclusive)",
                        actual_value_str=f"{actual_dark:.1f} h",
                        status="PASSED" if passed else "FAILED",
                        explanation=(
                            f"Longest continuous darkness period of {actual_dark:.1f} h is within allowable {req_dark:.1f} h limit."
                            if passed else
                            f"Longest continuous darkness period of {actual_dark:.1f} h exceeds maximum allowable {req_dark:.1f} h limit."
                        ),
                    )
                )

        # 4. Minimum Earth Visibility Hours
        if constraints.min_earth_visible_hours is not None:
            req_e = constraints.min_earth_visible_hours
            actual_e = getattr(earth, "total_earth_visible_hours", None)
            if actual_e is None:
                results.append(ConstraintResult(
                    constraint_id="min_earth_visible_hours",
                    constraint_name="Minimum Earth Line-of-Sight Duration",
                    required_criterion=f"≥ {req_e:.1f} h (inclusive)",
                    actual_value_str="N/A",
                    status="INDETERMINATE",
                    explanation="Earth visibility duration metric unavailable for this scenario."
                ))
            else:
                passed = actual_e >= req_e
                results.append(
                    ConstraintResult(
                        constraint_id="min_earth_visible_hours",
                        constraint_name="Minimum Earth Line-of-Sight Duration",
                        required_criterion=f"≥ {req_e:.1f} h (inclusive)",
                        actual_value_str=f"{actual_e:.1f} h",
                        status="PASSED" if passed else "FAILED",
                        explanation=(
                            f"Earth geometric line-of-sight of {actual_e:.1f} h satisfies required {req_e:.1f} h.{partial_note}"
                            if passed else
                            f"Earth geometric line-of-sight of {actual_e:.1f} h is below required {req_e:.1f} h.{partial_note}"
                        ),
                    )
                )

        # 5. Minimum Earth Visibility Percentage
        if constraints.min_earth_visible_pct is not None:
            req_e_pct = constraints.min_earth_visible_pct
            frac_e = getattr(earth, "earth_visibility_fraction", None)
            if frac_e is None:
                results.append(ConstraintResult(
                    constraint_id="min_earth_visible_pct",
                    constraint_name="Minimum Earth Visibility Fraction",
                    required_criterion=f"≥ {req_e_pct:.1f}% (inclusive)",
                    actual_value_str="N/A",
                    status="INDETERMINATE",
                    explanation="Earth visibility fraction unavailable for this scenario."
                ))
            else:
                actual_e_pct = frac_e * 100.0
                passed = actual_e_pct >= req_e_pct
                results.append(
                    ConstraintResult(
                        constraint_id="min_earth_visible_pct",
                        constraint_name="Minimum Earth Visibility Fraction",
                        required_criterion=f"≥ {req_e_pct:.1f}% (inclusive)",
                        actual_value_str=f"{actual_e_pct:.1f}%",
                        status="PASSED" if passed else "FAILED",
                        explanation=(
                            f"Earth visibility fraction {actual_e_pct:.1f}% satisfies criterion of {req_e_pct:.1f}%.{partial_note}"
                            if passed else
                            f"Earth visibility fraction {actual_e_pct:.1f}% is below required {req_e_pct:.1f}%.{partial_note}"
                        ),
                    )
                )

        # 6. Maximum Earth Blackout Hours
        if constraints.max_earth_blackout_hours is not None:
            req_los = constraints.max_earth_blackout_hours
            actual_los = getattr(earth, "longest_earth_blackout_hours", None)
            if actual_los is None:
                results.append(ConstraintResult(
                    constraint_id="max_earth_blackout_hours",
                    constraint_name="Maximum Continuous Earth LOS Blackout",
                    required_criterion=f"≤ {req_los:.1f} h (inclusive)",
                    actual_value_str="N/A",
                    status="INDETERMINATE",
                    explanation="Earth blackout duration unavailable for this scenario."
                ))
            else:
                passed = actual_los <= req_los
                results.append(
                    ConstraintResult(
                        constraint_id="max_earth_blackout_hours",
                        constraint_name="Maximum Continuous Earth LOS Blackout",
                        required_criterion=f"≤ {req_los:.1f} h (inclusive)",
                        actual_value_str=f"{actual_los:.1f} h",
                        status="PASSED" if passed else "FAILED",
                        explanation=(
                            f"Longest Earth blackout duration of {actual_los:.1f} h is within allowable {req_los:.1f} h limit."
                            if passed else
                            f"Longest Earth blackout duration of {actual_los:.1f} h exceeds maximum allowable {req_los:.1f} h limit."
                        ),
                    )
                )

        # 7. Maximum Allowable Terrain Slope
        if constraints.max_allowable_slope_deg is not None:
            req_slp = constraints.max_allowable_slope_deg
            if terrain.local_slope_deg is not None:
                actual_slp = terrain.local_slope_deg
                passed = actual_slp <= req_slp
                results.append(
                    ConstraintResult(
                        constraint_id="max_allowable_slope_deg",
                        constraint_name="Maximum Landing Site Slope",
                        required_criterion=f"≤ {req_slp:.1f}° (inclusive)",
                        actual_value_str=f"{actual_slp:.1f}°",
                        status="PASSED" if passed else "FAILED",
                        explanation=(
                            f"Local slope of {actual_slp:.1f}° satisfies safety limit of {req_slp:.1f}°."
                            if passed else
                            f"Local slope of {actual_slp:.1f}° exceeds safety limit of {req_slp:.1f}° (lander tilt hazard)."
                        ),
                    )
                )
            else:
                results.append(
                    ConstraintResult(
                        constraint_id="max_allowable_slope_deg",
                        constraint_name="Maximum Landing Site Slope",
                        required_criterion=f"≤ {req_slp:.1f}° (inclusive)",
                        actual_value_str="N/A",
                        status="INDETERMINATE",
                        explanation="Local slope data unavailable for this coordinate in active DEM product.",
                    )
                )

        return results

    def compare_scenarios(
        self, req: MultiScenarioComparisonRequest
    ) -> MultiScenarioComparisonResponse:
        """
        Executes a scientifically fair multi-scenario comparison across 2 to 4 candidate scenarios.
        """
        if len(req.scenario_ids) < 2 or len(req.scenario_ids) > 4:
            raise ValueError("Multi-scenario comparison requires between 2 and 4 scenarios.")

        selected_scenarios: List[ScenarioRecord] = []
        for sid in req.scenario_ids:
            if sid not in self._scenarios:
                raise KeyError(f"Scenario '{sid}' not found.")
            selected_scenarios.append(self._scenarios[sid])

        # Determine Harmonization
        harmonization_notes = []
        is_harmonized = req.enforce_harmonized_time

        ref_scenario = selected_scenarios[0]
        ref_start_iso = req.override_start_iso or ref_scenario.start_timestamp_iso
        ref_step_hours = req.override_step_hours or ref_scenario.step_interval_hours

        if req.override_duration_days is not None:
            ref_st = datetime.fromisoformat(ref_start_iso.replace("Z", "+00:00"))
            ref_et = datetime.fromtimestamp(
                ref_st.timestamp() + req.override_duration_days * 86400.0, tz=timezone.utc
            )
            ref_end_iso = ref_et.isoformat().replace("+00:00", "Z")
        else:
            ref_end_iso = ref_scenario.end_timestamp_iso

        if is_harmonized:
            harmonization_notes.append(
                f"Harmonized comparison window enforced: Start = {ref_start_iso}, "
                f"End = {ref_end_iso}, Step = {ref_step_hours}h across all scenarios."
            )

        scenario_results: List[ScenarioComparisonResult] = []

        for sc in selected_scenarios:
            config_diffs = []
            warnings = []

            # Time parameters for this scenario
            if is_harmonized:
                start_iso = ref_start_iso
                end_iso = ref_end_iso
                step_hours = ref_step_hours
            else:
                start_iso = sc.start_timestamp_iso
                end_iso = sc.end_timestamp_iso
                step_hours = sc.step_interval_hours

            # Identify configuration differences relative to reference scenario
            if sc.start_timestamp_iso != ref_scenario.start_timestamp_iso:
                config_diffs.append(f"Different start epoch: {sc.start_timestamp_iso} vs {ref_scenario.start_timestamp_iso}")
            if sc.end_timestamp_iso != ref_scenario.end_timestamp_iso:
                config_diffs.append(f"Different end epoch: {sc.end_timestamp_iso} vs {ref_scenario.end_timestamp_iso}")
            if sc.step_interval_hours != ref_scenario.step_interval_hours:
                config_diffs.append(f"Different time step: {sc.step_interval_hours}h vs {ref_scenario.step_interval_hours}h")
            if sc.observer_height_m != ref_scenario.observer_height_m:
                config_diffs.append(f"Different observer height: {sc.observer_height_m}m vs {ref_scenario.observer_height_m}m")
            if sc.site_id != ref_scenario.site_id:
                config_diffs.append(f"Different DEM dataset: {sc.site_id} vs {ref_scenario.site_id}")

            # 1. Run Visibility Engine Analysis
            vis_req = VisibilityAnalysisRequest(
                latitude=sc.latitude,
                longitude=sc.longitude,
                start_timestamp_iso=start_iso,
                end_timestamp_iso=end_iso,
                step_interval_hours=step_hours,
                observer_height_m=sc.observer_height_m,
                dataset_id=sc.site_id,
                azimuth_resolution_deg=sc.azimuth_resolution_deg,
                max_search_distance_m=sc.max_search_distance_m,
                aberration_correction=sc.aberration_correction,
            )
            vis_resp = self.visibility_svc.compute_visibility_analysis(vis_req)

            # 2. Extract Terrain Metrics
            pt_sample = self.dem_loader_svc.sample_point(sc.latitude, sc.longitude)
            dem_meta = self.dem_loader_svc.get_metadata()
            dataset_rec = self.catalogue_svc.get_by_id(sc.site_id)

            if not pt_sample.get("in_bounds", False):
                warnings.append("Observer point is outside active DEM extent; elevation is approximated or indeterminate.")

            terrain_metrics = ScenarioTerrainMetrics(
                observer_surface_elevation_m=vis_resp.observer_surface_elevation_m,
                observer_height_m=sc.observer_height_m,
                total_observer_elevation_m=vis_resp.observer_surface_elevation_m + sc.observer_height_m,
                local_slope_deg=pt_sample.get("slope_deg"),
                elevation_min_m=dem_meta.elevation_stats.min_m if dem_meta else 0.0,
                elevation_max_m=dem_meta.elevation_stats.max_m if dem_meta else 0.0,
                elevation_mean_m=dem_meta.elevation_stats.mean_m if dem_meta else 0.0,
                dem_coverage_status=vis_resp.terrain_horizon_summary.coverage_status,
                dem_nominal_spacing_m=dataset_rec.nominal_pixel_spacing_m if dataset_rec else 5.0,
                effective_resolution_note=(
                    dataset_rec.effective_resolution_note
                    if dataset_rec else
                    "Nominal grid spacing. ~90% of raster pixels are interpolated between ground tracks."
                ),
                lola_laser_count=pt_sample.get("lola_count"),
                vertical_uncertainty_m=pt_sample.get("elevation_uncertainty_m"),
                slope_uncertainty_deg=pt_sample.get("slope_uncertainty_deg"),
                dataset_citation=dataset_rec.citation if dataset_rec else "NASA LOLA Barker et al.",
            )

            # 3. Evaluate Constraints
            constraints_results = []
            if req.constraints:
                constraints_results = self.evaluate_constraints(
                    req.constraints, vis_resp.solar_metrics, vis_resp.earth_metrics, terrain_metrics
                )

            passed_cnt = sum(1 for c in constraints_results if c.status == "PASSED")
            failed_cnt = sum(1 for c in constraints_results if c.status == "FAILED")
            indet_cnt = sum(1 for c in constraints_results if c.status == "INDETERMINATE")

            scenario_results.append(
                ScenarioComparisonResult(
                    scenario=sc,
                    terrain=terrain_metrics,
                    solar=vis_resp.solar_metrics,
                    earth=vis_resp.earth_metrics,
                    combined=vis_resp.combined_metrics,
                    timeline=vis_resp.series,
                    transitions=vis_resp.transitions,
                    constraints=constraints_results,
                    passed_constraints_count=passed_cnt,
                    failed_constraints_count=failed_cnt,
                    indeterminate_constraints_count=indet_cnt,
                    warnings=warnings + vis_resp.warnings,
                    configuration_differences=config_diffs,
                )
            )

        # Transparent Constraint Ranking
        ranking_items: List[ScenarioRankingItem] = []
        sorted_scenarios = sorted(
            scenario_results,
            key=lambda r: (
                r.passed_constraints_count,
                r.solar.total_sun_visible_hours,
                r.earth.total_earth_visible_hours,
                -(r.terrain.local_slope_deg or 999.0),
            ),
            reverse=True,
        )

        for rank_idx, res in enumerate(sorted_scenarios, start=1):
            total_c = len(res.constraints)
            score_pct = (res.passed_constraints_count / total_c * 100.0) if total_c > 0 else 100.0

            # Formulate clear transparent trade-off explanation
            tradeoffs = []
            if res.solar.total_darkness_hours > 0:
                tradeoffs.append(f"{res.solar.longest_darkness_hours:.1f}h continuous darkness")
            else:
                tradeoffs.append("Continuous solar illumination")

            if res.earth.total_earth_blackout_hours > 0:
                tradeoffs.append(f"{res.earth.longest_earth_blackout_hours:.1f}h Earth blackout")
            else:
                tradeoffs.append("Uninterrupted direct Earth line-of-sight")

            if res.terrain.local_slope_deg is not None:
                tradeoffs.append(f"{res.terrain.local_slope_deg:.1f}° landing slope")

            ranking_items.append(
                ScenarioRankingItem(
                    rank=rank_idx,
                    scenario_id=res.scenario.id,
                    scenario_name=res.scenario.name,
                    passed_count=res.passed_constraints_count,
                    total_count=total_c,
                    compliance_score_pct=round(score_pct, 1),
                    dominant_tradeoff="; ".join(tradeoffs),
                )
            )

        return MultiScenarioComparisonResponse(
            comparison_id=f"cmp-{uuid.uuid4().hex[:8]}",
            timestamp_iso=datetime.now(timezone.utc).isoformat(),
            is_harmonized=is_harmonized,
            harmonization_notes=harmonization_notes,
            scenarios=scenario_results,
            ranking_summary=ranking_items,
            scientific_caveats=[
                "Solar visibility indicates topocentric line-of-sight geometry; actual electrical power depends on panel orientation, dust accumulation, temperature, and efficiency.",
                "Earth visibility indicates direct optical line-of-sight geometry; RF communication availability requires link-budget calculation, antenna gain, and transmitter margins.",
                "DEM grid spacing (e.g. 5 m/pixel) is nominal; ~90% of LOLA pixels are interpolated between orbital ground tracks.",
                "Comparisons with differing simulation epochs, observer heights, or DEM extents are explicitly flagged to preserve scientific integrity.",
                "Constraint compliance ranking orders candidates strictly by user-selected criteria satisfaction; it does not constitute an assessment of overall mission viability or independent scientific superiority.",
                "Site 01 DEM spatial extent is 16 km x 16 km (256 km²); coverage percentages represent the spatial intersection with the user's regional bounding box, not the entire lunar circumpolar cap.",
            ],
            provenance={
                "spice_toolkit": f"CSPICE_{spice.tkvrsn('TOOLKIT')}",
                "lunar_frame": "MOON_ME (DE421)",
                "dem_dataset": "NASA LOLA PGDA Product 78 / Barker et al. (2021)",
            },
        )

    def export_comparison(
        self, resp: MultiScenarioComparisonResponse, export_format: str
    ) -> str:
        """
        Exports comparison results to CSV or JSON format.
        """
        if export_format == "json":
            return resp.model_dump_json(indent=2)

        # CSV format
        output = io.StringIO()
        writer = csv.writer(output)

        # Header Section
        writer.writerow(["# LUNAVISTA MULTI-SCENARIO MISSION COMPARISON EXPORT"])
        writer.writerow(["# Comparison ID", resp.comparison_id])
        writer.writerow(["# Timestamp (UTC)", resp.timestamp_iso])
        writer.writerow(["# Harmonized Comparison", str(resp.is_harmonized)])
        writer.writerow([])

        # Table 1: Scenario Overview & Location
        writer.writerow(["--- SCENARIO SPECIFICATIONS & TERRAIN METRICS ---"])
        writer.writerow([
            "Scenario ID",
            "Scenario Name",
            "Site ID",
            "Latitude (deg)",
            "Longitude (deg)",
            "Surface Elevation (m)",
            "Observer Eye Height (m)",
            "Total Elevation (m)",
            "Local Slope (deg)",
            "DEM Spacing (m)",
            "DEM Coverage",
        ])
        for sc_res in resp.scenarios:
            sc = sc_res.scenario
            t = sc_res.terrain
            writer.writerow([
                sc.id,
                sc.name,
                sc.site_id,
                f"{sc.latitude:.4f}",
                f"{sc.longitude:.4f}",
                f"{t.observer_surface_elevation_m:.1f}",
                f"{t.observer_height_m:.1f}",
                f"{t.total_observer_elevation_m:.1f}",
                f"{t.local_slope_deg:.2f}" if t.local_slope_deg is not None else "N/A",
                f"{t.dem_nominal_spacing_m:.1f}",
                t.dem_coverage_status,
            ])
        writer.writerow([])

        # Table 2: Solar Metrics
        writer.writerow(["--- SOLAR ILLUMINATION METRICS ---"])
        writer.writerow([
            "Scenario ID",
            "Total Sun Hours",
            "Full Sun Hours",
            "Partial Sun Hours",
            "Total Darkness Hours",
            "Longest Darkness Hours",
            "Sunrises Count",
            "Sunsets Count",
            "Illumination Fraction (%)",
        ])
        for sc_res in resp.scenarios:
            s = sc_res.solar
            writer.writerow([
                sc_res.scenario.id,
                f"{s.total_sun_visible_hours:.2f}",
                f"{s.total_sun_full_hours:.2f}",
                f"{s.total_sun_partial_hours:.2f}",
                f"{s.total_darkness_hours:.2f}",
                f"{s.longest_darkness_hours:.2f}",
                s.sunrise_count,
                s.sunset_count,
                f"{s.illumination_fraction * 100.0:.1f}",
            ])
        writer.writerow([])

        # Table 3: Earth Visibility Metrics
        writer.writerow(["--- EARTH LINE-OF-SIGHT METRICS ---"])
        writer.writerow([
            "Scenario ID",
            "Total Earth Hours",
            "Full Earth Hours",
            "Partial Earth Hours",
            "Total Blackout Hours",
            "Longest Blackout Hours",
            "Earthrises Count",
            "Earthsets Count",
            "Earth Visibility Fraction (%)",
        ])
        for sc_res in resp.scenarios:
            e = sc_res.earth
            writer.writerow([
                sc_res.scenario.id,
                f"{e.total_earth_visible_hours:.2f}",
                f"{e.total_earth_full_hours:.2f}",
                f"{e.total_earth_partial_hours:.2f}",
                f"{e.total_earth_blackout_hours:.2f}",
                f"{e.longest_earth_blackout_hours:.2f}",
                e.earthrise_count,
                e.earthset_count,
                f"{e.earth_visibility_fraction * 100.0:.1f}",
            ])
        writer.writerow([])

        # Table 4: Combined Mission Metrics
        writer.writerow(["--- COMBINED DUAL-STATE METRICS ---"])
        writer.writerow([
            "Scenario ID",
            "Both Sun & Earth (h)",
            "Sun Only (h)",
            "Earth Only (h)",
            "Neither Visible (h)",
            "Longest Dual Visible (h)",
        ])
        for sc_res in resp.scenarios:
            c = sc_res.combined
            writer.writerow([
                sc_res.scenario.id,
                f"{c.both_visible_hours:.2f}",
                f"{c.sun_only_hours:.2f}",
                f"{c.earth_only_hours:.2f}",
                f"{c.neither_visible_hours:.2f}",
                f"{c.longest_both_visible_hours:.2f}",
            ])
        writer.writerow([])

        # Table 5: Constraint Evaluation
        writer.writerow(["--- USER MISSION CONSTRAINT EVALUATION ---"])
        writer.writerow([
            "Scenario ID",
            "Constraint Name",
            "Required Criterion",
            "Actual Value",
            "Status",
            "Explanation",
        ])
        for sc_res in resp.scenarios:
            for con in sc_res.constraints:
                writer.writerow([
                    sc_res.scenario.id,
                    con.constraint_name,
                    con.required_criterion,
                    con.actual_value_str,
                    con.status,
                    con.explanation,
                ])
        writer.writerow([])

        # Table 6: Transparent Rankings
        writer.writerow(["--- TRANSPARENT CONSTRAINT-BASED RANKING ---"])
        writer.writerow(["Rank", "Scenario ID", "Scenario Name", "Passed Criteria", "Total Criteria", "Compliance (%)", "Dominant Tradeoffs"])
        for rk in resp.ranking_summary:
            writer.writerow([
                rk.rank,
                rk.scenario_id,
                rk.scenario_name,
                rk.passed_count,
                rk.total_count,
                f"{rk.compliance_score_pct:.1f}",
                rk.dominant_tradeoff,
            ])
        writer.writerow([])

        # Caveats Section
        writer.writerow(["--- MANDATORY SCIENTIFIC CAVEATS ---"])
        for cav in resp.scientific_caveats:
            writer.writerow(["#", cav])

        return output.getvalue()

scenario_service = ScenarioEngineService()
