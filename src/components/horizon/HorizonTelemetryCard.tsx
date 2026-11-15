import React from 'react';
import {
  HorizonAnalysisResponse,
} from '../../types/horizon';
import { useHorizonStore } from '../../stores/horizonStore';
import {
  Sliders,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Database,
  MapPin,
  Ruler,
  TrendingUp,
} from 'lucide-react';

interface HorizonTelemetryCardProps {
  data: HorizonAnalysisResponse | null;
  isLoading: boolean;
  currentLat: number;
  currentLon: number;
}

export const HorizonTelemetryCard: React.FC<HorizonTelemetryCardProps> = ({
  data,
  isLoading,
  currentLat,
  currentLon,
}) => {
  const {
    observerHeight,
    azimuthResolution,
    maxSearchDistance,
    setObserverHeight,
    setAzimuthResolution,
    setMaxSearchDistance,
    computeHorizon,
  } = useHorizonStore();

  const handleCompute = () => {
    computeHorizon(currentLat, currentLon);
  };

  return (
    <div className="flex flex-col gap-3 bg-[#141619] border border-[#2b2d32] rounded-xl p-3 text-xs font-mono">
      {/* Header & Recompute Trigger */}
      <div className="flex items-center justify-between border-b border-[#202228] pb-2">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-slate-200 uppercase tracking-wider">
            HORIZON ENGINE TELEMETRY & CONFIG
          </span>
        </div>
        <button
          onClick={handleCompute}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-lg shadow-md transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>{isLoading ? 'CALCULATING...' : 'RECOMPUTE'}</span>
        </button>
      </div>

      {/* Observer Location Details */}
      <div className="grid grid-cols-2 gap-2 bg-[#0e1013] p-2.5 rounded-lg border border-[#2b2d32]">
        <div>
          <span className="text-[10px] text-slate-500 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-emerald-400" />
            OBSERVER LAT / LON
          </span>
          <div className="text-slate-200 font-bold mt-0.5">
            {currentLat.toFixed(4)}°, {currentLon.toFixed(4)}°
          </div>
        </div>
        <div>
          <span className="text-[10px] text-slate-500 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-emerald-400" />
            GROUND ELEVATION (h0)
          </span>
          <div className="text-slate-200 font-bold mt-0.5">
            {data ? `${data.observer_surface_elevation_m.toFixed(1)} m` : 'Computing...'}
          </div>
        </div>
      </div>

      {/* Configurable Observer Height */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-400 flex items-center gap-1">
            <Ruler className="w-3.5 h-3.5 text-sky-400" />
            Observer Height Above Terrain (h_obs):
          </span>
          <span className="text-emerald-400 font-bold">{observerHeight.toFixed(1)} m</span>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {[0.0, 1.0, 2.0, 10.0].map((h) => (
            <button
              key={h}
              onClick={() => {
                setObserverHeight(h);
                computeHorizon(currentLat, currentLon);
              }}
              className={`py-1 rounded text-center transition-all ${
                observerHeight === h
                  ? 'bg-emerald-500 text-black font-bold'
                  : 'bg-[#0e1013] text-slate-400 hover:text-slate-200 border border-[#2b2d32]'
              }`}
            >
              {h} m
            </button>
          ))}
        </div>

        <input
          type="range"
          min="0"
          max="30"
          step="0.5"
          value={observerHeight}
          onChange={(e) => setObserverHeight(parseFloat(e.target.value))}
          onMouseUp={handleCompute}
          className="w-full accent-emerald-500 cursor-pointer h-1 bg-slate-800 rounded-lg appearance-none mt-1"
        />
      </div>

      {/* Configurable Azimuth & Distance Parameters */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[10px] text-slate-400">Azimuth Step (Δθ):</label>
          <div className="flex gap-1">
            {[1.0, 2.0, 5.0].map((res) => (
              <button
                key={res}
                onClick={() => {
                  setAzimuthResolution(res);
                  computeHorizon(currentLat, currentLon);
                }}
                className={`flex-1 py-1 rounded text-[10px] transition-all ${
                  azimuthResolution === res
                    ? 'bg-emerald-500 text-black font-bold'
                    : 'bg-[#0e1013] text-slate-400 border border-[#2b2d32]'
                }`}
              >
                {res}°
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-slate-400">Max Search Radius:</label>
          <div className="flex gap-1">
            {[5000, 15000, 30000].map((dist) => (
              <button
                key={dist}
                onClick={() => {
                  setMaxSearchDistance(dist);
                  computeHorizon(currentLat, currentLon);
                }}
                className={`flex-1 py-1 rounded text-[10px] transition-all ${
                  maxSearchDistance === dist
                    ? 'bg-emerald-500 text-black font-bold'
                    : 'bg-[#0e1013] text-slate-400 border border-[#2b2d32]'
                }`}
              >
                {dist / 1000}km
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Statistics */}
      {data && (
        <div className="space-y-2 bg-[#0e1013] p-2.5 rounded-lg border border-[#2b2d32]">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
            <span>Horizon Skyline Summary</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[9px] flex items-center gap-1 ${
                data.summary.coverage_status === 'complete'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              }`}
            >
              {data.summary.coverage_status === 'complete' ? (
                <CheckCircle2 className="w-2.5 h-2.5" />
              ) : (
                <AlertTriangle className="w-2.5 h-2.5" />
              )}
              {data.summary.coverage_status.toUpperCase()} COVERAGE
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#202228]">
            <div>
              <div className="text-[10px] text-slate-500">MAX SKYLINE ELEVATION</div>
              <div className="text-emerald-400 font-bold text-sm">
                +{data.summary.max_horizon_elevation_deg.toFixed(2)}°
              </div>
              <div className="text-[9px] text-slate-400">
                Azimuth {data.summary.max_horizon_azimuth_deg.toFixed(1)}°
              </div>
            </div>

            <div>
              <div className="text-[10px] text-slate-500">MIN SKYLINE ELEVATION</div>
              <div className="text-sky-400 font-bold text-sm">
                {data.summary.min_horizon_elevation_deg > 0 ? '+' : ''}
                {data.summary.min_horizon_elevation_deg.toFixed(2)}°
              </div>
              <div className="text-[9px] text-slate-400">
                Azimuth {data.summary.min_horizon_azimuth_deg.toFixed(1)}°
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#202228] text-[10px]">
            <div>
              <span className="text-slate-500">Mean Skyline:</span>{' '}
              <span className="text-slate-300">
                {data.summary.mean_horizon_elevation_deg > 0 ? '+' : ''}
                {data.summary.mean_horizon_elevation_deg.toFixed(2)}°
              </span>
            </div>
            <div>
              <span className="text-slate-500">Valid Samples:</span>{' '}
              <span className="text-slate-300">{data.summary.valid_samples_count.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Warnings & Coverage Notes */}
      {data && data.warnings.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 text-[10px] text-amber-300 space-y-1">
          {data.warnings.map((w, idx) => (
            <div key={idx} className="flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Provenance Footer */}
      <div className="border-t border-[#202228] pt-2 text-[10px] text-slate-500 space-y-1">
        <div className="flex items-center gap-1 text-slate-400 font-bold">
          <Database className="w-3 h-3 text-emerald-400" />
          <span>{data?.dataset_name || 'NASA LOLA 5m DEM'}</span>
        </div>
        <div>Datum: IAU Moon 2000 Sphere (R = 1,737,400 m)</div>
        <div>Frame: {data?.reference_frame || 'MOON_ME (DE421)'}</div>
        <div className="text-[9px] text-slate-600 truncate">{data?.citation}</div>
      </div>
    </div>
  );
};
