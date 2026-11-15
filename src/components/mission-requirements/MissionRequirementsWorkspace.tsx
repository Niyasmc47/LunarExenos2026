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
    <div className="flex-1 flex flex-col h-full min-h-0 bg-[#0e1013] overflow-hidden">
      {/* Workspace Sub-Header */}
      <div className="min-h-14 py-3 px-6 bg-[#141619] border-b border-[#2b2d32] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold text-slate-100 font-mono tracking-wider">
            Your mission profiles
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-400 font-sans hidden sm:inline">
            Set safety limits and mission preferences.
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
      <div className="profile-split flex-1 flex overflow-hidden">
        <ProfileListSidebar />
        <ProfileEditor />
      </div>
    </div>
  );
};
