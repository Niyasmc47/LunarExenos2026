import { ResultIntro } from '../ui/MissionSetup';
import React, { useEffect, useMemo } from 'react';
import { useWindowPlannerStore } from '../../stores/windowPlannerStore';
import { SearchControls } from './SearchControls';
import { WindowTimelineCard } from './WindowTimelineCard';
import { WindowDetailDrawer } from './WindowDetailDrawer';
import { WindowComparisonModal } from './WindowComparisonModal';
import { SearchExportModal } from './SearchExportModal';
import {
  Download,
  Trash2,
  GitCompare,
  ArrowUpDown,
  Sparkles,
  Inbox,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  X,
} from 'lucide-react';

export const MissionWindowPlannerWorkspace: React.FC = () => {
  const searches = useWindowPlannerStore((state) => state.searches);
  const activeSearch = useWindowPlannerStore((state) => state.activeSearch);
  const selectSearch = useWindowPlannerStore((state) => state.selectSearch);
  const deleteSearch = useWindowPlannerStore((state) => state.deleteSearch);
  const init = useWindowPlannerStore((state) => state.init);
  const loading = useWindowPlannerStore((state) => state.loading);

  const filterClassification = useWindowPlannerStore((state) => state.filterClassification);
  const setFilterClassification = useWindowPlannerStore((state) => state.setFilterClassification);
  const sortBy = useWindowPlannerStore((state) => state.sortBy);
  const setSortBy = useWindowPlannerStore((state) => state.setSortBy);
  const sortOrder = useWindowPlannerStore((state) => state.sortOrder);
  const toggleSortOrder = useWindowPlannerStore((state) => state.toggleSortOrder);

  const selectedForComparison = useWindowPlannerStore((state) => state.selectedForComparison);
  const clearComparisonSelection = useWindowPlannerStore((state) => state.clearComparisonSelection);
  const runComparison = useWindowPlannerStore((state) => state.runComparison);
  const comparing = useWindowPlannerStore((state) => state.comparing);

  const openExportModal = useWindowPlannerStore((state) => state.openExportModal);

  useEffect(() => {
    init();
  }, [init]);

  // Filter and sort windows
  const displayedWindows = useMemo(() => {
    if (!activeSearch) return [];
    let list = [...activeSearch.windows];

    // Filter
    if (filterClassification !== 'ALL') {
      list = list.filter((w) => w.classification === filterClassification);
    }

    // Sort
    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'chronological') {
        cmp = new Date(a.start_timestamp_iso).getTime() - new Date(b.start_timestamp_iso).getTime();
      } else if (sortBy === 'sunlight') {
        cmp = a.solar_summary.total_sunlight_hours - b.solar_summary.total_sunlight_hours;
      } else if (sortBy === 'darkness') {
        cmp = a.solar_summary.longest_darkness_hours - b.solar_summary.longest_darkness_hours;
      } else if (sortBy === 'earth') {
        cmp = a.earth_summary.total_earth_visible_hours - b.earth_summary.total_earth_visible_hours;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [activeSearch, filterClassification, sortBy, sortOrder]);

  return (
    <div className="analysis-page flex-1 flex flex-col h-full bg-[#0e1013] overflow-y-auto">
      {/* Top Search Controls */}
      <SearchControls />

      {/* Main Content Area */}
      <div className="analysis-results p-6 space-y-5">
        <ResultIntro title="Review your mission windows" description="Filter the results, inspect a timeline, or select windows to compare." />
        {/* Active Search Selector & Summary Bar */}
        {searches.length > 0 && activeSearch && (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#141619] border border-[#2b2d32] p-4 rounded-xl">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-mono font-bold text-slate-300">
                Search Run:
              </span>
              <select
                aria-label="Saved window searches" value={activeSearch.id}
                onChange={(e) => selectSearch(e.target.value)}
                className="bg-[#08090b] border border-[#303238] text-slate-200 text-xs font-mono px-3 py-1.5 rounded-lg focus:outline-none focus:border-[#ffe3b0] max-w-xs truncate"
              >
                {searches.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                <span>Site: <strong className="text-white">{activeSearch.scenario_name}</strong></span>
                <span>•</span>
                <span>Profile: <strong className="text-white">{activeSearch.profile_name}</strong></span>
                <span>•</span>
                <span>Duration: <strong className="text-[#ffe3b0]">{activeSearch.mission_duration_hours.toFixed(1)}h</strong></span>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end md:self-auto">
              <button
                onClick={openExportModal}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#191b20] hover:bg-[#202228] text-[#7bd0ff] text-xs font-mono rounded-lg transition-colors border border-[#2b2d32]"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Data</span>
              </button>
              <button
                onClick={() => {
                  if (confirm(`Delete search run '${activeSearch.name}'?`)) {
                    deleteSearch(activeSearch.id);
                  }
                }}
                className="p-1.5 bg-[#191b20] hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border border-[#2b2d32] rounded-lg transition-colors"
                title="Delete Search Run"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Windows Explorer Section */}
        {activeSearch && (
          <div className="space-y-4">
            {/* Filter and Sort Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#0e1013] p-3 rounded-xl border border-[#2b2d32]">
              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                <button
                  aria-pressed={filterClassification === 'ALL'} onClick={() => setFilterClassification('ALL')}
                  className={`px-3 py-1 rounded-lg text-xs font-mono transition-all shrink-0 ${
                    filterClassification === 'ALL'
                      ? 'bg-[#ffe3b0] text-[#141619] font-bold shadow-sm'
                      : 'bg-[#141619] text-slate-400 hover:text-white border border-[#2b2d32]'
                  }`}
                >
                  All ({activeSearch.windows.length})
                </button>
                <button
                  aria-pressed={filterClassification === 'COMPLIANT'} onClick={() => setFilterClassification('COMPLIANT')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono transition-all shrink-0 ${
                    filterClassification === 'COMPLIANT'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 font-bold shadow-sm'
                      : 'bg-[#141619] text-emerald-400 hover:bg-[#191b20] border border-[#2b2d32]'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Compliant ({activeSearch.compliant_windows_count})</span>
                </button>
                <button
                  aria-pressed={filterClassification === 'NON_COMPLIANT'} onClick={() => setFilterClassification('NON_COMPLIANT')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono transition-all shrink-0 ${
                    filterClassification === 'NON_COMPLIANT'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50 font-bold shadow-sm'
                      : 'bg-[#141619] text-rose-400 hover:bg-[#191b20] border border-[#2b2d32]'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Non-Compliant ({activeSearch.non_compliant_windows_count})</span>
                </button>
                <button
                  aria-pressed={filterClassification === 'INDETERMINATE'} onClick={() => setFilterClassification('INDETERMINATE')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono transition-all shrink-0 ${
                    filterClassification === 'INDETERMINATE'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 font-bold shadow-sm'
                      : 'bg-[#141619] text-amber-400 hover:bg-[#191b20] border border-[#2b2d32]'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Indeterminate ({activeSearch.indeterminate_windows_count})</span>
                </button>
              </div>

              {/* Sort Controls */}
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-slate-400 flex items-center gap-1 shrink-0">
                  <ArrowUpDown className="w-3 h-3" />
                  <span>Sort:</span>
                </span>
                <select
                  aria-label="Sort mission windows" value={sortBy}
                  onChange={(e: any) => setSortBy(e.target.value)}
                  className="bg-slate-900 border border-[#303238] text-slate-200 text-xs font-mono px-2 py-1 rounded focus:outline-none"
                >
                  <option value="chronological">Start Epoch</option>
                  <option value="sunlight">Total Sunlight</option>
                  <option value="darkness">Longest Darkness</option>
                  <option value="earth">Earth Visibility</option>
                </select>
                <button
                  onClick={toggleSortOrder}
                  className="px-2 py-1 rounded bg-slate-800 border border-[#303238] text-slate-300 hover:text-white"
                  title="Toggle Ascending / Descending"
                >
                  {sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
                </button>
              </div>
            </div>

            {/* Floating Selection & Comparison Bar */}
            {selectedForComparison.length > 0 && (
              <div className="sticky top-2 z-20 bg-[#191b20]/95 border border-[#ffe3b0]/50 backdrop-blur-md rounded-xl p-3 px-4 flex items-center justify-between shadow-xl animate-in slide-in-from-top-2">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-[#ffe3b0]/20 rounded text-[#ffe3b0]">
                    <GitCompare className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-mono text-[#ffe3b0]">
                    <strong>{selectedForComparison.length}</strong> window{selectedForComparison.length > 1 ? 's' : ''} selected for comparison (max 4)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={clearComparisonSelection}
                    className="px-2 py-1 text-xs font-mono text-slate-400 hover:text-slate-200 flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    <span>Clear</span>
                  </button>
                  <button
                    onClick={runComparison}
                    disabled={selectedForComparison.length < 2 || comparing}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                      selectedForComparison.length >= 2 && !comparing
                        ? 'bg-[#ffe3b0] hover:bg-[#ffdea3] text-[#141619] shadow'
                        : 'bg-[#202228] text-slate-500 cursor-not-allowed border border-[#2b2d32]'
                    }`}
                  >
                    {comparing ? (
                      <>
                        <div className="w-3 h-3 border-2 border-[#141619]/20 border-t-[#141619] rounded-full animate-spin" />
                        <span>Comparing...</span>
                      </>
                    ) : (
                      <>
                        <GitCompare className="w-3.5 h-3.5" />
                        <span>Compare Side-by-Side</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* List of Window Cards */}
            {displayedWindows.length === 0 ? (
              <div className="text-center py-12 bg-slate-900/20 border border-[#202228] rounded-xl space-y-2">
                <Inbox className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs font-mono text-slate-400">
                  No mission windows found matching classification filter '{filterClassification}'.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {displayedWindows.map((w) => (
                  <WindowTimelineCard key={w.window_id} window={w} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty State when no searches exist */}
        {searches.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center space-y-3 bg-[#0b101c] border border-slate-800 rounded-2xl p-8">
            <div className="p-3 bg-slate-900 rounded-full text-slate-400">
              <Sparkles className="w-8 h-8" />
            </div>
            <div className="max-w-md space-y-1">
              <h3 className="text-sm font-mono font-bold text-slate-200">
                No window searches yet
              </h3>
              <p className="text-xs font-sans text-slate-400">
                Select a candidate and mission profile above to search for compliant lunar mission windows.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Modals & Drawers */}
      <WindowDetailDrawer />
      <WindowComparisonModal />
      <SearchExportModal />
    </div>
  );
};
