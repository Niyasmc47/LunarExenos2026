import { MissionProfile, RequirementClassification } from './missionProfile';

export type ScreeningVerdict = 'PASS' | 'FAIL' | 'INDETERMINATE';

export type OverallCandidateStatus = 'COMPLIANT' | 'NON_COMPLIANT' | 'INDETERMINATE';

export type DataCoverageStatus = 'COMPLETE' | 'PARTIAL' | 'UNAVAILABLE' | 'INCOMPATIBLE';

export interface RequirementEvaluationResult {
  requirement_id: string;
  requirement_name: string;
  category: 'solar' | 'earth' | 'terrain' | string;
  classification: RequirementClassification;
  operator: string;
  threshold_value?: number | null;
  threshold_str: string;
  actual_value?: number | null;
  actual_value_str: string;
  unit: string;
  verdict: ScreeningVerdict;
  explanation: string;
  supporting_data_source: string;
  analysis_period: string;
}

export interface SoftPreferenceItem {
  requirement_id: string;
  requirement_name: string;
  category: string;
  operator: string;
  threshold_value?: number | null;
  threshold_str: string;
  actual_value?: number | null;
  actual_value_str: string;
  unit: string;
  is_available: boolean;
  notes: string;
}

export interface InformationalMetricItem {
  id: string;
  name: string;
  category: string;
  value: any;
  value_str: string;
  unit?: string | null;
  source: string;
}

export interface CandidateScreeningSummary {
  candidate_id: string;
  candidate_name: string;
  site_id: string;
  latitude: number;
  longitude: number;
  observer_height_m: number;
  surface_elevation_m?: number | null;
  local_slope_deg?: number | null;
  overall_status: OverallCandidateStatus;
  hard_constraints_passed: number;
  hard_constraints_failed: number;
  hard_constraints_indeterminate: number;
  total_hard_constraints: number;
  hard_constraint_results: RequirementEvaluationResult[];
  soft_preference_results: SoftPreferenceItem[];
  informational_metrics: InformationalMetricItem[];
  coverage_status: DataCoverageStatus;
  coverage_certainty: string;
  valid_ray_count: number;
  total_ray_count: number;
  dem_provenance: Record<string, any>;
  spice_provenance: Record<string, any>;
  warnings: string[];
  scientific_disclaimers: string[];
}

export interface ScreeningRunRecord {
  id: string;
  name: string;
  created_at_iso: string;
  profile_id: string;
  profile_name: string;
  profile_version: number;
  profile_snapshot: MissionProfile;
  start_timestamp_iso: string;
  end_timestamp_iso: string;
  duration_days: number;
  observer_height_m: number;
  calculation_config: Record<string, any>;
  candidates: CandidateScreeningSummary[];
  overall_summary: {
    total_candidates: number;
    compliant_candidates: number;
    non_compliant_candidates: number;
    indeterminate_candidates: number;
  };
}

export interface CandidateScreeningRequest {
  profile_id: string;
  scenario_ids: string[];
  override_start_iso?: string | null;
  override_end_iso?: string | null;
  override_duration_days?: number | null;
  override_observer_height_m?: number | null;
  step_interval_hours?: number;
  azimuth_resolution_deg?: number;
  max_search_distance_m?: number;
  aberration_correction?: string;
  name?: string | null;
}

export interface CandidateScreeningResponse {
  run: ScreeningRunRecord;
}
