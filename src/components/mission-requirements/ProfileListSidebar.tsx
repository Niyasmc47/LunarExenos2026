import React, { useState } from 'react';
import { useMissionProfileStore } from '../../stores/missionProfileStore';
import { MissionType } from '../../types/missionProfile';
import {
  Plus,
  Sparkles,
  Search,
  Clock,
  Trash2,
  Copy,
  Layers,
  Bot,
  UserCheck,
  Building2,
  SlidersHorizontal,
} from 'lucide-react';
import { TemplateModal } from './TemplateModal';

export const ProfileListSidebar: React.FC = () => {
  const profiles = useMissionProfileStore((state) => state.profiles);
  const selectedProfileId = useMissionProfileStore((state) => state.selectedProfileId);
  const selectProfile = useMissionProfileStore((state) => state.selectProfile);
  const startCreate = useMissionProfileStore((state) => state.startCreate);
  const duplicateProfile = useMissionProfileStore((state) => state.duplicateProfile);
  const deleteProfile = useMissionProfileStore((state) => state.deleteProfile);
  const filterType = useMissionProfileStore((state) => state.filterType);
  const setFilterType = useMissionProfileStore((state) => state.setFilterType);

  const [searchQuery, setSearchQuery] = useState('');
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  const filteredProfiles = profiles.filter((p) => {
    const matchesFilter = filterType === 'ALL' || p.mission_type === filterType;
    const matchesSearch =
      searchQuery.trim() === '' ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getMissionTypeIcon = (type: MissionType) => {
    switch (type) {
      case 'robotic_exploration':
        return <Bot className="w-3.5 h-3.5 text-emerald-400" />;
      case 'robotic_lander':
        return <Layers className="w-3.5 h-3.5 text-cyan-400" />;
      case 'crewed_surface':
        return <UserCheck className="w-3.5 h-3.5 text-rose-400" />;
      case 'long_duration_station':
        return <Building2 className="w-3.5 h-3.5 text-purple-400" />;
      case 'custom':
        return <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />;
    }
  };

  return (
    <div className="w-80 shrink-0 border-r border-[#2b2d32] bg-[#080d18] flex flex-col h-full overflow-hidden">
      {/* Top Controls */}
      <div className="p-3.5 border-b border-[#2b2d32] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
            <h2 className="text-xs font-bold text-slate-100 font-mono tracking-wider">
              MISSION PROFILES
            </h2>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
            {profiles.length}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => startCreate()}
            className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-semibold text-xs transition-colors shadow-sm shadow-emerald-500/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Profile</span>
          </button>
          <button
            onClick={() => setIsTemplateModalOpen(true)}
            className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-mono text-xs border border-[#303238] transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Templates</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search profiles..."
            className="w-full bg-[#08090b]/80 border border-[#2b2d32] text-xs font-mono text-slate-200 pl-8 pr-2.5 py-1.5 rounded-lg focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Type Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[10px] font-mono scrollbar-none">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-2 py-0.5 rounded ${
              filterType === 'ALL'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterType('robotic_exploration')}
            className={`px-2 py-0.5 rounded shrink-0 ${
              filterType === 'robotic_exploration'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Rover
          </button>
          <button
            onClick={() => setFilterType('robotic_lander')}
            className={`px-2 py-0.5 rounded shrink-0 ${
              filterType === 'robotic_lander'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Lander
          </button>
          <button
            onClick={() => setFilterType('crewed_surface')}
            className={`px-2 py-0.5 rounded shrink-0 ${
              filterType === 'crewed_surface'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Crewed
          </button>
        </div>
      </div>

      {/* Profiles List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {filteredProfiles.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-400 font-mono">
            No matching profiles found.
          </div>
        ) : (
          filteredProfiles.map((p) => {
            const isSelected = p.id === selectedProfileId;
            return (
              <div
                key={p.id}
                onClick={() => selectProfile(p.id)}
                className={`group p-3 rounded-xl border text-left cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-emerald-500/10 border-emerald-500/50 shadow-md shadow-emerald-950/20'
                    : 'bg-[#0d1424] border-[#202228] hover:border-[#303238] hover:bg-[#111a30]'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5 mb-1">
                  <div className="flex items-center gap-1.5">
                    {getMissionTypeIcon(p.mission_type)}
                    <span className="text-[10px] font-mono uppercase text-slate-400">
                      {p.mission_type.replace('_', ' ')}
                    </span>
                  </div>
                  {p.is_template ? (
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      Template
                    </span>
                  ) : (
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                      v{p.version}
                    </span>
                  )}
                </div>

                <h3
                  className={`text-xs font-semibold font-mono truncate mb-1 ${
                    isSelected ? 'text-emerald-300' : 'text-slate-200'
                  }`}
                >
                  {p.name}
                </h3>

                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {p.duration_days} days
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      title="Duplicate Profile"
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicateProfile(p.id);
                      }}
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    {!p.is_template && (
                      <button
                        title="Delete Profile"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete mission profile "${p.name}"?`)) {
                            deleteProfile(p.id);
                          }
                        }}
                        className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <TemplateModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
      />
    </div>
  );
};
