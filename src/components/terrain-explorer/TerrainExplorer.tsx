import React, { useState } from 'react';
import { TerrainViewer3D } from './TerrainViewer3D';
import { TerrainMap2D } from './TerrainMap2D';
import { ElevationProfileChart } from './ElevationProfileChart';
import { TerrainInfoPanel } from './TerrainInfoPanel';
import { SlidersHorizontal, ChevronRight, ChevronLeft, Mountain } from 'lucide-react';

export const TerrainExplorer: React.FC = () => {
  const [panelOpen, setPanelOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'both' | '3d' | '2d'>('both');

  return (
    <div className="flex-1 flex flex-col md:flex-row h-[calc(100vh-4rem)] overflow-hidden bg-[#070b12] p-2 md:p-3 gap-2 md:gap-3">
      {/* Main Terrain Analysis Workspace */}
      <div className="flex-1 flex flex-col gap-2 min-h-0 min-w-0 overflow-hidden">
        {/* Top View Toggle Strip */}
        <div className="shrink-0 flex items-center justify-between bg-[#0c121e]/90 border border-slate-800/80 px-3 py-1.5 rounded-xl">
          <div className="flex items-center gap-2">
            <Mountain className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
              LUNAR TERRAIN WORKSPACE — SITE 01 CONNECTING RIDGE
            </span>
          </div>

          <div className="flex items-center gap-1 bg-[#070b12] p-1 rounded-lg border border-slate-800 text-xs font-mono">
            <button
              onClick={() => setActiveTab('both')}
              className={`px-2.5 py-1 rounded transition-colors ${
                activeTab === 'both' ? 'bg-emerald-500 text-black font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              DUAL VIEW
            </button>
            <button
              onClick={() => setActiveTab('3d')}
              className={`px-2.5 py-1 rounded transition-colors ${
                activeTab === '3d' ? 'bg-emerald-500 text-black font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              3D MESH
            </button>
            <button
              onClick={() => setActiveTab('2d')}
              className={`px-2.5 py-1 rounded transition-colors ${
                activeTab === '2d' ? 'bg-emerald-500 text-black font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              2D MAP
            </button>
          </div>
        </div>

        {/* Dual 2D & 3D Visualizations Area */}
        <div className="flex-1 flex flex-col md:flex-row gap-2 min-h-0 overflow-hidden">
          {/* 3D Terrain Viewer */}
          <div
            className={`transition-all duration-300 h-full ${
              activeTab === 'both'
                ? 'w-full md:w-1/2 flex flex-col'
                : activeTab === '3d'
                ? 'w-full flex flex-col'
                : 'hidden'
            }`}
          >
            <TerrainViewer3D />
          </div>

          {/* 2D Elevation Map */}
          <div
            className={`transition-all duration-300 h-full ${
              activeTab === 'both'
                ? 'w-full md:w-1/2 flex flex-col'
                : activeTab === '2d'
                ? 'w-full flex flex-col'
                : 'hidden'
            }`}
          >
            <TerrainMap2D />
          </div>
        </div>

        {/* Bottom Elevation Profile Tool (Recharts) */}
        <div className="h-48 shrink-0 min-h-[160px]">
          <ElevationProfileChart />
        </div>
      </div>

      {/* Right Information & Inspection Sidebar */}
      <div
        className={`relative transition-all duration-300 shrink-0 flex flex-col ${
          panelOpen ? 'w-full md:w-80 lg:w-96' : 'w-full md:w-0'
        } ${!panelOpen && 'hidden md:flex'}`}
      >
        {/* Toggle Collapse Button for Desktop */}
        <button
          onClick={() => setPanelOpen(!panelOpen)}
          title={panelOpen ? 'Collapse Terrain Info Panel' : 'Expand Terrain Info Panel'}
          className="hidden md:flex absolute -left-3.5 top-1/2 -translate-y-1/2 z-40 items-center justify-center w-7 h-12 bg-[#0c121e] border border-slate-700 hover:border-emerald-500 rounded-l-md text-slate-400 hover:text-emerald-400 shadow-xl transition-colors"
        >
          {panelOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        {panelOpen && (
          <div className="w-full h-full overflow-y-auto pr-0.5 space-y-3">
            <TerrainInfoPanel />
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
          <span>SHOW TERRAIN DATA</span>
        </button>
      )}
    </div>
  );
};
