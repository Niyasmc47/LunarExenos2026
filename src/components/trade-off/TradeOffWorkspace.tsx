import { ResultIntro } from '../ui/MissionSetup';
import React, { useEffect } from 'react';
import { useTradeOffStore } from '../../stores/tradeOffStore';
import { AlternativeComparisonTable } from './AlternativeComparisonTable';
import { RadarComparisonChart } from './RadarComparisonChart';
import { ParetoAnalysisView } from './ParetoAnalysisView';
import { SensitivityAnalysisView } from './SensitivityAnalysisView';
import { PreferenceConfigPanel } from './PreferenceConfigPanel';
import { CreateStudyModal } from './CreateStudyModal';
import { TradeOffExportModal } from './TradeOffExportModal';
import { AlternativeDetailDrawer } from './AlternativeDetailDrawer';
import {
  Sparkles,
  Download,
  Trash2,
  Table,
  Compass,
  Award,
  TrendingUp,
  SlidersHorizontal,
  RefreshCw,
  FolderOpen,
  AlertCircle,
  Plus,
} from 'lucide-react';

export const TradeOffWorkspace: React.FC = () => {
  const studies = useTradeOffStore((state) => state.studies);
  const activeStudy = useTradeOffStore((state) => state.activeStudy);
  const activeTab = useTradeOffStore((state) => state.activeTab);
  const setActiveTab = useTradeOffStore((state) => state.setActiveTab);
  const loadStudies = useTradeOffStore((state) => state.loadStudies);
  const selectStudy = useTradeOffStore((state) => state.selectStudy);
  const deleteStudy = useTradeOffStore((state) => state.deleteStudy);
  const reanalyzeCurrentStudy = useTradeOffStore((state) => state.reanalyzeCurrentStudy);
  const openCreateModal = useTradeOffStore((state) => state.openCreateModal);
  const openExportModal = useTradeOffStore((state) => state.openExportModal);
  const isLoading = useTradeOffStore((state) => state.isLoading);
  const error = useTradeOffStore((state) => state.error);
  const clearError = useTradeOffStore((state) => state.clearError);

  useEffect(() => {
    loadStudies();
  }, [loadStudies]);

  const handleDelete = async () => {
    if (!activeStudy) return;
    if (window.confirm(`Are you sure you want to delete trade-off study "${activeStudy.name}"?`)) {
      await deleteStudy(activeStudy.id);
    }
  };

  return (
    <div className="tradeoff-page analysis-page flex-1 flex flex-col h-full bg-[#070b14] overflow-y-auto">
      {/* Top Workspace Bar */}
      <div className="bg-[#090e1a] border-b border-slate-800 px-6 py-3.5 shrink-0 flex flex-wrap items-center justify-between gap-4">
        {/* Study Selector & Title */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
            <Sparkles className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-white tracking-wide">
                Saved study
              </span>
              {studies.length > 0 ? (
                <select
                  aria-label="Saved trade-off studies" value={activeStudy?.id || ''}
                  onChange={(e) => selectStudy(e.target.value)}
                  className="bg-slate-950 border border-slate-700 text-slate-200 text-xs font-mono px-3 py-1 rounded-lg focus:outline-none focus:border-purple-500"
                >
                  {studies.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.alternatives.length} alternatives)
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-xs font-mono text-slate-500">No Studies Created</span>
              )}
            </div>

            {activeStudy && (
              <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                Profile: <strong className="text-slate-300">{activeStudy.profile_name}</strong> • Nominal Duration: {activeStudy.nominal_duration_days} days
              </div>
            )}
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          {activeStudy && (
            <>
              <button
                onClick={reanalyzeCurrentStudy}
                disabled={isLoading}
                className="px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-600 bg-slate-900 text-slate-300 text-xs font-mono flex items-center gap-1.5 transition-colors disabled:opacity-50"
                title="Recalculate multi-criteria scores and Pareto frontier"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Recalculate</span>
              </button>

              <button
                onClick={openExportModal}
                className="px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-600 bg-slate-900 text-slate-300 text-xs font-mono flex items-center gap-1.5 transition-colors"
                title="Export results as JSON or CSV"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Export</span>
              </button>

              <button
                onClick={handleDelete}
                className="p-1.5 rounded-lg border border-slate-800 hover:border-rose-800/60 bg-slate-900 text-slate-500 hover:text-rose-400 transition-colors"
                title="Delete trade-off study"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}

          <button
            onClick={openCreateModal}
            className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Study</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      {activeStudy && (
        <div className="bg-[#0b1120] border-b border-slate-800/80 px-6 shrink-0 flex items-center gap-1 overflow-x-auto">
          <button
            aria-pressed={activeTab === 'comparison'} onClick={() => setActiveTab('comparison')}
            className={`px-3.5 py-2.5 text-xs font-mono font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'comparison'
                ? 'border-emerald-500 text-emerald-400 bg-slate-900/50'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>Rankings</span>
          </button>

          <button
            aria-pressed={activeTab === 'radar'} onClick={() => setActiveTab('radar')}
            className={`px-3.5 py-2.5 text-xs font-mono font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'radar'
                ? 'border-cyan-500 text-cyan-400 bg-slate-900/50'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Strengths at a glance</span>
          </button>

          <button
            aria-pressed={activeTab === 'pareto'} onClick={() => setActiveTab('pareto')}
            className={`px-3.5 py-2.5 text-xs font-mono font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'pareto'
                ? 'border-emerald-500 text-emerald-400 bg-slate-900/50'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Best trade-offs</span>
          </button>

          <button
            aria-pressed={activeTab === 'sensitivity'} onClick={() => setActiveTab('sensitivity')}
            className={`px-3.5 py-2.5 text-xs font-mono font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'sensitivity'
                ? 'border-purple-500 text-purple-400 bg-slate-900/50'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>What if priorities change?</span>
          </button>

          <button
            aria-pressed={activeTab === 'preferences'} onClick={() => setActiveTab('preferences')}
            className={`px-3.5 py-2.5 text-xs font-mono font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'preferences'
                ? 'border-indigo-500 text-indigo-400 bg-slate-900/50'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Your priorities</span>
          </button>
        </div>
      )}

      {/* Main Workspace Scrollable Area */}
      <div className="analysis-results p-6 space-y-6">
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={clearError}
              className="text-rose-400 hover:text-rose-200 font-bold ml-4"
            >
              Dismiss
            </button>
          </div>
        )}

        {activeStudy ? (
          <div>
            <ResultIntro title={{ comparison: 'Compare your alternatives', radar: 'See each candidate’s strengths', pareto: 'Find options without a better all-round alternative', sensitivity: 'Check how stable your decision is', preferences: 'Set what matters most' }[activeTab]} description={{ comparison: 'Review scores alongside safety checks and evidence quality.', radar: 'Compare the shape of each profile. Larger values reflect better normalized scores.', pareto: 'These candidates cannot be improved on one criterion without a trade-off on another.', sensitivity: 'Explore whether changing your weights changes the ranking.', preferences: 'Adjust relative weights, then recalculate to see their effect.' }[activeTab]} />
            {activeTab === 'comparison' && <AlternativeComparisonTable />}
            {activeTab === 'radar' && <RadarComparisonChart />}
            {activeTab === 'pareto' && <ParetoAnalysisView />}
            {activeTab === 'sensitivity' && <SensitivityAnalysisView />}
            {activeTab === 'preferences' && <PreferenceConfigPanel key={activeStudy.id} />}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <FolderOpen className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-mono font-bold text-white">
                Find the balance that fits your mission
              </h3>
              <p className="text-xs font-mono text-slate-400 max-w-md mt-1 leading-relaxed">
                Create a study to compare 2–10 candidate alternatives across multi-criteria solar illumination, Earth communications, and terrain safety.
              </p>
            </div>
            <button
              onClick={openCreateModal}
              className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create your first study</span>
            </button>
          </div>
        )}
      </div>

      {/* Modals & Drawers */}
      <CreateStudyModal />
      <TradeOffExportModal />
      <AlternativeDetailDrawer />
    </div>
  );
};
