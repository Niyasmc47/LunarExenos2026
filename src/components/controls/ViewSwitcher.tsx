import React from 'react';
import { useLocationStore } from '../../stores/locationStore';
import { ActiveView } from '../../types/lunar';
import { Columns2, Globe, Map as MapIcon } from 'lucide-react';

export const ViewSwitcher: React.FC = () => {
  const activeView = useLocationStore((state) => state.activeView);
  const setActiveView = useLocationStore((state) => state.setActiveView);

  const views: { id: ActiveView; label: string; icon: React.ReactNode }[] = [
    { id: 'split', label: 'Both views', icon: <Columns2 className="w-3.5 h-3.5" /> },
    { id: '3d', label: '3D globe', icon: <Globe className="w-3.5 h-3.5" /> },
    { id: '2d', label: '2D map', icon: <MapIcon className="w-3.5 h-3.5" /> },
  ];

  return (
    <div role="group" aria-label="Explorer view" className="view-switcher flex items-center gap-1 bg-[#0c121e]/90 backdrop-blur-md p-1 rounded-xl border border-slate-800 shadow-md">
      {views.map((v) => {
        const isActive = activeView === v.id;
        return (
          <button
            key={v.id}
            aria-pressed={isActive}
            onClick={() => setActiveView(v.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
              isActive
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            {v.icon}
            <span>{v.label}</span>
          </button>
        );
      })}
    </div>
  );
};
