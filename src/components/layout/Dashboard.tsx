import React, { useState } from 'react';
import { useLocationStore } from '../../stores/locationStore';
import { LunarGlobe } from '../lunar-globe/LunarGlobe';
import { LunarMap } from '../lunar-map/LunarMap';
import { CoordinatePanel } from '../controls/CoordinatePanel';
import { ViewSwitcher } from '../controls/ViewSwitcher';
import { SlidersHorizontal, ChevronRight, ChevronLeft } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const activeView = useLocationStore((state) => state.activeView);
  const [panelOpen, setPanelOpen] = useState(true);

  return (
    <div className="flex-1 flex flex-col md:flex-row h-[calc(100vh-4rem)] overflow-hidden bg-[#070b12] p-2 md:p-3 gap-2 md:gap-3">
      {/* Mobile View Switcher */}
      <div className="flex lg:hidden justify-center shrink-0">
        <ViewSwitcher />
      </div>

      {/* Main Visualization Viewport Container */}
      <div className="flex-1 relative flex flex-col md:flex-row gap-2 md:gap-3 overflow-hidden min-h-0">
        {/* 3D Moon Globe View */}
        {(activeView === 'split' || activeView === '3d') && (
          <div
            className={`transition-all duration-300 relative ${
              activeView === 'split'
                ? 'w-full md:w-1/2 h-1/2 md:h-full'
                : 'w-full h-full'
            }`}
          >
            <LunarGlobe />
          </div>
        )}

        {/* 2D Lunar Map View */}
        {(activeView === 'split' || activeView === '2d') && (
          <div
            className={`transition-all duration-300 relative ${
              activeView === 'split'
                ? 'w-full md:w-1/2 h-1/2 md:h-full'
                : 'w-full h-full'
            }`}
          >
            <LunarMap />
          </div>
        )}
      </div>

      {/* Control Panel Sidebar (Collapsible on Desktop, Scrollable) */}
      <div
        className={`relative transition-all duration-300 shrink-0 flex flex-col ${
          panelOpen ? 'w-full md:w-84 lg:w-96' : 'w-full md:w-0'
        } ${!panelOpen && 'hidden md:flex'}`}
      >
        {/* Toggle Collapse Button for Desktop */}
        <button
          onClick={() => setPanelOpen(!panelOpen)}
          title={panelOpen ? 'Collapse Controls Panel' : 'Expand Controls Panel'}
          className="hidden md:flex absolute -left-3.5 top-1/2 -translate-y-1/2 z-40 items-center justify-center w-7 h-12 bg-[#0c121e] border border-slate-700 hover:border-emerald-500 rounded-l-md text-slate-400 hover:text-emerald-400 shadow-xl transition-colors"
        >
          {panelOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        {panelOpen && (
          <div className="w-full h-full overflow-y-auto pr-0.5 space-y-3">
            <CoordinatePanel />
          </div>
        )}
      </div>

      {/* Collapsed State Toggle Pill for Desktop */}
      {!panelOpen && (
        <button
          onClick={() => setPanelOpen(true)}
          className="hidden md:flex absolute right-4 bottom-4 z-40 items-center gap-2 bg-[#0c121e]/90 hover:bg-slate-800 text-emerald-400 border border-slate-700 px-3 py-2 rounded-xl text-xs font-mono shadow-2xl transition-all"
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>SHOW CONTROLS</span>
        </button>
      )}
    </div>
  );
};
