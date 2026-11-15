import React, { useEffect, useState } from 'react';
import { useDynamicAnalysisStore, PREDEFINED_SITES } from '../../stores/dynamicAnalysisStore';
import { discoverDatasets } from '../../services/dynamicAnalysisApi';
import {
  Search,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Bookmark,
  Square,
  Ruler,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export const RegionSelectionToolbar: React.FC = () => {
  const selectedRegionBbox = useDynamicAnalysisStore((state) => state.selectedRegionBbox);
  const setSelectedRegionBbox = useDynamicAnalysisStore((state) => state.setSelectedRegionBbox);
  const activeDatasetId = useDynamicAnalysisStore((state) => state.activeDatasetId);
  const setActiveDatasetId = useDynamicAnalysisStore((state) => state.setActiveDatasetId);

  const discoveryResponse = useDynamicAnalysisStore((state) => state.discoveryResponse);
  const setDiscoveryResponse = useDynamicAnalysisStore((state) => state.setDiscoveryResponse);
  const isDiscovering = useDynamicAnalysisStore((state) => state.isDiscovering);
  const setIsDiscovering = useDynamicAnalysisStore((state) => state.setIsDiscovering);

  const selectPredefinedSite = useDynamicAnalysisStore((state) => state.selectPredefinedSite);

  // Local bounding box inputs
  const [minLat, setMinLat] = useState<string>(selectedRegionBbox.minLat.toFixed(4));
  const [maxLat, setMaxLat] = useState<string>(selectedRegionBbox.maxLat.toFixed(4));
  const [minLon, setMinLon] = useState<string>(selectedRegionBbox.minLon.toFixed(4));
  const [maxLon, setMaxLon] = useState<string>(selectedRegionBbox.maxLon.toFixed(4));
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Sync inputs when store bbox changes
  useEffect(() => {
    setMinLat(selectedRegionBbox.minLat.toFixed(4));
    setMaxLat(selectedRegionBbox.maxLat.toFixed(4));
    setMinLon(selectedRegionBbox.minLon.toFixed(4));
    setMaxLon(selectedRegionBbox.maxLon.toFixed(4));
  }, [selectedRegionBbox]);

  // Run discovery on mount or when bounding box changes
  const handleTriggerDiscovery = () => {
    const lat1 = parseFloat(minLat);
    const lat2 = parseFloat(maxLat);
    const lon1 = parseFloat(minLon);
    const lon2 = parseFloat(maxLon);

    if (isNaN(lat1) || isNaN(lat2) || isNaN(lon1) || isNaN(lon2)) return;

    const bbox = { minLat: lat1, maxLat: lat2, minLon: lon1, maxLon: lon2 };
    setSelectedRegionBbox(bbox);

    setIsDiscovering(true);
    discoverDatasets(lat1, lat2, lon1, lon2)
      .then((resp) => {
        if (resp) {
          setDiscoveryResponse(resp);
          // Only auto-select if currently active dataset is not in the discovered candidates
          const currentActive = useDynamicAnalysisStore.getState().activeDatasetId;
          const isCurrentInCandidates = resp.all_candidates.some(
            (c) => c.dataset.dataset_id === currentActive
          );
          if (!isCurrentInCandidates && resp.best_resolution_candidate) {
            setActiveDatasetId(resp.best_resolution_candidate.dataset.dataset_id);
          }
        }
      })
      .finally(() => setIsDiscovering(false));
  };

  useEffect(() => {
    handleTriggerDiscovery();
  }, []);

  return (
    <div className="flex flex-col gap-2 bg-[#0c121e]/95 backdrop-blur-md border border-slate-800 rounded-xl p-2.5 shadow-xl text-xs font-mono">
      {/* Top Predefined Sites Selector */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-1.5 text-slate-300 font-semibold mr-1">
            <Bookmark className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] uppercase">Terrain region</span>
          </div>

          {PREDEFINED_SITES.map((site) => (
            <button
              key={site.id}
              onClick={() => {
                selectPredefinedSite(site.id);
                setTimeout(() => handleTriggerDiscovery(), 50);
              }}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                selectedRegionBbox.minLat === site.bbox.minLat
                  ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                  : 'bg-[#070b12] text-slate-300 hover:text-emerald-400 border border-slate-800 hover:border-slate-700'
              }`}
            >
              {site.name}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          title="Toggle NASA dataset discovery and bounding box editor"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#070b12] hover:bg-slate-800 text-slate-400 hover:text-emerald-400 border border-slate-800 text-[11px] transition-colors"
        >
          <SlidersHorizontal className="w-3 h-3" />
          <span>{showAdvanced ? 'Hide data settings' : 'Data source & boundaries'}</span>
          {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {showAdvanced && (
        <div className="border-t border-slate-800 pt-2 space-y-2">

      {/* Manual Bounding Box Editor & Area Calculation */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-slate-400 text-[11px] flex items-center gap-1">
            <Square className="w-3.5 h-3.5 text-emerald-400" /> BOUNDS:
          </span>

          <div className="flex items-center gap-1 bg-[#070b12] px-2 py-1 rounded border border-slate-800">
            <span className="text-[10px] text-slate-500">LAT:</span>
            <input
              type="text"
              value={minLat}
              onChange={(e) => setMinLat(e.target.value)}
              className="w-16 bg-transparent text-emerald-400 text-[11px] outline-none"
            />
            <span className="text-slate-600">to</span>
            <input
              type="text"
              value={maxLat}
              onChange={(e) => setMaxLat(e.target.value)}
              className="w-16 bg-transparent text-emerald-400 text-[11px] outline-none"
            />
          </div>

          <div className="flex items-center gap-1 bg-[#070b12] px-2 py-1 rounded border border-slate-800">
            <span className="text-[10px] text-slate-500">LON:</span>
            <input
              type="text"
              value={minLon}
              onChange={(e) => setMinLon(e.target.value)}
              className="w-18 bg-transparent text-emerald-400 text-[11px] outline-none"
            />
            <span className="text-slate-600">to</span>
            <input
              type="text"
              value={maxLon}
              onChange={(e) => setMaxLon(e.target.value)}
              className="w-18 bg-transparent text-emerald-400 text-[11px] outline-none"
            />
          </div>

          <button
            onClick={handleTriggerDiscovery}
            disabled={isDiscovering}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-black font-bold transition-all shadow-md disabled:opacity-50"
          >
            <Search className="w-3.5 h-3.5" />
            <span>{isDiscovering ? 'Searching…' : 'Find terrain data'}</span>
          </button>
        </div>

        {/* Calculated Surface Area */}
        {discoveryResponse && (
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 bg-[#070b12] px-2.5 py-1 rounded border border-slate-800">
            <Ruler className="w-3.5 h-3.5 text-emerald-400" />
            <span>REGION AREA:</span>
            <span className="text-slate-200 font-bold">
              {discoveryResponse.selected_region_area_km2.toLocaleString()} km²
            </span>
          </div>
        )}
      </div>

      {/* Dynamic Dataset Discovery Recommendation Banner */}
      {discoveryResponse && (
        <div className="bg-[#070b12] border border-slate-800 rounded-lg p-2.5 space-y-2 mt-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span className="font-bold text-slate-200">Available terrain data</span>
              <span className="text-slate-400">
                Found {discoveryResponse.all_candidates.length} compatible datasets
              </span>
            </div>

            {/* Candidate Selector Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500">ACTIVE DEM:</span>
              <select
                value={activeDatasetId}
                onChange={(e) => setActiveDatasetId(e.target.value)}
                className="bg-[#0c121e] border border-slate-700 text-emerald-400 px-2 py-0.5 rounded text-xs outline-none cursor-pointer"
              >
                {discoveryResponse.all_candidates.map((c) => (
                  <option key={c.dataset.dataset_id} value={c.dataset.dataset_id}>
                    {c.dataset.name} ({c.dataset.nominal_pixel_spacing_m}m/px) — {c.coverage_percentage}% coverage
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Selection Recommendations */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            {discoveryResponse.best_resolution_candidate && (
              <div
                onClick={() => setActiveDatasetId(discoveryResponse.best_resolution_candidate!.dataset.dataset_id)}
                className={`p-2 rounded border cursor-pointer transition-all ${
                  activeDatasetId === discoveryResponse.best_resolution_candidate.dataset.dataset_id
                    ? 'bg-emerald-950/40 border-emerald-500/80 text-emerald-300'
                    : 'bg-[#0c121e] border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between font-bold mb-0.5">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> BEST RESOLUTION
                  </span>
                  <span className="text-[10px] bg-emerald-500/10 px-1.5 py-0.2 rounded text-emerald-400 border border-emerald-500/30">
                    {discoveryResponse.best_resolution_candidate.dataset.nominal_pixel_spacing_m}m/pixel
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {discoveryResponse.best_resolution_candidate.dataset.name} ({discoveryResponse.best_resolution_candidate.coverage_percentage}% coverage)
                </div>
              </div>
            )}

            {discoveryResponse.best_coverage_candidate && (
              <div
                onClick={() => setActiveDatasetId(discoveryResponse.best_coverage_candidate!.dataset.dataset_id)}
                className={`p-2 rounded border cursor-pointer transition-all ${
                  activeDatasetId === discoveryResponse.best_coverage_candidate.dataset.dataset_id
                    ? 'bg-emerald-950/40 border-emerald-500/80 text-emerald-300'
                    : 'bg-[#0c121e] border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between font-bold mb-0.5">
                  <span className="flex items-center gap-1 text-cyan-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> BEST COMPLETE COVERAGE
                  </span>
                  <span className="text-[10px] bg-cyan-500/10 px-1.5 py-0.2 rounded text-cyan-400 border border-cyan-500/30">
                    {discoveryResponse.best_coverage_candidate.coverage_percentage}% Continuous
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {discoveryResponse.best_coverage_candidate.dataset.name} ({discoveryResponse.best_coverage_candidate.dataset.nominal_pixel_spacing_m}m/pixel)
                </div>
              </div>
            )}
          </div>

          {/* Warnings Banner */}
          {discoveryResponse.coverage_warnings.map((warn, idx) => (
            <div key={idx} className="flex items-center gap-1.5 text-[10px] text-amber-400/90 pt-0.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{warn}</span>
            </div>
          ))}
        </div>
      )}
        </div>
      )}
    </div>
  );
};
