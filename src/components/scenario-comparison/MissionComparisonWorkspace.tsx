import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Map,
  FileSpreadsheet,
  AlertCircle,
  Inbox,
  GitCompareArrows,
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
  const comparisonResult = useScenarioStore((state) => state.comparisonResult);
  const selectedScenarioIds = useScenarioStore((state) => state.selectedScenarioIds);
  const isComparing = useScenarioStore((state) => state.isComparing);
  const error = useScenarioStore((state) => state.error);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'map' | 'table'>('dashboard');
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Load scenarios on mount — no auto-comparison
  useEffect(() => {
    loadScenarios();
  }, []);

  const hasSelection = selectedScenarioIds.length >= 2;
  const hasResults = comparisonResult !== null;

  return (
    <div className="comparison-page flex-1 flex flex-col h-full min-h-0 overflow-y-auto bg-[#0e1013] p-2 md:p-3 gap-2.5 font-mono text-xs">
      {/* Top Scenario Management Bar */}
      <ScenarioManagementBar onOpenCreateModal={() => setCreateModalOpen(true)} />

      {/* Collapsible Mission Constraints Panel */}
      <MissionConstraintsPanel />

      {/* Sub-View Navigation Bar — only show when results exist */}
      {hasResults && (
        <div className="flex items-center justify-between bg-[#141619] border border-[#2b2d32] px-3 py-1.5 rounded-xl text-xs font-mono shrink-0">
          <div className="flex items-center gap-1.5 bg-[#0e1013] p-1 rounded-lg border border-[#2b2d32]">
            <button
              aria-pressed={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded font-bold transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Results overview</span>
            </button>

            <button
              aria-pressed={activeTab === 'map'} onClick={() => setActiveTab('map')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded font-bold transition-all ${
                activeTab === 'map'
                  ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Map className="w-3.5 h-3.5" />
              <span>Sites on the map</span>
            </button>

            <button
              aria-pressed={activeTab === 'table'} onClick={() => setActiveTab('table')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded font-bold transition-all ${
                activeTab === 'table'
                  ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>All metrics</span>
            </button>
          </div>

          {comparisonResult && (
            <div className="text-[10px] text-slate-400 hidden sm:flex items-center gap-2">
              <span>ID: <b className="text-cyan-300">{comparisonResult.comparison_id}</b></span>
              <span>•</span>
              <span className="text-emerald-400">Shared settings: {comparisonResult.is_harmonized ? 'YES' : 'NO'}</span>
            </div>
          )}
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-2 shrink-0">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Viewport Content */}
      <div className="comparison-results pr-1 space-y-3">
        {isComparing ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400">
            <div className="w-7 h-7 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <span>Comparing terrain, sunlight, Earth visibility, and mission requirements…</span>
          </div>
        ) : !hasResults ? (
          /* Empty state: no comparison has been run yet */
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 bg-[#0b101c] border border-slate-800 rounded-2xl p-8">
            <div className="p-3 bg-slate-900 rounded-full text-slate-400">
              {hasSelection ? (
                <GitCompareArrows className="w-8 h-8" />
              ) : (
                <Inbox className="w-8 h-8" />
              )}
            </div>
            <h3 className="text-sm font-bold text-slate-200 font-mono">
              {hasSelection
                ? `${selectedScenarioIds.length} candidates selected`
                : 'No comparisons yet'}
            </h3>
            <p className="text-xs text-slate-400 font-sans max-w-md leading-relaxed">
              {hasSelection
                ? 'Click "Compare selected" above to calculate and compare terrain, sunlight, Earth visibility and mission requirements across these candidates.'
                : 'Select two or more saved candidates from the list above to compare their terrain, illumination and communications characteristics side by side.'}
            </p>
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
