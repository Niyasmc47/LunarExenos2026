import { HorizonPoint, HorizonSummary } from './horizon';

export type VisibilityState =
  | 'FULLY_VISIBLE'
  | 'PARTIALLY_VISIBLE'
  | 'FULLY_OBSTRUCTED'
  | 'INDETERMINATE';

export type CoverageCertainty =
  | 'CONFIRMED_EVALUATED'
  | 'INDETERMINATE_PARTIAL_DEM';

export type CombinedVisibilityState =
  | 'SUN_AND_EARTH_VISIBLE'
  | 'SUN_VISIBLE_ONLY'
  | 'EARTH_VISIBLE_ONLY'
  | 'NEITHER_VISIBLE'
  | 'PARTIAL_DUAL_VISIBILITY'
  | 'INDETERMINATE';

export interface CelestialDiskVisibility {
  body_name: string;
  azimuth_deg: number;
  elevation_deg: number;
  angular_diameter_deg: number;
  angular_radius_deg: number;
  distance_km: number;
  horizon_elevation_at_azimuth_deg: number;
  upper_limb_elevation_deg: number;
  lower_limb_elevation_deg: number;
  upper_limb_clearance_deg: number;
  lower_limb_clearance_deg: number;
  visible_fraction: number;
  visible_percentage: number;
  visibility_state: VisibilityState;
  coverage_certainty: CoverageCertainty;
  light_time_seconds: number;
  calculation_method: string;
}

export interface VisibilityInstantRequest {
  latitude: number;
  longitude: number;
  timestamp_iso: string;
  observer_height_m?: number;
  dataset_id?: string;
  azimuth_resolution_deg?: number;
  max_search_distance_m?: number;
  aberration_correction?: string;
}

export interface VisibilityInstantResponse {
  latitude: number;
  longitude: number;
  observer_surface_elevation_m: number;
  observer_height_m: number;
  total_observer_elevation_m: number;
  timestamp_iso: string;
  ephemeris_time_tdb: number;
  sun: CelestialDiskVisibility;
  earth: CelestialDiskVisibility;
  combined_state: CombinedVisibilityState;
  terrain_horizon_summary: HorizonSummary;
  horizon_profile: HorizonPoint[];
  warnings: string[];
  provenance: Record<string, any>;
}

export interface VisibilityTransitionPoint {
  transition_type: string;
  timestamp_iso: string;
  ephemeris_time_tdb: number;
  azimuth_deg: number;
  elevation_deg: number;
  visible_fraction: number;
  convergence_tolerance_seconds: number;
}

export interface VisibilityTimeSeriesPoint {
  timestamp_iso: string;
  ephemeris_time_tdb: number;
  sun_azimuth_deg: number;
  sun_elevation_deg: number;
  sun_visible_fraction: number;
  sun_visibility_state: VisibilityState;
  earth_azimuth_deg: number;
  earth_elevation_deg: number;
  earth_visible_fraction: number;
  earth_visibility_state: VisibilityState;
  combined_state: CombinedVisibilityState;
  terrain_elevation_sun_az_deg: number;
  terrain_elevation_earth_az_deg: number;
}

export interface SolarMetrics {
  total_sun_visible_hours: number;
  total_sun_full_hours: number;
  total_sun_partial_hours: number;
  total_darkness_hours: number;
  longest_darkness_hours: number;
  longest_darkness_start_iso: string | null;
  longest_darkness_end_iso: string | null;
  longest_illumination_hours: number;
  illumination_fraction: number;
  sunrise_count: number;
  sunset_count: number;
  max_sun_elevation_deg: number;
  min_sun_elevation_deg: number;
}

export interface EarthMetrics {
  total_earth_visible_hours: number;
  total_earth_full_hours: number;
  total_earth_partial_hours: number;
  total_earth_blackout_hours: number;
  longest_earth_blackout_hours: number;
  longest_earth_blackout_start_iso: string | null;
  longest_earth_blackout_end_iso: string | null;
  longest_earth_visible_hours: number;
  earth_visibility_fraction: number;
  earthrise_count: number;
  earthset_count: number;
  max_earth_elevation_deg: number;
  min_earth_elevation_deg: number;
}

export interface CombinedMetrics {
  both_visible_hours: number;
  sun_only_hours: number;
  earth_only_hours: number;
  neither_visible_hours: number;
  longest_both_visible_hours: number;
  longest_neither_visible_hours: number;
  total_interval_hours: number;
}

export interface VisibilityAnalysisRequest {
  latitude: number;
  longitude: number;
  start_timestamp_iso: string;
  end_timestamp_iso: string;
  step_interval_hours?: number;
  observer_height_m?: number;
  dataset_id?: string;
  azimuth_resolution_deg?: number;
  max_search_distance_m?: number;
  aberration_correction?: string;
}

export interface VisibilityAnalysisResponse {
  latitude: number;
  longitude: number;
  observer_surface_elevation_m: number;
  observer_height_m: number;
  start_timestamp_iso: string;
  end_timestamp_iso: string;
  step_interval_hours: number;
  total_epochs_computed: number;
  series: VisibilityTimeSeriesPoint[];
  transitions: VisibilityTransitionPoint[];
  solar_metrics: SolarMetrics;
  earth_metrics: EarthMetrics;
  combined_metrics: CombinedMetrics;
  terrain_horizon_summary: HorizonSummary;
  horizon_profile: HorizonPoint[];
  warnings: string[];
  provenance: Record<string, any>;
}
