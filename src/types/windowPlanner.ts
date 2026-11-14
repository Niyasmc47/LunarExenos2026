import { MissionProfile } from './missionProfile';
import {
  RequirementEvaluationResult,
  SoftPreferenceItem,
  InformationalMetricItem,
  DataCoverageStatus,
} from './screening';

export type WindowClassification = 'COMPLIANT' | 'NON_COMPLIANT' | 'INDETERMINATE';

export interface WindowSolarSummary {
  total_sunlight_hours: number;
  full_sunlight_hours: number;
  partial_sunlight_hours: number;
  darkness_hours: number;
  longest_darkness_hours: number;
  illumination_percentage: number;
  min_daily_sunlight_hours: number;
  sunrise_transitions: number;
  sunset_transitions: number;
}

export interface WindowEarthSummary {
  total_earth_visible_hours: number;
  full_disk_earth_visible_hours: number;
  partial_earth_visible_hours: number;
  earth_blackout_hours: number;
  longest_earth_blackout_hours: number;
  earth_visibility_percentage: number;
  min_daily_earth_visible_hours: number;
  earthrise_transitions: number;
  earthset_transitions: number;
}

export interface EvaluatedMissionWindow {
  window_id: string;
  window_index: number;
  start_timestamp_iso: string;
  end_timestamp_iso: string;
  duration_days: number;
  duration_hours: number;
  classification: WindowClassification;
  hard_constraints_passed: number;
  hard_constraints_failed: number;
  hard_constraints_indeterminate: number;
  total_hard_constraints: number;
  solar_summary: WindowSolarSummary;
  earth_summary: WindowEarthSummary;
  surface_elevation_m?: number | null;
  local_slope_deg?: number | null;
  hard_constraint_results: RequirementEvaluationResult[];
  soft_preference_results: SoftPreferenceItem[];
  informational_metrics: InformationalMetricItem[];
  coverage_status: DataCoverageStatus;
  coverage_certainty: string;
  warnings: string[];
}

export interface MissionWindowSearchRequest {
  profile_id: string;
  scenario_id: string;
  search_start_iso: string;
  search_end_iso: string;
  mission_duration_days: number;
  search_step_hours: number;
  analysis_step_hours: number;
  override_observer_height_m?: number | null;
  azimuth_resolution_deg?: number;
  max_search_distance_m?: number;
  name?: string | null;
}

export interface WindowComparisonItem {
  window_id: string;
  start_timestamp_iso: string;
  end_timestamp_iso: string;
  classification: WindowClassification;
  total_sunlight_hours: number;
  full_sunlight_hours: number;
  longest_darkness_hours: number;
  illumination_percentage: number;
  total_earth_visible_hours: number;
  longest_earth_blackout_hours: number;
  hard_constraints_passed: number;
  hard_constraints_failed: number;
  hard_constraints_indeterminate: number;
  differences_from_reference: string[];
}

export interface WindowComparisonResponse {
  search_id: string;
  reference_window_id: string;
  compared_windows: WindowComparisonItem[];
  is_fully_consistent: boolean;
  consistency_notes: string[];
}

export interface MissionWindowSearchRecord {
  id: string;
  name: string;
  created_at_iso: string;
  profile_id: string;
  profile_name: string;
  profile_version: number;
  profile_snapshot: MissionProfile;
  scenario_id: string;
  scenario_name: string;
  site_id: string;
  latitude: number;
  longitude: number;
  observer_height_m: number;
  search_start_iso: string;
  search_end_iso: string;
  search_span_days: number;
  mission_duration_days: number;
  mission_duration_hours: number;
  search_step_hours: number;
  analysis_step_hours: number;
  total_windows_evaluated: number;
  compliant_windows_count: number;
  non_compliant_windows_count: number;
  indeterminate_windows_count: number;
  windows: EvaluatedMissionWindow[];
  dem_provenance: Record<string, any>;
  spice_provenance: Record<string, any>;
  scientific_disclaimers: string[];
  warnings: string[];
}

export interface MissionWindowSearchResponse {
  search: MissionWindowSearchRecord;
}
