import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { useMissionProfileStore } from '../src/stores/missionProfileStore';
import { useScenarioStore } from '../src/stores/scenarioStore';
import { useScreeningStore } from '../src/stores/screeningStore';
import { useWindowPlannerStore } from '../src/stores/windowPlannerStore';
import { useTerrainAssessmentStore } from '../src/stores/terrainAssessmentStore';
import { useTradeOffStore } from '../src/stores/tradeOffStore';
import { useDecisionReportStore } from '../src/stores/decisionReportStore';

// Read-only validation of saved result shapes against the revised React views.
// No browser, live requests, effects, downloads, or persisted mutations are run.
const read = (name: string) => JSON.parse(readFileSync(new URL(`../backend/data/${name}.json`,import.meta.url),'utf8'));
const profiles = read('mission_profiles'), scenarios = read('mission_scenarios');
const screenings = read('screening_runs'), searches = read('mission_window_searches');
const assessments = read('terrain_assessments'), studies = read('trade_off_studies'), reports = read('mission_decision_reports');
const stores = [useMissionProfileStore,useScenarioStore,useScreeningStore,useWindowPlannerStore,useTerrainAssessmentStore,useTradeOffStore,useDecisionReportStore];
useMissionProfileStore.setState({ profiles, activeProfile:profiles[0], selectedProfileId:profiles[0].id });
useScenarioStore.setState({scenarios});
const screening = screenings.find((r:any)=>r.candidates.length);
const search = searches.find((r:any)=>r.windows.length);
const assessment = assessments.find((r:any)=>r.candidates.length);
const study = studies.find((r:any)=>r.alternatives.length >= 2);
const report = reports.find((r:any)=>r.sections.length);
useScreeningStore.setState({runs:[screening],activeRun:screening,selectedCandidateId:screening.candidates[0].candidate_id,selectedProfileId:profiles[0].id,selectedScenarioIds:[scenarios[0].id]});
useWindowPlannerStore.setState({searches:[search],activeSearch:search,selectedProfileId:profiles[0].id,selectedScenarioId:scenarios[0].id});
useTerrainAssessmentStore.setState({assessments:[assessment],activeAssessment:assessment,selectedProfileId:profiles[0].id,selectedScenarioIds:[scenarios[0].id]});
useTradeOffStore.setState({studies:[study],activeStudy:study});
useDecisionReportStore.setState({activeReport:report});
let passed=0,failed=0;
async function check(folder:string,name:string,props:Record<string,unknown>={}) {
 for (const store of stores) Object.assign(store.getInitialState(),store.getState());
 try { const module=await import(`../src/components/${folder}/${name}.tsx`); const html=renderToStaticMarkup(React.createElement(module[name],props)); if (!html.length) throw Error('View rendered empty'); console.log(`PASS ${name}`);passed++; }
 catch(error) { console.error(`FAIL ${name}: ${error}`);failed++; }
}
await check('mission-requirements','ProfileEditor');
await check('screening','CandidateScreeningWorkspace');
await check('window-planner','MissionWindowPlannerWorkspace');
await check('terrain-assessment','TerrainAssessmentWorkspace');
for (const activeTab of ['comparison','radar','pareto','sensitivity','preferences'] as const) {useTradeOffStore.setState({activeTab});await check('trade-off','TradeOffWorkspace');}
await check('decision-reports','ReportViewer',{report});
await check('mission-requirements','TemplateModal',{isOpen:true,onClose:()=>{}});
await check('scenario-comparison','ScenarioCreateModal',{isOpen:true,onClose:()=>{}});
await check('screening','ExportModal',{isOpen:true,onClose:()=>{},run:screening});
useWindowPlannerStore.setState({isExportOpen:true});await check('window-planner','SearchExportModal');
useWindowPlannerStore.setState({isDetailOpen:true,selectedWindow:search.windows[0]});await check('window-planner','WindowDetailDrawer');
useTerrainAssessmentStore.setState({isExportOpen:true});await check('terrain-assessment','AssessmentExportModal');
useTerrainAssessmentStore.setState({isDetailOpen:true,selectedCandidateId:assessment.candidates[0].candidate_id});await check('terrain-assessment','TerrainDetailDrawer');
useTradeOffStore.setState({isCreateModalOpen:true});await check('trade-off','CreateStudyModal');
useTradeOffStore.setState({isExportModalOpen:true});await check('trade-off','TradeOffExportModal');
useTradeOffStore.setState({isDetailOpen:true,selectedAlternativeId:study.alternatives[0].id});await check('trade-off','AlternativeDetailDrawer');
useDecisionReportStore.setState({isCreateModalOpen:true});await check('decision-reports','CreateReportModal');
const compared = search.windows.slice(0,2).map((w:any) => ({
 ...w, ...w.solar_summary, ...w.earth_summary, differences_from_reference: [],
}));
useWindowPlannerStore.setState({isComparisonOpen:true,comparisonResult:{search_id:search.id,reference_window_id:compared[0].window_id,compared_windows:compared,is_fully_consistent:true,consistency_notes:[]}});
await check('window-planner','WindowComparisonModal');
useMissionProfileStore.setState({isEditing:true,draftProfile:profiles[0]});await check('mission-requirements','ProfileEditor');
for (const section of report.sections) await check('decision-reports','ReportViewer',{report:{...report,sections:[section]}});
console.log(`Saved-data rendering: ${passed} passed, ${failed} failed. Browser verification remains separate.`);
process.exitCode=failed?1:0;
