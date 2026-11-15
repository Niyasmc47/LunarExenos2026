import React from 'react';
import {
  X,
  Sun,
  Globe2,
  Mountain,
  Compass,
  Calendar,
  Layers,
  BookmarkPlus,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { useCelestialSimulationStore } from '../../stores/celestialSimulationStore';
import { useDynamicAnalysisStore } from '../../stores/dynamicAnalysisStore';
import { PlainLanguageExplainer } from '../ui/PlainLanguageExplainer';
import { PREDEFINED_SITES } from '../../stores/dynamicAnalysisStore';

interface LocationAnalysisDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveAsCandidate: (coords: {
    latitude: number;
    longitude: number;
    siteId: string;
    observerHeight: number;
    startIso: string;
  }) => void;
}

export const LocationAnalysisDrawer: React.FC<LocationAnalysisDrawerProps> = ({
  isOpen,
  onClose,
  onSaveAsCandidate,
}) => {
  const isAnalyzing = useCelestialSimulationStore((state) => state.isAnalyzing);
  const analysis = useCelestialSimulationStore((state) => state.analysisResult);
  const simulationTime = useCelestialSimulationStore((state) => state.simulationTime);
  const analyzeLocation = useCelestialSimulationStore((state) => state.analyzeLocation);
  const activeDatasetId = useDynamicAnalysisStore((state) => state.activeDatasetId);

  if (!isOpen) return null;

  const site = analysis ? PREDEFINED_SITES.find((s) => s.id === analysis.site_id) : undefined;
  const siteLabel = site ? site.name : analysis?.site_id || activeDatasetId || 'Site 01';

  const handleRecompute = () => {
    if (analysis) {
      analyzeLocation(analysis.latitude, analysis.longitude, analysis.site_id, analysis.observer_height_m);
    }
  };

  const handleSave = () => {
    if (analysis) {
      onSaveAsCandidate({
        latitude: analysis.latitude,
        longitude: analysis.longitude,
        siteId: analysis.site_id,
        observerHeight: analysis.observer_height_m,
        startIso: analysis.timestamp_iso || simulationTime,
      });
    }
  };

  const sun = analysis?.sun;
  const earth = analysis?.earth;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-[#080d17]/95 backdrop-blur-md border-l border-slate-700/80 shadow-2xl flex flex-col font-mono text-xs overflow-hidden animate-in slide-in-from-right duration-200">
      {/* Drawer Header */}
      <div className="shrink-0 flex items-center justify-between p-4 border-b border-slate-800 bg-[#0c1322]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <div className="text-slate-100 font-bold text-sm tracking-wide">
              POINT LOCATION ANALYSIS
            </div>
            <div className="text-slate-400 text-[10px]">
              High-resolution NASA LOLA terrain & topocentric visibility
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
          aria-label="Close analysis drawer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Drawer Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isAnalyzing && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center space-y-2">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto text-emerald-400" />
            <div className="text-emerald-300 font-bold">Querying NASA LOLA DEM & SPICE Ephemeris...</div>
            <div className="text-slate-400 text-[10px]">Sampling surface elevation, slope, and topocentric skyline angles</div>
          </div>
        )}

        {analysis && (
          <>
            {/* Location & Site Overview */}
            <div className="p-3 bg-[#0c1424] border border-slate-800 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                  Target Coordinates & Region
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                  {siteLabel}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-slate-200">
                <div className="bg-[#070b13] p-2 rounded-lg border border-slate-800/80">
                  <div className="text-[10px] text-slate-500 uppercase">Latitude</div>
                  <div className="font-bold text-sm text-emerald-400">{analysis.latitude.toFixed(5)}°</div>
                </div>
                <div className="bg-[#070b13] p-2 rounded-lg border border-slate-800/80">
                  <div className="text-[10px] text-slate-500 uppercase">Longitude</div>
                  <div className="font-bold text-sm text-emerald-400">{analysis.longitude.toFixed(5)}°</div>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>Epoch: <strong className="text-slate-200">{new Date(analysis.timestamp_iso).toUTCString()}</strong></span>
                </div>
                <button
                  onClick={handleRecompute}
                  title="Re-run analysis for currently active simulation time"
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1 text-[10px]"
                >
                  <RefreshCw className="w-3 h-3" />
                  Re-evaluate
                </button>
              </div>
            </div>

            {/* Terrain & Surface Properties */}
            <div className="p-3 bg-[#0c1424] border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-slate-200 text-xs">
                  <Mountain className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Terrain Surface & Elevation</span>
                </div>
                <PlainLanguageExplainer topic="elevation" />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="bg-[#070b13] p-2 rounded-lg border border-slate-800">
                  <div className="text-[9px] text-slate-500 uppercase">Elevation (h0)</div>
                  <div className="text-sm font-bold text-white">
                    {analysis.surface_elevation_m.toFixed(1)} m
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5">LOLA 5m/px DEM</div>
                </div>

                <div className="bg-[#070b13] p-2 rounded-lg border border-slate-800">
                  <div className="text-[9px] text-slate-500 uppercase flex items-center justify-between">
                    <span>Slope</span>
                    <PlainLanguageExplainer topic="slope" />
                  </div>
                  <div className={`text-sm font-bold ${analysis.slope_deg <= 10 ? 'text-emerald-400' : analysis.slope_deg <= 15 ? 'text-amber-400' : 'text-rose-400'}`}>
                    {analysis.slope_deg.toFixed(1)}°
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5">
                    {analysis.slope_deg <= 10 ? 'Safe (<10°)' : analysis.slope_deg <= 15 ? 'Moderate' : 'Steep (>15°)'}
                  </div>
                </div>

                <div className="bg-[#070b13] p-2 rounded-lg border border-slate-800">
                  <div className="text-[9px] text-slate-500 uppercase flex items-center justify-between">
                    <span>DEM Coverage</span>
                    <PlainLanguageExplainer topic="coverage" />
                  </div>
                  <div className={`text-xs font-bold mt-1 ${analysis.coverage_status === 'complete' || analysis.coverage_status === 'available' ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {analysis.coverage_status.toUpperCase()}
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5">NASA Authentic</div>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 flex items-center gap-1.5 bg-[#070b13] p-2 rounded-lg border border-slate-800/80">
                <Layers className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Observer mast height: <strong className="text-white">{analysis.observer_height_m.toFixed(1)} m</strong> above surface</span>
              </div>
            </div>

            {/* Sun Visibility & Illumination */}
            <div className="p-3 bg-[#0c1424] border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-amber-400 text-xs">
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span>Solar Illumination & Topocentric Vector</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  sun?.fraction_visible && sun.fraction_visible > 0.8
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : sun?.fraction_visible && sun.fraction_visible > 0
                    ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}>
                  {sun?.fraction_visible && sun.fraction_visible > 0.8 ? 'FULL SUN' : sun?.fraction_visible && sun.fraction_visible > 0 ? 'PARTIAL' : 'OCCULTED'}
                </span>
              </div>

              {sun && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-slate-300">
                    <div className="bg-[#070b13] p-2 rounded-lg border border-slate-800">
                      <div className="text-[9px] text-slate-500 uppercase">Sun Azimuth</div>
                      <div className="font-bold text-white text-xs">{sun.azimuth_deg.toFixed(2)}° (0° = North)</div>
                    </div>
                    <div className="bg-[#070b13] p-2 rounded-lg border border-slate-800">
                      <div className="text-[9px] text-slate-500 uppercase">Sun Elevation</div>
                      <div className={`font-bold text-xs ${sun.elevation_deg > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                        {sun.elevation_deg > 0 ? `+${sun.elevation_deg.toFixed(2)}°` : `${sun.elevation_deg.toFixed(2)}°`}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-slate-300">
                    <div className="bg-[#070b13] p-2 rounded-lg border border-slate-800">
                      <div className="text-[9px] text-slate-500 uppercase">Visible Solar Fraction</div>
                      <div className="font-bold text-white text-xs">
                        {(sun.fraction_visible * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div className="bg-[#070b13] p-2 rounded-lg border border-slate-800">
                      <div className="text-[9px] text-slate-500 uppercase">Limb Clearance</div>
                      <div className="font-bold text-white text-xs">
                        {sun.upper_limb_clearance_deg > 0 ? `+${sun.upper_limb_clearance_deg.toFixed(2)}°` : `${sun.upper_limb_clearance_deg.toFixed(2)}°`}
                      </div>
                    </div>
                  </div>

                  <div className="text-[10px] p-2 rounded bg-[#070b13] border border-slate-800 text-slate-400 leading-relaxed">
                    {sun.fraction_visible > 0.5
                      ? 'Direct solar power available. Sun disk clears local horizon ridges.'
                      : sun.fraction_visible > 0
                      ? 'Penumbra / partial solar disk illuminated across terrain peaks.'
                      : 'In terrain shadow / lunar night. Solar panels receiving zero direct sunlight.'}
                  </div>
                </div>
              )}
            </div>

            {/* Earth Line-of-Sight & Communications */}
            <div className="p-3 bg-[#0c1424] border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-sky-400 text-xs">
                  <Globe2 className="w-4 h-4 text-sky-400" />
                  <span>Earth Direct Line-of-Sight (LOS)</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  earth?.fraction_visible && earth.fraction_visible > 0.5
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}>
                  {earth?.fraction_visible && earth.fraction_visible > 0.5 ? 'DIRECT LOS OK' : 'LOS OCCULTED'}
                </span>
              </div>

              {earth && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-slate-300">
                    <div className="bg-[#070b13] p-2 rounded-lg border border-slate-800">
                      <div className="text-[9px] text-slate-500 uppercase">Earth Azimuth</div>
                      <div className="font-bold text-white text-xs">{earth.azimuth_deg.toFixed(2)}°</div>
                    </div>
                    <div className="bg-[#070b13] p-2 rounded-lg border border-slate-800">
                      <div className="text-[9px] text-slate-500 uppercase">Earth Elevation</div>
                      <div className={`font-bold text-xs ${earth.elevation_deg > 0 ? 'text-sky-400' : 'text-slate-400'}`}>
                        {earth.elevation_deg > 0 ? `+${earth.elevation_deg.toFixed(2)}°` : `${earth.elevation_deg.toFixed(2)}°`}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-slate-300">
                    <div className="bg-[#070b13] p-2 rounded-lg border border-slate-800">
                      <div className="text-[9px] text-slate-500 uppercase">Earth Visible Fraction</div>
                      <div className="font-bold text-white text-xs">
                        {(earth.fraction_visible * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div className="bg-[#070b13] p-2 rounded-lg border border-slate-800">
                      <div className="text-[9px] text-slate-500 uppercase">Limb Clearance</div>
                      <div className="font-bold text-white text-xs">
                        {earth.upper_limb_clearance_deg > 0 ? `+${earth.upper_limb_clearance_deg.toFixed(2)}°` : `${earth.upper_limb_clearance_deg.toFixed(2)}°`}
                      </div>
                    </div>
                  </div>

                  <div className="text-[10px] p-2 rounded bg-[#070b13] border border-slate-800 text-slate-400 leading-relaxed">
                    {earth.fraction_visible > 0.5
                      ? 'Direct DSN (Deep Space Network) radio link clear above local terrain horizons.'
                      : 'Earth disk occulted by terrain horizon. Requires lunar relay satellite communications.'}
                  </div>
                </div>
              )}
            </div>

            {/* Warnings if any */}
            {analysis.warnings && analysis.warnings.length > 0 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 text-amber-300 font-bold text-[11px]">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Coverage / Calculation Notes</span>
                </div>
                {analysis.warnings.map((w, idx) => (
                  <div key={idx} className="text-[10px] text-amber-200/90 leading-tight">
                    • {w}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Drawer Footer Actions */}
      <div className="shrink-0 p-4 border-t border-slate-800 bg-[#0c1322] space-y-2">
        <button
          onClick={handleSave}
          disabled={!analysis || isAnalyzing}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-bold rounded-xl shadow-lg transition-all disabled:opacity-50"
        >
          <BookmarkPlus className="w-4 h-4" />
          <span>Save location as candidate</span>
        </button>
        <div className="text-center text-[10px] text-slate-500">
          Saves to mission scenarios for multi-criteria comparison, window planning & screening
        </div>
      </div>
    </div>
  );
};
