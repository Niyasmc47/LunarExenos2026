import { MissionProfile, RequirementClassification } from './missionProfile';
import { ScenarioRecord } from './scenario';
import { ScreeningVerdict, DataCoverageStatus } from './screening';

export type TerrainSuitabilityStatus = 'COMPLIANT' | 'NON_COMPLIANT' | 'INDETERMINATE';

export interface ElevationAssessmentMetrics {
  point_elevation_m?: number | null;
  min_elevation_m?: number | null;
  max_elevation_m?: number | null;
  elevation_range_m?: number | null;
  mean_elevation_m?: number | null;
  std_elevation_m?: number | null;
  elevation_datum: string;
  elevation_units: string;
  datum_note: string;
}

export interface SlopeAssessmentMetrics {
  point_slope_deg?: number | null;
  min_slope_deg?: number | null;
  max_slope_deg?: number | null;
  mean_slope_deg?: number | null;
  median_slope_deg?: number | null;
  std_slope_deg?: number | null;
  slope_source: string;
  slope_distribution: Record<string, number>;
  exceedance_percentage?: number | null;
  slope_units: string;
}

export interface RoughnessAssessmentMetrics {
  status: string;
  is_supported: boolean;
  scientific_justification: string;
  measured_value?: number | null;
  unit: string;
  derived_slope_std_deg?: number | null;
}

export interface FootprintDataQuality {
  coverage_status: DataCoverageStatus;
  coverage_certainty?: string;
  assessment_mode?: string;
  requested_radius_m: number;
  nominal_grid_spacing_m: number;
  effective_resolution_note: string;
  total_pixels_in_footprint: number;
  valid_pixels_in_footprint: number;
  nodata_pixels_in_footprint: number;
  valid_data_percentage: number;
  evaluated_area_m2: number;
  coverage_warnings: string[];
}

export interface EvaluatedTerrainRequirement {
  requirement_id: string;
  requirement_name: string;
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
}

export interface CandidateTerrainAssessment {
  candidate_id: string;
  candidate_name: string;
  site_id: string;
  latitude: number;
  longitude: number;
  projected_x?: number | null;
  projected_y?: number | null;
  overall_status: TerrainSuitabilityStatus;
  hard_constraints_passed: number;
  hard_constraints_failed: number;
  hard_constraints_indeterminate: number;
  total_hard_constraints: number;
  elevation_metrics: ElevationAssessmentMetrics;
  slope_metrics: SlopeAssessmentMetrics;
  roughness_metrics: RoughnessAssessmentMetrics;
  data_quality: FootprintDataQuality;
  hard_constraint_results: EvaluatedTerrainRequirement[];
  soft_preference_results: EvaluatedTerrainRequirement[];
  informational_metrics: EvaluatedTerrainRequirement[];
  scientific_disclaimers: string[];
  warnings: string[];
}

export interface TerrainAssessmentRequest {
  profile_id: string;
  scenario_ids: string[];
  assessment_radius_m: number;
  override_dataset_id?: string | null;
  name?: string | null;
}

export interface TerrainAssessmentRecord {
  id: string;
  name: string;
  created_at_iso: string;
  profile_id: string;
  profile_name: string;
  profile_version: number;
  profile_snapshot: MissionProfile;
  scenario_snapshots: ScenarioRecord[];
  assessment_radius_m: number;
  dataset_metadata: Record<string, any>;
  calculation_method: string;
  total_candidates_evaluated: number;
  compliant_candidates_count: number;
  non_compliant_candidates_count: number;
  indeterminate_candidates_count: number;
  candidates: CandidateTerrainAssessment[];
  scientific_disclaimers: string[];
  warnings: string[];
}

export interface TerrainAssessmentResponse {
  assessment: TerrainAssessmentRecord;
}
