import { MissionProfile } from './missionProfile';
import { OverallCandidateStatus, RequirementEvaluationResult } from './screening';
import { TerrainSuitabilityStatus } from './terrainAssessment';

export type PreferenceDirection = 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER' | 'TARGET_RANGE';
export type NormalizationMethod = 'MIN_MAX' | 'TARGET_RANGE';
export type ParetoDominanceStatus = 'PARETO_OPTIMAL' | 'DOMINATED' | 'INCOMPARABLE_INCOMPLETE';

export interface PreferenceCriterionConfig {
  id: string;
  name: string;
  metric_key: string;
  unit: string;
  category: 'solar' | 'earth' | 'terrain';
  enabled: boolean;
  weight: number;
  direction: PreferenceDirection;
  normalization_method: NormalizationMethod;
  reference_min?: number | null;
  reference_max?: number | null;
  target_min?: number | null;
  target_max?: number | null;
  is_relative_to_alternatives?: boolean;
  description: string;
}

export interface PreferenceModelConfig {
  criteria: PreferenceCriterionConfig[];
  use_relative_bounds: boolean;
  version: string;
}

export interface MissionAlternativeInput {
  name: string;
  description?: string | null;
  notes?: string | null;
  scenario_id: string;
  window_search_id?: string | null;
  window_id?: string | null;
  terrain_assessment_id?: string | null;
  screening_run_id?: string | null;
}

export interface MissionAlternativeRecord {
  id: string;
  name: string;
  description?: string | null;
  notes?: string | null;
  candidate_id: string;
  candidate_name: string;
  site_id: string;
  latitude: number;
  longitude: number;
  start_timestamp_iso: string;
  end_timestamp_iso: string;
  duration_days: number;
  duration_hours: number;
  profile_id: string;
  profile_version: number;
  profile_snapshot: MissionProfile;
  source_screening_id?: string | null;
  source_window_id?: string | null;
  source_terrain_assessment_id?: string | null;
  hard_constraint_status: OverallCandidateStatus;
  terrain_suitability_status?: TerrainSuitabilityStatus | null;
  hard_constraints_passed: number;
  hard_constraints_failed: number;
  hard_constraints_indeterminate: number;
  total_hard_constraints: number;
  extracted_metrics: Record<string, number | null>;
  hard_constraint_verdicts: RequirementEvaluationResult[];
  missing_metrics: string[];
  data_completeness_pct: number;
  provenance: Record<string, any>;
  warnings: string[];
}

export interface AlternativeNormalizedMetric {
  criterion_id: string;
  criterion_name: string;
  raw_value?: number | null;
  unit: string;
  direction: PreferenceDirection;
  reference_min: number;
  reference_max: number;
  normalized_value?: number | null;
  normalized_weight: number;
  score_contribution?: number | null;
  formula_str: string;
  is_available: boolean;
  note?: string | null;
}

export interface AlternativeScoreBreakdown {
  alternative_id: string;
  alternative_name: string;
  composite_score: number;
  score_status: 'COMPLETE' | 'INCOMPLETE';
  available_weight_fraction: number;
  ranking_eligibility: 'ELIGIBLE' | 'INELIGIBLE_NON_COMPLIANT' | 'INELIGIBLE_INDETERMINATE' | 'INELIGIBLE_INCOMPLETE_SCORE';
  eligible_rank?: number | null;
  ineligibility_reason?: string | null;
  normalized_metrics: AlternativeNormalizedMetric[];
  explanation: string;
  limitations: string[];
}

export interface AlternativeParetoResult {
  alternative_id: string;
  status: ParetoDominanceStatus;
  dominated_by: string[];
  dominates: string[];
  dominating_criteria_by_alternative?: Record<string, string[]>;
  is_fully_comparable?: boolean;
  explanation: string;
}

export interface SensitivityScenarioResult {
  scenario_id: string;
  scenario_name: string;
  scenario_description: string;
  is_available: boolean;
  warning?: string | null;
  weights: Record<string, number>;
  scores: Record<string, number>;
  rankings: Record<string, number>;
  eligible_rankings?: Record<string, number | null>;
  ineligibility_reasons?: Record<string, string>;
  leading_alternative_id?: string | null;
  leading_alternative_name?: string | null;
}

export interface SensitivityAnalysisResponse {
  study_id: string;
  current_leader_id?: string | null;
  has_eligible_leader?: boolean;
  tested_scenarios: SensitivityScenarioResult[];
  leader_stability: Record<string, number>;
  robust_alternatives: string[];
  summary_notes: string[];
}

export interface TradeOffStudyRecord {
  id: string;
  name: string;
  description?: string | null;
  created_at_iso: string;
  updated_at_iso: string;
  profile_id: string;
  profile_name: string;
  profile_version: number;
  nominal_duration_days: number;
  alternatives: MissionAlternativeRecord[];
  preference_model: PreferenceModelConfig;
  scores: Record<string, AlternativeScoreBreakdown>;
  pareto_results: Record<string, AlternativeParetoResult>;
  sensitivity_summary?: SensitivityAnalysisResponse | null;
  analysis_timestamp_iso?: string | null;
  warnings: string[];
  scientific_disclaimers: string[];
}

export interface TradeOffStudyCreateRequest {
  name: string;
  description?: string | null;
  profile_id: string;
  nominal_duration_days: number;
  alternatives: MissionAlternativeInput[];
  custom_preferences?: PreferenceModelConfig | null;
}

export interface TradeOffStudyUpdateRequest {
  name?: string | null;
  description?: string | null;
  alternatives?: MissionAlternativeInput[] | null;
  preference_model?: PreferenceModelConfig | null;
}
