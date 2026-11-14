import os
import json
import uuid
import shutil
import tempfile
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Optional, Tuple

from app.schemas.mission_profile import (
    MissionProfile,
    MissionProfileCreateRequest,
    MissionProfileUpdateRequest,
    MissionProfileValidationRequest,
    MissionProfileValidationResponse,
    MissionType,
    TimeDisplayPreference,
    RequirementClassification,
    SingleRequirement,
    SolarRequirementsConfig,
    EarthRequirementsConfig,
    TerrainRequirementsConfig,
    MissionRequirementsSet,
    ValidationFeedbackItem,
)

STORAGE_FILE = Path(__file__).resolve().parent.parent.parent / "data" / "mission_profiles.json"

# Built-in starter templates
# IMPORTANT SCIENTIFIC NOTICE:
# These example values are user-editable illustrative defaults provided for organizational
# exploration and testing. They are NOT NASA-approved flight rules or official mission baselines.
# Terminology distinctions:
# - User-selected mission duration: The operational horizon configured by the mission planner.
# - Lunar synodic day: The astronomical solar day on the Moon (~29.53 Earth days / ~708.7 hours).
# - Illumination analysis window: The bounding epoch interval [start_iso, end_iso] evaluated by the ephemeris and horizon engines.
# - Operational period: The planned active timeline for surface traverse, science experiments, or habitat stay.
TEMPLATE_PROFILES: List[MissionProfile] = [
    MissionProfile(
        id="template-robotic-rover",
        name="Robotic Exploration Rover (Illustrative Template)",
        description="Template for a mobile autonomous rover exploring lunar south polar ridge terrain across a user-selected 14.0 Earth day (336.0 h) illumination analysis window. (Note: The user-selected mission duration is an operational planning window, distinct from the astronomical ~29.53-day lunar synodic cycle. Example values are user-editable illustrative defaults.)",
        mission_type=MissionType.ROBOTIC_EXPLORATION,
        duration_days=14.0,
        start_timestamp_iso="2026-10-04T12:00:00Z",
        end_timestamp_iso="2026-10-18T12:00:00Z",
        observer_height_m=1.5,
        time_display_preference=TimeDisplayPreference.UTC,
        requirements=MissionRequirementsSet(
            solar=SolarRequirementsConfig(
                min_total_sunlight_hours=SingleRequirement(
                    id="min_total_sunlight_hours",
                    name="Minimum Total Geometric Sunlight Duration",
                    classification=RequirementClassification.HARD_CONSTRAINT,
                    enabled=True,
                    value=150.0,
                    unit="hours",
                    operator="ge",
                    description="Minimum cumulative sunlight hours required to maintain rover traverse battery charge.",
                    scientific_disclaimer="Geometric illumination does not model photovoltaic panel dust coating or cosine efficiency."
                ),
                max_continuous_darkness_hours=SingleRequirement(
                    id="max_continuous_darkness_hours",
                    name="Maximum Continuous Darkness Duration",
                    classification=RequirementClassification.HARD_CONSTRAINT,
                    enabled=True,
                    value=48.0,
                    unit="hours",
                    operator="le",
                    description="Maximum survivable continuous darkness for rover secondary battery sleep mode.",
                    scientific_disclaimer="Evaluates uninterrupted zero-illumination intervals."
                ),
                min_sunlight_percentage=SingleRequirement(
                    id="min_sunlight_percentage",
                    name="Minimum Sunlight Percentage",
                    classification=RequirementClassification.SOFT_PREFERENCE,
                    enabled=True,
                    value=55.0,
                    unit="%",
                    operator="ge",
                    description="Desirable illumination percentage over the 14-day traverse envelope.",
                    scientific_disclaimer="Expressed relative to total 336-hour duration."
                ),
            ),
            earth=EarthRequirementsConfig(
                min_total_earth_visible_hours=SingleRequirement(
                    id="min_total_earth_visible_hours",
                    name="Minimum Total Geometric Earth Visibility",
                    classification=RequirementClassification.HARD_CONSTRAINT,
                    enabled=True,
                    value=100.0,
                    unit="hours",
                    operator="ge",
                    description="Direct-to-Earth line-of-sight required for telemetry and teleoperation uplinks.",
                    scientific_disclaimer="Does not model RF ground station elevation masks or Deep Space Network scheduling."
                ),
                max_continuous_earth_blackout_hours=SingleRequirement(
                    id="max_continuous_earth_blackout_hours",
                    name="Maximum Continuous Earth LOS Blackout",
                    classification=RequirementClassification.SOFT_PREFERENCE,
                    enabled=True,
                    value=24.0,
                    unit="hours",
                    operator="le",
                    description="Desirable threshold for maximum autonomous rover drive between ground contacts.",
                    scientific_disclaimer="Continuous periods where terrain completely obstructs Earth disk."
                ),
            ),
            terrain=TerrainRequirementsConfig(
                max_local_slope_deg=SingleRequirement(
                    id="max_local_slope_deg",
                    name="Maximum Allowable Landing Site Slope",
                    classification=RequirementClassification.HARD_CONSTRAINT,
                    enabled=True,
                    value=15.0,
                    unit="deg",
                    operator="le",
                    description="Maximum wheel slip / tip-over grade limit for robotic rover traverse.",
                    scientific_disclaimer="Derived from LOLA 5 m DEM slopes. Does not model rock hazards smaller than DEM pixel."
                ),
            ),
        ),
        version=1,
        is_template=True,
        created_at_iso="2026-10-01T00:00:00Z",
        updated_at_iso="2026-10-01T00:00:00Z",
    ),
    MissionProfile(
        id="template-robotic-lander",
        name="Robotic Static Lander (Illustrative Template)",
        description="Template for a stationary science and resource-prospecting lander stationed near a permanently shadowed crater rim across a user-selected 7.0 Earth day (168.0 h) operational period. (Note: The user-selected mission duration is an operational planning window, distinct from the ~29.53-day lunar synodic cycle. Example values are user-editable illustrative defaults.)",
        mission_type=MissionType.ROBOTIC_LANDER,
        duration_days=7.0,
        start_timestamp_iso="2026-10-04T12:00:00Z",
        end_timestamp_iso="2026-10-11T12:00:00Z",
        observer_height_m=2.5,
        time_display_preference=TimeDisplayPreference.UTC,
        requirements=MissionRequirementsSet(
            solar=SolarRequirementsConfig(
                min_total_sunlight_hours=SingleRequirement(
                    id="min_total_sunlight_hours",
                    name="Minimum Total Geometric Sunlight Duration",
                    classification=RequirementClassification.HARD_CONSTRAINT,
                    enabled=True,
                    value=80.0,
                    unit="hours",
                    operator="ge",
                    description="Minimum sunlight required for static deck-mounted solar arrays.",
                    scientific_disclaimer="Geometric line-of-sight only."
                ),
                max_continuous_darkness_hours=SingleRequirement(
                    id="max_continuous_darkness_hours",
                    name="Maximum Continuous Darkness Duration",
                    classification=RequirementClassification.SOFT_PREFERENCE,
                    enabled=True,
                    value=18.0,
                    unit="hours",
                    operator="le",
                    description="Lander thermal management survival limit during ridge shadow transits.",
                    scientific_disclaimer="Evaluates zero-illumination shadow crossings."
                ),
            ),
            earth=EarthRequirementsConfig(
                min_total_earth_visible_hours=SingleRequirement(
                    id="min_total_earth_visible_hours",
                    name="Minimum Total Geometric Earth Visibility",
                    classification=RequirementClassification.HARD_CONSTRAINT,
                    enabled=True,
                    value=60.0,
                    unit="hours",
                    operator="ge",
                    description="Critical Direct-to-Earth window for high-bandwidth scientific data dump.",
                    scientific_disclaimer="Does not model RF antenna gains or DSN pass availability."
                ),
            ),
            terrain=TerrainRequirementsConfig(
                max_local_slope_deg=SingleRequirement(
                    id="max_local_slope_deg",
                    name="Maximum Allowable Landing Site Slope",
                    classification=RequirementClassification.HARD_CONSTRAINT,
                    enabled=True,
                    value=10.0,
                    unit="deg",
                    operator="le",
                    description="Touchdown pad stability limit against lander tipping.",
                    scientific_disclaimer="Evaluated at 5 m DEM resolution."
                ),
            ),
        ),
        version=1,
        is_template=True,
        created_at_iso="2026-10-01T00:00:00Z",
        updated_at_iso="2026-10-01T00:00:00Z",
    ),
    MissionProfile(
        id="template-crewed-surface",
        name="Crewed Surface Sortie (Illustrative Template)",
        description="Template for a human-landing-system crewed surface stay across a user-selected 6.5 Earth day (156.0 h) operational sortie period, requiring high-availability Direct-to-Earth line-of-sight and conservative landing slope limits. (Note: The sortie duration is a mission operational period, distinct from astronomical lunar cycle lengths. Example values are user-editable illustrative defaults.)",
        mission_type=MissionType.CREWED_SURFACE,
        duration_days=6.5,
        start_timestamp_iso="2026-10-04T12:00:00Z",
        end_timestamp_iso="2026-10-11T00:00:00Z",
        observer_height_m=2.0,
        time_display_preference=TimeDisplayPreference.UTC,
        requirements=MissionRequirementsSet(
            solar=SolarRequirementsConfig(
                min_total_sunlight_hours=SingleRequirement(
                    id="min_total_sunlight_hours",
                    name="Minimum Total Geometric Sunlight Duration",
                    classification=RequirementClassification.HARD_CONSTRAINT,
                    enabled=True,
                    value=110.0,
                    unit="hours",
                    operator="ge",
                    description="Sunlight required for crew extravehicular activity (EVA) visibility and thermal control.",
                    scientific_disclaimer="Geometric solar elevation above local horizon."
                ),
                max_continuous_darkness_hours=SingleRequirement(
                    id="max_continuous_darkness_hours",
                    name="Maximum Continuous Darkness Duration",
                    classification=RequirementClassification.HARD_CONSTRAINT,
                    enabled=True,
                    value=12.0,
                    unit="hours",
                    operator="le",
                    description="EVA operations restriction during shadowed passes.",
                    scientific_disclaimer="Uninterrupted periods with zero solar disk clearance."
                ),
            ),
            earth=EarthRequirementsConfig(
                min_total_earth_visible_hours=SingleRequirement(
                    id="min_total_earth_visible_hours",
                    name="Minimum Total Geometric Earth Visibility",
                    classification=RequirementClassification.HARD_CONSTRAINT,
                    enabled=True,
                    value=140.0,
                    unit="hours",
                    operator="ge",
                    description="High-availability Earth line-of-sight for continuous mission control voice and bio-telemetry.",
                    scientific_disclaimer="Direct geometric line-of-sight."
                ),
                max_continuous_earth_blackout_hours=SingleRequirement(
                    id="max_continuous_earth_blackout_hours",
                    name="Maximum Continuous Earth LOS Blackout",
                    classification=RequirementClassification.HARD_CONSTRAINT,
                    enabled=True,
                    value=2.0,
                    unit="hours",
                    operator="le",
                    description="Strict safety limit on loss-of-signal during crewed operations.",
                    scientific_disclaimer="Does not guarantee link budget or satellite relay availability."
                ),
            ),
            terrain=TerrainRequirementsConfig(
                max_local_slope_deg=SingleRequirement(
                    id="max_local_slope_deg",
                    name="Maximum Allowable Landing Site Slope",
                    classification=RequirementClassification.HARD_CONSTRAINT,
                    enabled=True,
                    value=8.0,
                    unit="deg",
                    operator="le",
                    description="Conservative human lander touchdown stability slope limit.",
                    scientific_disclaimer="Derived from NASA LOLA 5 m DEM."
                ),
            ),
        ),
        version=1,
        is_template=True,
        created_at_iso="2026-10-01T00:00:00Z",
        updated_at_iso="2026-10-01T00:00:00Z",
    ),
    MissionProfile(
        id="template-long-duration-station",
        name="Long-Duration Scientific Station (Illustrative Template)",
        description="Template for a lunar polar outpost utilizing an elevated 10 m mast evaluated across a user-selected 28.0 Earth day (672.0 h) illumination analysis window. (Note: 28.0 Earth days is an illustrative analysis window chosen by the user, distinct from the astronomical ~29.53 Earth day / ~708.7-hour lunar synodic day. Example values are user-editable illustrative defaults.)",
        mission_type=MissionType.LONG_DURATION_STATION,
        duration_days=28.0,
        start_timestamp_iso="2026-10-01T00:00:00Z",
        end_timestamp_iso="2026-10-29T00:00:00Z",
        observer_height_m=10.0,
        time_display_preference=TimeDisplayPreference.UTC,
        requirements=MissionRequirementsSet(
            solar=SolarRequirementsConfig(
                min_total_sunlight_hours=SingleRequirement(
                    id="min_total_sunlight_hours",
                    name="Minimum Total Geometric Sunlight Duration",
                    classification=RequirementClassification.HARD_CONSTRAINT,
                    enabled=True,
                    value=400.0,
                    unit="hours",
                    operator="ge",
                    description="Cumulative solar illumination across the user-selected 28.0 Earth day (672.0 h) analysis window (distinct from the ~708.7-hour astronomical synodic month).",
                    scientific_disclaimer="Calculated at 10 m mast height above surface."
                ),
                min_sunlight_percentage=SingleRequirement(
                    id="min_sunlight_percentage",
                    name="Minimum Sunlight Percentage",
                    classification=RequirementClassification.HARD_CONSTRAINT,
                    enabled=True,
                    value=60.0,
                    unit="%",
                    operator="ge",
                    description="Outpost requires >= 60% total illumination across the user-selected 28.0 Earth day analysis window.",
                    scientific_disclaimer="Relative to 672-hour window."
                ),
                max_continuous_darkness_hours=SingleRequirement(
                    id="max_continuous_darkness_hours",
                    name="Maximum Continuous Darkness Duration",
                    classification=RequirementClassification.SOFT_PREFERENCE,
                    enabled=True,
                    value=72.0,
                    unit="hours",
                    operator="le",
                    description="Regenerative fuel cell capacity limit for shadowed intervals.",
                    scientific_disclaimer="Uninterrupted darkness period."
                ),
            ),
            earth=EarthRequirementsConfig(
                min_total_earth_visible_hours=SingleRequirement(
                    id="min_total_earth_visible_hours",
                    name="Minimum Total Geometric Earth Visibility",
                    classification=RequirementClassification.HARD_CONSTRAINT,
                    enabled=True,
                    value=500.0,
                    unit="hours",
                    operator="ge",
                    description="Persistent communication contact for autonomous scientific experiments.",
                    scientific_disclaimer="Geometric line-of-sight at 10 m mast."
                ),
            ),
            terrain=TerrainRequirementsConfig(
                max_local_slope_deg=SingleRequirement(
                    id="max_local_slope_deg",
                    name="Maximum Allowable Landing Site Slope",
                    classification=RequirementClassification.HARD_CONSTRAINT,
                    enabled=True,
                    value=12.0,
                    unit="deg",
                    operator="le",
                    description="Foundation construction and habitat module placement grade.",
                    scientific_disclaimer="Derived from LOLA 5 m DEM."
                ),
            ),
        ),
        version=1,
        is_template=True,
        created_at_iso="2026-10-01T00:00:00Z",
        updated_at_iso="2026-10-01T00:00:00Z",
    ),
]

