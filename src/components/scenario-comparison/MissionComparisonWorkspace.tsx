import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Map,
  FileSpreadsheet,
  AlertCircle,
} from 'lucide-react';
import { useScenarioStore } from '../../stores/scenarioStore';
import { ScenarioManagementBar } from './ScenarioManagementBar';
import { MissionConstraintsPanel } from './MissionConstraintsPanel';
import { SideBySideScenarioCards } from './SideBySideScenarioCards';
import { ComparativeCharts } from './ComparativeCharts';
import { ConstraintEvaluationResults } from './ConstraintEvaluationResults';
import { ComparativeMetricsTable } from './ComparativeMetricsTable';
import { ScenarioMapOverview } from './ScenarioMapOverview';
import { ScenarioCreateModal } from './ScenarioCreateModal';

export const MissionComparisonWorkspace: React.FC = () => {
  const loadScenarios = useScenarioStore((state) => state.loadScenarios);
  const runComparison = useScenarioStore((state) => state.runComparison);
  const comparisonResult = useScenarioStore((state) => state.comparisonResult);
  const isComparing = useScenarioStore((state) => state.isComparing);
  const error = useScenarioStore((state) => state.error);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'map' | 'table'>('dashboard');
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Initial load
  useEffect(() => {
    loadScenarios().then(() => {
      if (!comparisonResult) {
        runComparison();
      }
    });
  }, []);

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-[#070b12] p-2 md:p-3 gap-2.5 font-mono text-xs">
      {/* Top Scenario Management Bar */}
      <ScenarioManagementBar onOpenCreateModal={() => setCreateModalOpen(true)} />

      {/* Collapsible Mission Constraints Panel */}
      <MissionConstraintsPanel />

      {/* Sub-View Navigation Bar */}
      <div className="flex items-center justify-between bg-[#0c121e]/90 border border-slate-800 px-3 py-1.5 rounded-xl text-xs font-mono shrink-0">
        <div className="flex items-center gap-1.5 bg-[#070b12] p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded font-bold transition-all ${
              activeTab === 'dashboard'
                ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>COMPARISON DASHBOARD</span>
          </button>

          <button
            onClick={() => setActiveTab('map')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded font-bold transition-all ${
              activeTab === 'map'
                ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Map className="w-3.5 h-3.5" />
            <span>LUNAR MAP OVERVIEW</span>
          </button>

          <button
            onClick={() => setActiveTab('table')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded font-bold transition-all ${
              activeTab === 'table'
                ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>PARAMETER MATRIX</span>
          </button>
        </div>

        {comparisonResult && (
          <div className="text-[10px] text-slate-400 hidden sm:flex items-center gap-2">
            <span>ID: <b className="text-cyan-300">{comparisonResult.comparison_id}</b></span>
            <span>•</span>
            <span className="text-emerald-400">Harmonized: {comparisonResult.is_harmonized ? 'YES' : 'NO'}</span>
          </div>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-2 shrink-0">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Viewport Content */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-3">
        {isComparing ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400">
            <div className="w-7 h-7 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <span>Evaluating multi-scenario terrain horizons, ephemerides, and mission constraints...</span>
          </div>
        ) : activeTab === 'dashboard' ? (
          <>
            <SideBySideScenarioCards />
            <ComparativeCharts />
            <ConstraintEvaluationResults />
          </>
        ) : activeTab === 'map' ? (
          <ScenarioMapOverview />
        ) : (
          <ComparativeMetricsTable />
        )}
      </div>

      {/* Modal Dialog for Scenario Creation */}
      <ScenarioCreateModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />
    </div>
  );
};
