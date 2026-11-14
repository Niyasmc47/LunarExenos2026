from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

from app.schemas.mission_profile import MissionProfile
from app.schemas.scenario import ScenarioRecord
from app.schemas.trade_off import (
    TradeOffStudyRecord,
    AlternativeScoreBreakdown,
    AlternativeParetoResult,
    SensitivityAnalysisResponse,
)


class ReportSectionContent(BaseModel):
    section_number: int
    section_id: str
    title: str
    summary: str
    details: Dict[str, Any] = Field(default_factory=dict)
    tables: List[Dict[str, Any]] = Field(default_factory=list)
    callouts: List[str] = Field(default_factory=list)
    disclaimers: List[str] = Field(default_factory=list)


class DecisionReportCreateRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=150, description="Report title")
    mission_name: str = Field(..., min_length=2, max_length=100, description="Mission designation")
    description: Optional[str] = Field(None, description="Executive mission overview")
    author_organization: Optional[str] = Field("LUNAVISTA Mission Planning Directorate", description="Author or team")
    profile_id: str = Field(..., description="Target mission profile ID")
    trade_off_study_id: Optional[str] = Field(None, description="Source trade-off study ID (if generated from study)")
    scenario_ids: List[str] = Field(default_factory=list, description="Explicit scenarios to evaluate if not using trade-off study")
    screening_run_id: Optional[str] = Field(None, description="Associated screening run ID")
    window_search_id: Optional[str] = Field(None, description="Associated window search ID")
    terrain_assessment_id: Optional[str] = Field(None, description="Associated terrain assessment ID")
    executive_summary_notes: Optional[str] = Field(None, description="Custom executive summary observations")
    user_observations: Optional[str] = Field(None, description="Engineering notes or operational constraints")


class DecisionReportRecord(BaseModel):
    id: str = Field(..., description="Unique report ID (e.g. 'rep-a1b2c3d4')")
    title: str
    mission_name: str
    description: Optional[str] = None
    author_organization: str
    created_at_iso: str
    updated_at_iso: str
    report_version: str = "1.0"
    template_version: str = "LUNAVISTA-REP-2026.1"

    # Source Snapshot References
    profile_snapshot: MissionProfile
    trade_off_study_id: Optional[str] = None
    source_screening_id: Optional[str] = None
    source_window_search_id: Optional[str] = None
    source_terrain_assessment_id: Optional[str] = None
    evaluated_candidate_ids: List[str] = Field(default_factory=list)

    # Executive Overview
    total_candidates_evaluated: int = 0
    compliant_candidates_count: int = 0
    non_compliant_candidates_count: int = 0
    indeterminate_candidates_count: int = 0
    has_recommended_winner: bool = False
    recommended_winner_id: Optional[str] = None

    # The 12 Canonical Report Sections
    sections: List[ReportSectionContent] = Field(default_factory=list)

    # Complete frozen state snapshots for immutability
    frozen_study_data: Optional[Dict[str, Any]] = None
    frozen_scenarios_data: List[Dict[str, Any]] = Field(default_factory=list)
    provenance_metadata: Dict[str, Any] = Field(default_factory=dict)
    scientific_disclaimers: List[str] = Field(default_factory=list)
    human_decision_checklist: List[Dict[str, Any]] = Field(default_factory=list)


class DecisionReportSummary(BaseModel):
    id: str
    title: str
    mission_name: str
    author_organization: str
    created_at_iso: str
    profile_name: str
    total_candidates: int
    compliant_count: int
    trade_off_study_id: Optional[str] = None


class DecisionReportListResponse(BaseModel):
    reports: List[DecisionReportSummary]


class DecisionReportResponse(BaseModel):
    report: DecisionReportRecord
