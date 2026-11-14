import {
  SolarMetrics,
  EarthMetrics,
  CombinedMetrics,
  VisibilityTimeSeriesPoint,
  VisibilityTransitionPoint,
} from './visibility';

export interface ScenarioRecord {
  id: string;
  name: string;
  description: string;
  site_id: string;
  latitude: number;
  longitude: number;
  observer_height_m: number;
  start_timestamp_iso: string;
  end_timestamp_iso: string;
  step_interval_hours: number;
  azimuth_resolution_deg: number;
  max_search_distance_m: number;
  aberration_correction: string;
  created_at_iso: string;
  updated_at_iso: string;
}

export interface ScenarioCreateRequest {
  name: string;
  description?: string;
  site_id: string;
  latitude: number;
  longitude: number;
  observer_height_m?: number;
  start_timestamp_iso: string;
  end_timestamp_iso: string;
  step_interval_hours?: number;
  azimuth_resolution_deg?: number;
  max_search_distance_m?: number;
  aberration_correction?: string;
}

export interface ScenarioUpdateRequest {
  name?: string;
  description?: string;
  site_id?: string;
  latitude?: number;
  longitude?: number;
  observer_height_m?: number;
  start_timestamp_iso?: string;
  end_timestamp_iso?: string;
  step_interval_hours?: number;
  azimuth_resolution_deg?: number;
  max_search_distance_m?: number;
  aberration_correction?: string;
}

export interface MissionConstraints {
  min_sunlight_hours?: number;
  min_sunlight_pct?: number;
  max_darkness_hours?: number;
  min_earth_visible_hours?: number;
  min_earth_visible_pct?: number;
  max_earth_blackout_hours?: number;
  max_allowable_slope_deg?: number;
}

export type ConstraintStatus = 'PASSED' | 'FAILED' | 'INDETERMINATE';

export interface ConstraintResult {
  constraint_id: string;
  constraint_name: string;
  required_criterion: string;
  actual_value_str: string;
  status: ConstraintStatus;
  explanation: string;
}

export interface ScenarioTerrainMetrics {
  observer_surface_elevation_m: number;
  observer_height_m: number;
  total_observer_elevation_m: number;
  local_slope_deg?: number;
  elevation_min_m: float;
  elevation_max_m: float;
  elevation_mean_m: float;
  dem_coverage_status: string;
  dem_nominal_spacing_m: number;
  effective_resolution_note: string;
  lola_laser_count?: number;
  vertical_uncertainty_m?: number;
  slope_uncertainty_deg?: number;
  dataset_citation: string;
}

type float = number;

export interface ScenarioComparisonResult {
  scenario: ScenarioRecord;
  terrain: ScenarioTerrainMetrics;
  solar: SolarMetrics;
  earth: EarthMetrics;
  combined: CombinedMetrics;
  timeline: VisibilityTimeSeriesPoint[];
  transitions: VisibilityTransitionPoint[];
  constraints: ConstraintResult[];
  passed_constraints_count: number;
  failed_constraints_count: number;
  indeterminate_constraints_count: number;
  warnings: string[];
  configuration_differences: string[];
}

export interface ScenarioRankingItem {
  rank: number;
  scenario_id: string;
  scenario_name: string;
  passed_count: number;
  total_count: number;
  compliance_score_pct: number;
  dominant_tradeoff: string;
}

export interface MultiScenarioComparisonRequest {
  scenario_ids: string[];
  enforce_harmonized_time?: boolean;
  override_start_iso?: string;
  override_duration_days?: number;
  override_step_hours?: number;
  constraints?: MissionConstraints;
}

export interface MultiScenarioComparisonResponse {
  comparison_id: string;
  timestamp_iso: string;
  is_harmonized: boolean;
  harmonization_notes: string[];
  scenarios: ScenarioComparisonResult[];
  ranking_summary: ScenarioRankingItem[];
  scientific_caveats: string[];
  provenance: Record<string, any>;
}

export interface ScenarioExportRequest {
  comparison_response: MultiScenarioComparisonResponse;
  format: 'json' | 'csv';
}
