import { MissionProfile } from './missionProfile';

export interface ReportSectionContent {
  section_number: number;
  section_id: string;
  title: string;
  summary: string;
  details: Record<string, any>;
  tables: Array<{
    title: string;
    headers: string[];
    rows: any[][];
  }>;
  callouts: string[];
  disclaimers: string[];
}

export interface DecisionReportCreateRequest {
  title: string;
  mission_name: string;
  description?: string | null;
  author_organization?: string | null;
  profile_id: string;
  trade_off_study_id?: string | null;
  scenario_ids?: string[];
  screening_run_id?: string | null;
  window_search_id?: string | null;
  terrain_assessment_id?: string | null;
  executive_summary_notes?: string | null;
  user_observations?: string | null;
}

export interface DecisionReportRecord {
  id: string;
  title: string;
  mission_name: string;
  description?: string | null;
  author_organization: string;
  created_at_iso: string;
  updated_at_iso: string;
  report_version: string;
  template_version: string;

  profile_snapshot: MissionProfile;
  trade_off_study_id?: string | null;
  source_screening_id?: string | null;
  source_window_search_id?: string | null;
  source_terrain_assessment_id?: string | null;
  evaluated_candidate_ids: string[];

  total_candidates_evaluated: number;
  compliant_candidates_count: number;
  non_compliant_candidates_count: number;
  indeterminate_candidates_count: number;
  has_recommended_winner: boolean;
  recommended_winner_id?: string | null;

  sections: ReportSectionContent[];
  frozen_study_data?: Record<string, any> | null;
  frozen_scenarios_data: Array<Record<string, any>>;
  provenance_metadata: Record<string, any>;
  scientific_disclaimers: string[];
  human_decision_checklist: Array<{
    item: string;
    status: string;
  }>;
}

export interface DecisionReportSummary {
  id: string;
  title: string;
  mission_name: string;
  author_organization: string;
  created_at_iso: string;
  profile_name: string;
  total_candidates: number;
  compliant_count: number;
  trade_off_study_id?: string | null;
}
