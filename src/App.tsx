import React from 'react';
import { useLocationStore } from './stores/locationStore';
import { Header } from './components/layout/Header';
import { Dashboard } from './components/layout/Dashboard';
import { TerrainExplorer } from './components/terrain-analysis/TerrainExplorer';
import { MissionComparisonWorkspace } from './components/scenario-comparison/MissionComparisonWorkspace';
import { MissionRequirementsWorkspace } from './components/mission-requirements/MissionRequirementsWorkspace';
import { CandidateScreeningWorkspace } from './components/screening/CandidateScreeningWorkspace';
import { MissionWindowPlannerWorkspace } from './components/window-planner/MissionWindowPlannerWorkspace';
import { TerrainAssessmentWorkspace } from './components/terrain-assessment/TerrainAssessmentWorkspace';
import { TradeOffWorkspace } from './components/trade-off/TradeOffWorkspace';
import { ReportGeneratorWorkspace } from './components/decision-reports/ReportGeneratorWorkspace';

export const App: React.FC = () => {
  const appScreen = useLocationStore((state) => state.appScreen);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#070b12] text-slate-100 font-sans overflow-hidden">
      <Header />
      {appScreen === 'lunar-explorer' ? (
        <Dashboard />
      ) : appScreen === 'terrain-explorer' ? (
        <TerrainExplorer />
      ) : appScreen === 'mission-comparison' ? (
        <MissionComparisonWorkspace />
      ) : appScreen === 'candidate-screening' ? (
        <CandidateScreeningWorkspace />
      ) : appScreen === 'window-planner' ? (
        <MissionWindowPlannerWorkspace />
      ) : appScreen === 'terrain-assessment' ? (
        <TerrainAssessmentWorkspace />
      ) : appScreen === 'trade-off-analysis' ? (
        <TradeOffWorkspace />
      ) : appScreen === 'mission-reports' ? (
        <ReportGeneratorWorkspace />
      ) : (
        <MissionRequirementsWorkspace />
      )}
    </div>
  );
};

export default App;