class MissionProfileService:
    def __init__(self, storage_path: Optional[Path] = None):
        self.storage_file = storage_path or STORAGE_FILE
        self._lock = threading.Lock()
        self._profiles: Dict[str, MissionProfile] = {}
        self._load_from_storage()

    def _load_from_storage(self):
        """Loads profiles from disk storage with atomic backup and corruption recovery."""
        with self._lock:
            if self.storage_file.exists():
                try:
                    with open(self.storage_file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    loaded = {}
                    for item in data:
                        rec = MissionProfile.model_validate(item)
                        if rec.id in loaded:
                            raise ValueError(f"Duplicate profile ID '{rec.id}' detected in storage.")
                        loaded[rec.id] = rec
                    if loaded:
                        # Synchronize built-in templates with latest definitions
                        tpl_map = {t.id: t for t in TEMPLATE_PROFILES}
                        for tid, tpl in tpl_map.items():
                            if tid in loaded and loaded[tid].is_template:
                                loaded[tid] = tpl
                        self._profiles = loaded
                        return
                except Exception as e:
                    print(f"[MissionProfileService] Failed to load {self.storage_file}: {e}")
                    try:
                        backup_file = self.storage_file.with_suffix(".corrupt.bak")
                        shutil.copy2(self.storage_file, backup_file)
                        print(f"[MissionProfileService] Quarantined storage to {backup_file}")
                    except Exception as copy_err:
                        print(f"[MissionProfileService] Failed to quarantine corrupt file: {copy_err}")

            # Initialize with starter templates
            self._profiles = {p.id: p for p in TEMPLATE_PROFILES}
            self._save_to_storage_unlocked()

    def _save_to_storage(self):
        """Persists all profiles atomically using temporary file + fsync + os.replace."""
        with self._lock:
            self._save_to_storage_unlocked()

    def _save_to_storage_unlocked(self):
        try:
            self.storage_file.parent.mkdir(parents=True, exist_ok=True)
            data = [p.model_dump() for p in self._profiles.values()]
            temp_dir = self.storage_file.parent
            with tempfile.NamedTemporaryFile("w", dir=temp_dir, delete=False, encoding="utf-8", suffix=".tmp") as tf:
                json.dump(data, tf, indent=2)
                tf.flush()
                os.fsync(tf.fileno())
                temp_path = Path(tf.name)

            os.replace(temp_path, self.storage_file)
        except Exception as e:
            print(f"[MissionProfileService] Warning: Failed to persist profiles to {self.storage_file}: {e}")
            if "temp_path" in locals() and temp_path.exists():
                try:
                    temp_path.unlink()
                except OSError:
                    pass

    def list_profiles(self) -> List[MissionProfile]:
        with self._lock:
            return list(self._profiles.values())

    def get_profile(self, profile_id: str) -> Optional[MissionProfile]:
        with self._lock:
            return self._profiles.get(profile_id)

    def validate_profile_parameters(
        self,
        name: str,
        duration_days: float,
        start_iso: str,
        end_iso: str,
        observer_height_m: float,
        requirements: Optional[MissionRequirementsSet] = None,
    ) -> MissionProfileValidationResponse:
        """
        Rigorously validates mission parameters, units, duration consistency,
        numerical ranges, and detects contradictory thresholds.
        """
        errors: List[ValidationFeedbackItem] = []
        warnings: List[ValidationFeedbackItem] = []
        info_notes: List[ValidationFeedbackItem] = []

        # 1. Name validation
        if not name or len(name.strip()) < 2:
            errors.append(ValidationFeedbackItem(
                field="name",
                message="Mission name must be at least 2 characters.",
                severity="ERROR"
            ))

        # 2. Time and Duration validation
        try:
            st = datetime.fromisoformat(start_iso.replace("Z", "+00:00"))
            et = datetime.fromisoformat(end_iso.replace("Z", "+00:00"))
            if et <= st:
                errors.append(ValidationFeedbackItem(
                    field="end_timestamp_iso",
                    message=f"End timestamp ({end_iso}) must be strictly after start timestamp ({start_iso}).",
                    severity="ERROR"
                ))
            calc_duration_days = (et - st).total_seconds() / 86400.0
            if abs(calc_duration_days - duration_days) > 0.05:
                warnings.append(ValidationFeedbackItem(
                    field="duration_days",
                    message=(
                        f"Specified duration ({duration_days:.2f} days) differs from the time interval between "
                        f"start and end timestamps ({calc_duration_days:.2f} days). System will use date span."
                    ),
                    severity="WARNING"
                ))
            total_mission_hours = calc_duration_days * 24.0
        except Exception as e:
            errors.append(ValidationFeedbackItem(
                field="start_timestamp_iso",
                message=f"Invalid ISO 8601 timestamp: {str(e)}",
                severity="ERROR"
            ))
            total_mission_hours = duration_days * 24.0

        if duration_days < 0.04:  # ~1 hour
            errors.append(ValidationFeedbackItem(
                field="duration_days",
                message="Mission duration must be at least 1 hour (0.04 days).",
                severity="ERROR"
            ))
        elif duration_days > 90.0:
            errors.append(ValidationFeedbackItem(
                field="duration_days",
                message="Mission duration exceeds maximum supported window of 90 days (DE421 ephemeris constraint).",
                severity="ERROR"
            ))

        # 3. Observer Height validation
        if not (0.0 <= observer_height_m <= 100.0):
            errors.append(ValidationFeedbackItem(
                field="observer_height_m",
                message=f"Observer height {observer_height_m} m is outside supported physical range [0.0, 100.0 m].",
                severity="ERROR"
            ))

        # 4. Requirements Validation
        if requirements:
            # --- Solar Requirements ---
            sol = requirements.solar
            # 1. Total Sunlight
            if sol.min_total_sunlight_hours.enabled:
                val = sol.min_total_sunlight_hours.value
                if val is None or val < 0.0:
                    errors.append(ValidationFeedbackItem(
                        field="solar.min_total_sunlight_hours",
                        message="Minimum total sunlight hours must be a non-negative number.",
                        severity="ERROR"
                    ))
                elif val > total_mission_hours:
                    errors.append(ValidationFeedbackItem(
                        field="solar.min_total_sunlight_hours",
                        message=(
                            f"Minimum total sunlight ({val:.1f} h) exceeds the total mission duration "
                            f"({total_mission_hours:.1f} h). Cannot exceed illumination analysis window."
                        ),
                        severity="ERROR"
                    ))
                if sol.min_total_sunlight_hours.unit != "hours":
                    errors.append(ValidationFeedbackItem(
                        field="solar.min_total_sunlight_hours.unit",
                        message=f"Invalid unit '{sol.min_total_sunlight_hours.unit}'. Expected 'hours'.",
                        severity="ERROR"
                    ))

            # 2. Full Sunlight
            # Note on subset relationship between full and total sunlight lower bounds:
            # Total sunlight = Full sunlight + Partial sunlight.
            # Both requirements represent minimum lower-bound thresholds, not measured durations.
            # E.g., min full sunlight = 10 h and min total sunlight = 8 h is logically feasible
            # because any lunar site satisfying >= 10 h of full sunlight automatically provides
            # >= 10 h of total geometric sunlight, thereby satisfying the >= 8 h total sunlight requirement.
            if sol.min_full_sunlight_hours.enabled:
                val_full = sol.min_full_sunlight_hours.value
                if val_full is None or val_full < 0.0:
                    errors.append(ValidationFeedbackItem(
                        field="solar.min_full_sunlight_hours",
                        message="Minimum full sunlight hours must be non-negative.",
                        severity="ERROR"
                    ))
                elif val_full > total_mission_hours:
                    errors.append(ValidationFeedbackItem(
                        field="solar.min_full_sunlight_hours",
                        message=(
                            f"Minimum full sunlight ({val_full:.1f} h) exceeds the total mission duration "
                            f"({total_mission_hours:.1f} h). Cannot exceed illumination analysis window."
                        ),
                        severity="ERROR"
                    ))
                if sol.min_full_sunlight_hours.unit != "hours":
                    errors.append(ValidationFeedbackItem(
                        field="solar.min_full_sunlight_hours.unit",
                        message=f"Invalid unit '{sol.min_full_sunlight_hours.unit}'. Expected 'hours'.",
                        severity="ERROR"
                    ))

                # Inform user of subset hierarchy without rejecting the configuration
                if (
                    sol.min_total_sunlight_hours.enabled
                    and val_full is not None
                    and sol.min_total_sunlight_hours.value is not None
                    and val_full > sol.min_total_sunlight_hours.value
                ):
                    info_notes.append(ValidationFeedbackItem(
                        field="solar.min_full_sunlight_hours",
                        message=(
                            f"Minimum full sunlight requirement ({val_full:.1f} h) is greater than minimum total "
                            f"sunlight requirement ({sol.min_total_sunlight_hours.value:.1f} h). Because full sunlight "
                            f"is a geometric subset of total sunlight, achieving full sunlight automatically satisfies total sunlight."
                        ),
                        severity="INFO"
                    ))

            # 3. Maximum Continuous Darkness
            if sol.max_continuous_darkness_hours.enabled:
                val_dark = sol.max_continuous_darkness_hours.value
                if val_dark is None or val_dark < 0.0:
                    errors.append(ValidationFeedbackItem(
                        field="solar.max_continuous_darkness_hours",
                        message="Maximum continuous darkness hours must be non-negative.",
                        severity="ERROR"
                    ))
                elif val_dark > total_mission_hours:
                    warnings.append(ValidationFeedbackItem(
                        field="solar.max_continuous_darkness_hours",
                        message=(
                            f"Maximum allowable darkness ({val_dark:.1f} h) exceeds total mission duration "
                            f"({total_mission_hours:.1f} h). This upper bound will trivially pass."
                        ),
                        severity="WARNING"
                    ))
                if sol.max_continuous_darkness_hours.unit != "hours":
                    errors.append(ValidationFeedbackItem(
                        field="solar.max_continuous_darkness_hours.unit",
                        message=f"Invalid unit '{sol.max_continuous_darkness_hours.unit}'. Expected 'hours'.",
                        severity="ERROR"
                    ))

            # 4. Minimum Sunlight Percentage
            if sol.min_sunlight_percentage.enabled:
                val_pct = sol.min_sunlight_percentage.value
                if val_pct is None or not (0.0 <= val_pct <= 100.0):
                    errors.append(ValidationFeedbackItem(
                        field="solar.min_sunlight_percentage",
                        message=f"Sunlight percentage must be between 0.0% and 100.0%. Got {val_pct}.",
                        severity="ERROR"
                    ))
                if sol.min_sunlight_percentage.unit != "%":
                    errors.append(ValidationFeedbackItem(
                        field="solar.min_sunlight_percentage.unit",
                        message=f"Invalid unit '{sol.min_sunlight_percentage.unit}'. Expected '%'.",
                        severity="ERROR"
                    ))

            # 5. Minimum Daily Sunlight
            # Evaluated per standard 24.0-hour Earth operational day (86,400 SI s, UTC calendar interval),
            # distinct from the ~708.7 h lunar synodic day.
            if sol.min_daily_sunlight_hours.enabled:
                val_daily = sol.min_daily_sunlight_hours.value
                if val_daily is None or val_daily < 0.0:
                    errors.append(ValidationFeedbackItem(
                        field="solar.min_daily_sunlight_hours",
                        message="Minimum daily sunlight hours must be non-negative.",
                        severity="ERROR"
                    ))
                elif val_daily > 24.0:
                    errors.append(ValidationFeedbackItem(
                        field="solar.min_daily_sunlight_hours",
                        message=(
                            f"Minimum daily sunlight ({val_daily:.1f} h/day) cannot exceed 24.0 hours "
                            f"in a standard Earth day."
                        ),
                        severity="ERROR"
                    ))
                if sol.min_daily_sunlight_hours.unit != "hours/day":
                    errors.append(ValidationFeedbackItem(
                        field="solar.min_daily_sunlight_hours.unit",
                        message=f"Invalid unit '{sol.min_daily_sunlight_hours.unit}'. Expected 'hours/day'.",
                        severity="ERROR"
                    ))

            # --- Earth Visibility Requirements ---
            earth = requirements.earth
            # 1. Total Earth Visibility
            if earth.min_total_earth_visible_hours.enabled:
                val_e = earth.min_total_earth_visible_hours.value
                if val_e is None or val_e < 0.0:
                    errors.append(ValidationFeedbackItem(
                        field="earth.min_total_earth_visible_hours",
                        message="Minimum total Earth visibility hours must be non-negative.",
                        severity="ERROR"
                    ))
                elif val_e > total_mission_hours:
                    errors.append(ValidationFeedbackItem(
                        field="earth.min_total_earth_visible_hours",
                        message=(
                            f"Minimum total Earth visibility ({val_e:.1f} h) exceeds mission duration "
                            f"({total_mission_hours:.1f} h). Cannot exceed illumination analysis window."
                        ),
                        severity="ERROR"
                    ))
                if earth.min_total_earth_visible_hours.unit != "hours":
                    errors.append(ValidationFeedbackItem(
                        field="earth.min_total_earth_visible_hours.unit",
                        message=f"Invalid unit '{earth.min_total_earth_visible_hours.unit}'. Expected 'hours'.",
                        severity="ERROR"
                    ))

            # 2. Maximum Continuous Blackout
            if earth.max_continuous_earth_blackout_hours.enabled:
                val_blk = earth.max_continuous_earth_blackout_hours.value
                if val_blk is None or val_blk < 0.0:
                    errors.append(ValidationFeedbackItem(
                        field="earth.max_continuous_earth_blackout_hours",
                        message="Maximum continuous Earth blackout hours must be non-negative.",
                        severity="ERROR"
                    ))
                elif val_blk > total_mission_hours:
                    warnings.append(ValidationFeedbackItem(
                        field="earth.max_continuous_earth_blackout_hours",
                        message=(
                            f"Maximum allowable Earth blackout ({val_blk:.1f} h) exceeds mission duration "
                            f"({total_mission_hours:.1f} h). This upper bound will trivially pass."
                        ),
                        severity="WARNING"
                    ))
                if earth.max_continuous_earth_blackout_hours.unit != "hours":
                    errors.append(ValidationFeedbackItem(
                        field="earth.max_continuous_earth_blackout_hours.unit",
                        message=f"Invalid unit '{earth.max_continuous_earth_blackout_hours.unit}'. Expected 'hours'.",
                        severity="ERROR"
                    ))

            # 3. Minimum Daily Earth Visibility
            # Evaluated per standard 24.0-hour Earth operational day.
            if earth.min_daily_earth_visible_hours.enabled:
                val_e_daily = earth.min_daily_earth_visible_hours.value
                if val_e_daily is None or val_e_daily < 0.0:
                    errors.append(ValidationFeedbackItem(
                        field="earth.min_daily_earth_visible_hours",
                        message="Minimum daily Earth visibility hours must be non-negative.",
                        severity="ERROR"
                    ))
                elif val_e_daily > 24.0:
                    errors.append(ValidationFeedbackItem(
                        field="earth.min_daily_earth_visible_hours",
                        message=(
                            f"Minimum daily Earth visibility ({val_e_daily:.1f} h/day) cannot exceed 24.0 hours "
                            f"in a standard Earth day."
                        ),
                        severity="ERROR"
                    ))
                if earth.min_daily_earth_visible_hours.unit != "hours/day":
                    errors.append(ValidationFeedbackItem(
                        field="earth.min_daily_earth_visible_hours.unit",
                        message=f"Invalid unit '{earth.min_daily_earth_visible_hours.unit}'. Expected 'hours/day'.",
                        severity="ERROR"
                    ))

            # 4. Full-Disk Earth Visibility
            # Full-disk Earth visibility is a geometric subset of total Earth visibility.
            # Both are minimum lower-bound requirements; requiring more full-disk Earth hours
            # than total Earth hours is logically consistent.
            if earth.min_full_disk_earth_visible_hours.enabled:
                val_e_full = earth.min_full_disk_earth_visible_hours.value
                if val_e_full is None or val_e_full < 0.0:
                    errors.append(ValidationFeedbackItem(
                        field="earth.min_full_disk_earth_visible_hours",
                        message="Minimum full-disk Earth visibility hours must be non-negative.",
                        severity="ERROR"
                    ))
                elif val_e_full > total_mission_hours:
                    errors.append(ValidationFeedbackItem(
                        field="earth.min_full_disk_earth_visible_hours",
                        message=(
                            f"Minimum full-disk Earth visibility ({val_e_full:.1f} h) exceeds mission duration "
                            f"({total_mission_hours:.1f} h). Cannot exceed illumination analysis window."
                        ),
                        severity="ERROR"
                    ))
                if earth.min_full_disk_earth_visible_hours.unit != "hours":
                    errors.append(ValidationFeedbackItem(
                        field="earth.min_full_disk_earth_visible_hours.unit",
                        message=f"Invalid unit '{earth.min_full_disk_earth_visible_hours.unit}'. Expected 'hours'.",
                        severity="ERROR"
                    ))

                # Inform user of subset hierarchy without rejecting
                if (
                    earth.min_total_earth_visible_hours.enabled
                    and val_e_full is not None
                    and earth.min_total_earth_visible_hours.value is not None
                    and val_e_full > earth.min_total_earth_visible_hours.value
                ):
                    info_notes.append(ValidationFeedbackItem(
                        field="earth.min_full_disk_earth_visible_hours",
                        message=(
                            f"Full-disk Earth visibility requirement ({val_e_full:.1f} h) is greater than total "
                            f"Earth visibility requirement ({earth.min_total_earth_visible_hours.value:.1f} h). "
                            f"Achieving full-disk clearance automatically satisfies total visibility."
                        ),
                        severity="INFO"
                    ))

            # --- Terrain Requirements ---
            trn = requirements.terrain
            # 1. Slope
            if trn.max_local_slope_deg.enabled:
                val_slp = trn.max_local_slope_deg.value
                if val_slp is None or not (0.0 <= val_slp <= 90.0):
                    errors.append(ValidationFeedbackItem(
                        field="terrain.max_local_slope_deg",
                        message=f"Maximum slope must be between 0.0° and 90.0°. Got {val_slp}.",
                        severity="ERROR"
                    ))
                if trn.max_local_slope_deg.unit != "deg":
                    errors.append(ValidationFeedbackItem(
                        field="terrain.max_local_slope_deg.unit",
                        message=f"Invalid unit '{trn.max_local_slope_deg.unit}'. Expected 'deg'.",
                        severity="ERROR"
                    ))

            # 2. Elevation units
            if trn.min_elevation_m.enabled:
                if trn.min_elevation_m.unit != "m":
                    errors.append(ValidationFeedbackItem(
                        field="terrain.min_elevation_m.unit",
                        message=f"Invalid unit '{trn.min_elevation_m.unit}'. Expected 'm'.",
                        severity="ERROR"
                    ))
            if trn.max_elevation_m.enabled:
                if trn.max_elevation_m.unit != "m":
                    errors.append(ValidationFeedbackItem(
                        field="terrain.max_elevation_m.unit",
                        message=f"Invalid unit '{trn.max_elevation_m.unit}'. Expected 'm'.",
                        severity="ERROR"
                    ))

            # Genuine Contradiction: Lower bound > Upper bound on surface elevation
            if trn.min_elevation_m.enabled and trn.max_elevation_m.enabled:
                min_el = trn.min_elevation_m.value
                max_el = trn.max_elevation_m.value
                if min_el is not None and max_el is not None and min_el > max_el:
                    errors.append(ValidationFeedbackItem(
                        field="terrain.min_elevation_m",
                        message=(
                            f"Minimum elevation ({min_el} m) cannot exceed maximum elevation ({max_el} m). "
                            f"Lower bound exceeds upper bound for the same physical property."
                        ),
                        severity="ERROR"
                    ))

            # 3. Roughness
            if trn.max_roughness_factor.enabled:
                val_r = trn.max_roughness_factor.value
                if val_r is None or val_r < 0.0:
                    errors.append(ValidationFeedbackItem(
                        field="terrain.max_roughness_factor",
                        message="Maximum roughness factor must be non-negative.",
                        severity="ERROR"
                    ))
                if trn.max_roughness_factor.unit != "deg_std":
                    errors.append(ValidationFeedbackItem(
                        field="terrain.max_roughness_factor.unit",
                        message=f"Invalid unit '{trn.max_roughness_factor.unit}'. Expected 'deg_std'.",
                        severity="ERROR"
                    ))

            # Scientific Note on Soft Preferences:
            # Soft preferences are stored, validated, and classified distinctly. No arbitrary
            # or unweighted scoring heuristic is applied to soft preferences at this stage;
            # multi-criteria ranking in MVP 7.2 requires explicit user-configured weights
            # and transparent normalization.

        # Scientific disclaimers and guidance
        info_notes.append(ValidationFeedbackItem(
            field="general",
            message="Geometric line-of-sight metrics do not replace physical RF link budgets or solar electrical models.",
            severity="INFO"
        ))

        return MissionProfileValidationResponse(
            is_valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            info_notes=info_notes,
        )

    def validate_profile_request(self, req: MissionProfileValidationRequest) -> MissionProfileValidationResponse:
        """Helper to validate incoming draft payload from UI or tests."""
        name = req.name or ""
        duration_days = req.duration_days if req.duration_days is not None else 7.0
        start_iso = req.start_timestamp_iso or "2026-10-04T12:00:00Z"
        end_iso = req.end_timestamp_iso or "2026-10-11T12:00:00Z"
        observer_height_m = req.observer_height_m if req.observer_height_m is not None else 2.0

        reqs = None
        if req.requirements is not None:
            if isinstance(req.requirements, MissionRequirementsSet):
                reqs = req.requirements
            elif isinstance(req.requirements, dict):
                try:
                    reqs = MissionRequirementsSet.model_validate(req.requirements)
                except Exception as e:
                    return MissionProfileValidationResponse(
                        is_valid=False,
                        errors=[ValidationFeedbackItem(
                            field="requirements",
                            message=f"Requirements format error: {str(e)}",
                            severity="ERROR"
                        )],
                        warnings=[],
                        info_notes=[],
                    )

        return self.validate_profile_parameters(
            name=name,
            duration_days=duration_days,
            start_iso=start_iso,
            end_iso=end_iso,
            observer_height_m=observer_height_m,
            requirements=reqs,
        )

    def create_profile(self, req: MissionProfileCreateRequest) -> MissionProfile:
        reqs = None
        if req.requirements is not None:
            if isinstance(req.requirements, MissionRequirementsSet):
                reqs = req.requirements
            elif isinstance(req.requirements, dict):
                reqs = MissionRequirementsSet.model_validate(req.requirements)
        if reqs is None:
            reqs = MissionRequirementsSet()

        val_res = self.validate_profile_parameters(
            name=req.name,
            duration_days=req.duration_days,
            start_iso=req.start_timestamp_iso,
            end_iso=req.end_timestamp_iso,
            observer_height_m=req.observer_height_m,
            requirements=reqs,
        )
        if not val_res.is_valid:
            err_msgs = [e.message for e in val_res.errors]
            raise ValueError("; ".join(err_msgs))

        with self._lock:
            profile_id = f"profile-{uuid.uuid4().hex[:8]}"
            while profile_id in self._profiles:
                profile_id = f"profile-{uuid.uuid4().hex[:8]}"

            now_iso = datetime.now(timezone.utc).isoformat()

            profile = MissionProfile(
                id=profile_id,
                name=req.name.strip(),
                description=req.description or "",
                mission_type=req.mission_type,
                duration_days=req.duration_days,
                start_timestamp_iso=req.start_timestamp_iso,
                end_timestamp_iso=req.end_timestamp_iso,
                observer_height_m=req.observer_height_m,
                time_display_preference=req.time_display_preference,
                requirements=reqs,
                version=1,
                is_template=False,
                created_at_iso=now_iso,
                updated_at_iso=now_iso,
            )
            self._profiles[profile_id] = profile
            self._save_to_storage_unlocked()
            return profile

    def update_profile(self, profile_id: str, req: MissionProfileUpdateRequest) -> MissionProfile:
        with self._lock:
            if profile_id not in self._profiles:
                raise KeyError(f"Mission profile '{profile_id}' not found.")

            current = self._profiles[profile_id]
            new_name = req.name.strip() if req.name is not None else current.name
            new_dur = req.duration_days if req.duration_days is not None else current.duration_days
            new_st = req.start_timestamp_iso if req.start_timestamp_iso is not None else current.start_timestamp_iso
            new_et = req.end_timestamp_iso if req.end_timestamp_iso is not None else current.end_timestamp_iso
            new_h = req.observer_height_m if req.observer_height_m is not None else current.observer_height_m
            new_reqs = req.requirements if req.requirements is not None else current.requirements

            val_res = self.validate_profile_parameters(
                name=new_name,
                duration_days=new_dur,
                start_iso=new_st,
                end_iso=new_et,
                observer_height_m=new_h,
                requirements=new_reqs,
            )
            if not val_res.is_valid:
                err_msgs = [e.message for e in val_res.errors]
                raise ValueError("; ".join(err_msgs))

            now_iso = datetime.now(timezone.utc).isoformat()
            updated = MissionProfile(
                id=current.id,
                name=new_name,
                description=req.description if req.description is not None else current.description,
                mission_type=req.mission_type if req.mission_type is not None else current.mission_type,
                duration_days=new_dur,
                start_timestamp_iso=new_st,
                end_timestamp_iso=new_et,
                observer_height_m=new_h,
                time_display_preference=req.time_display_preference if req.time_display_preference is not None else current.time_display_preference,
                requirements=new_reqs,
                version=current.version + 1,
                is_template=False,  # Custom user edits are no longer pure templates
                created_at_iso=current.created_at_iso,
                updated_at_iso=now_iso,
            )
            self._profiles[profile_id] = updated
            self._save_to_storage_unlocked()
            return updated

    def duplicate_profile(self, profile_id: str) -> MissionProfile:
        with self._lock:
            if profile_id not in self._profiles:
                raise KeyError(f"Mission profile '{profile_id}' not found.")

            source = self._profiles[profile_id]
            new_id = f"profile-{uuid.uuid4().hex[:8]}"
            while new_id in self._profiles:
                new_id = f"profile-{uuid.uuid4().hex[:8]}"

            now_iso = datetime.now(timezone.utc).isoformat()
            duplicated = MissionProfile(
                id=new_id,
                name=f"{source.name} (Copy)",
                description=source.description,
                mission_type=source.mission_type,
                duration_days=source.duration_days,
                start_timestamp_iso=source.start_timestamp_iso,
                end_timestamp_iso=source.end_timestamp_iso,
                observer_height_m=source.observer_height_m,
                time_display_preference=source.time_display_preference,
                requirements=source.requirements.model_copy(deep=True),
                version=1,
                is_template=False,
                created_at_iso=now_iso,
                updated_at_iso=now_iso,
            )
            self._profiles[new_id] = duplicated
            self._save_to_storage_unlocked()
            return duplicated

    def delete_profile(self, profile_id: str) -> bool:
        with self._lock:
            if profile_id not in self._profiles:
                raise KeyError(f"Mission profile '{profile_id}' not found.")
            del self._profiles[profile_id]
            self._save_to_storage_unlocked()
            return True

    def reset_to_templates(self) -> List[MissionProfile]:
        """Resets or appends missing built-in templates."""
        with self._lock:
            for t in TEMPLATE_PROFILES:
                if t.id not in self._profiles:
                    self._profiles[t.id] = t
            self._save_to_storage_unlocked()
            return list(self._profiles.values())

mission_profile_service = MissionProfileService()
