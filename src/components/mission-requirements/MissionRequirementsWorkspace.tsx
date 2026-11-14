import React, { useEffect } from 'react';
import { useMissionProfileStore } from '../../stores/missionProfileStore';
import { ProfileListSidebar } from './ProfileListSidebar';
import { ProfileEditor } from './ProfileEditor';
import { SlidersHorizontal, RefreshCw } from 'lucide-react';

export const MissionRequirementsWorkspace: React.FC = () => {
  const loadProfiles = useMissionProfileStore((state) => state.loadProfiles);
  const loading = useMissionProfileStore((state) => state.loading);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] bg-[#070b14] overflow-hidden">
      {/* Workspace Sub-Header */}
      <div className="h-10 px-6 bg-[#0a0f1d] border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold text-slate-100 font-mono tracking-wider">
            MISSION REQUIREMENTS BUILDER
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            MVP 7.1
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-400 font-sans hidden sm:inline">
            Define lunar mission profiles, hard safety constraints, and soft trade-offs.
          </span>
          <button
            onClick={() => loadProfiles()}
            title="Reload Mission Profiles"
            disabled={loading}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Split Layout: Sidebar + Editor */}
      <div className="flex-1 flex overflow-hidden">
        <ProfileListSidebar />
        <ProfileEditor />
      </div>
    </div>
  );
};
