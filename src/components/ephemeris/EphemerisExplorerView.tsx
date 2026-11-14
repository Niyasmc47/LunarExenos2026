import React, { useEffect } from 'react';
import { useEphemerisStore } from '../../stores/ephemerisStore';
import { useLocationStore } from '../../stores/locationStore';
import { useDynamicAnalysisStore } from '../../stores/dynamicAnalysisStore';
import { EphemerisControlToolbar } from './EphemerisControlToolbar';
import { CelestialSkyRadar } from './CelestialSkyRadar';
import { CelestialBodyCard } from './CelestialBodyCard';
import { EphemerisTimeSeriesChart } from './EphemerisTimeSeriesChart';
import { Sun, Globe, AlertCircle, RefreshCw } from 'lucide-react';

export const EphemerisExplorerView: React.FC = () => {
  const {
    positionData,
    timeSeriesData,
    isTimeSeriesLoading,
    error,
    computePosition,
    computeTimeSeries,
  } = useEphemerisStore();

  const selectedLat = useLocationStore((state) => state.selectedLatitude);
  const selectedLon = useLocationStore((state) => state.selectedLongitude);
  const currentPointTelemetry = useDynamicAnalysisStore((state) => state.currentPointTelemetry);

  const observerLat = currentPointTelemetry?.latitude ?? selectedLat;
  const observerLon = currentPointTelemetry?.longitude ?? selectedLon;

  useEffect(() => {
    computePosition(observerLat, observerLon);
    computeTimeSeries(observerLat, observerLon);
  }, [observerLat, observerLon, computePosition, computeTimeSeries]);

  const sun = positionData?.sun;
  const earth = positionData?.earth;
  const isSunUp = sun ? sun.elevation_deg >= 0 : false;
  const isEarthUp = earth ? earth.elevation_deg >= 0 : false;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden gap-2">
      {/* Top Ephemeris Control Toolbar */}
      <EphemerisControlToolbar observerLat={observerLat} observerLon={observerLon} />

      {/* High-Level Mission Status Banner (Plain English for Any User) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-[#0c121e]/90 border border-slate-800 rounded-xl p-2.5 font-mono shadow-md text-xs">
        {/* Sun / Solar Power Status */}
        <div className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border ${
          isSunUp
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
            : 'bg-slate-900/80 border-slate-800 text-slate-400'
        }`}>
          <div className={`p-2 rounded-lg ${isSunUp ? 'bg-amber-400/20 text-amber-400' : 'bg-slate-800 text-slate-500'}`}>
            <Sun className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-100 text-[11px] uppercase tracking-wider">
                {isSunUp ? '☀️ Daylight (Solar Power Active)' : '🌑 Lunar Night (In Shadow)'}
              </span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                isSunUp ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
              }`}>
                {sun ? (sun.elevation_deg > 0 ? `+${sun.elevation_deg.toFixed(1)}°` : `${sun.elevation_deg.toFixed(1)}°`) : '--'}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 truncate mt-0.5">
              {isSunUp
                ? `Solar panels generate electricity at elevation +${sun?.elevation_deg.toFixed(1)}° (${sun?.azimuth_deg.toFixed(0)}° Azimuth)`
                : 'Sun below horizon. Lunar night conditions; rover must draw battery power.'}
            </div>
          </div>
        </div>

        {/* Earth / Radio Comm Link Status */}
        <div className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border ${
          isEarthUp
            ? 'bg-sky-500/10 border-sky-500/30 text-sky-200'
            : 'bg-slate-900/80 border-slate-800 text-slate-400'
        }`}>
          <div className={`p-2 rounded-lg ${isEarthUp ? 'bg-sky-400/20 text-sky-400' : 'bg-slate-800 text-rose-400'}`}>
            <Globe className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-100 text-[11px] uppercase tracking-wider">
                {isEarthUp ? '📡 Direct-to-Earth Link (Connected)' : '🚫 Direct Comm Link (Occulted)'}
              </span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                isEarthUp ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
              }`}>
                {earth ? (earth.elevation_deg > 0 ? `+${earth.elevation_deg.toFixed(1)}°` : `${earth.elevation_deg.toFixed(1)}°`) : '--'}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 truncate mt-0.5">
              {isEarthUp
                ? `Uninterrupted radio link to Earth at +${earth?.elevation_deg.toFixed(1)}° elevation (1-way delay: ${earth?.light_time_seconds.toFixed(2)}s)`
                : 'Earth is hidden beneath the local terrain. Lunar relay satellite link required.'}
            </div>
          </div>
        </div>
      </div>

      {/* Error Retry Banner if backend had an issue */}
      {error && (
        <div className="flex items-center justify-between p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-mono">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => {
              computePosition(observerLat, observerLon);
              computeTimeSeries(observerLat, observerLon);
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-bold"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      )}

      {/* Main Celestial Analysis Workspace */}
      <div className="flex-1 flex flex-col gap-2 min-h-0 overflow-y-auto pr-0.5">
        {/* Top Split: Celestial Sky Radar (Left) + Celestial Body Cards (Right) */}
        <div className="flex flex-col lg:flex-row gap-2 min-h-[340px]">
          {/* Left: Local Sky Dome Polar Projection */}
          <div className="w-full lg:w-[48%] flex flex-col min-h-0">
            <CelestialSkyRadar
              sun={positionData?.sun || null}
              earth={positionData?.earth || null}
              observerLat={observerLat}
              observerLon={observerLon}
            />
          </div>

          {/* Right: Sun and Earth Physical Telemetry Cards */}
          <div className="w-full lg:w-[52%] flex flex-col gap-2 min-h-0">
            <CelestialBodyCard body={positionData?.sun || null} type="Sun" />
            <CelestialBodyCard body={positionData?.earth || null} type="Earth" />
          </div>
        </div>

        {/* Bottom Full-Width Time-Series Trajectory Chart */}
        <div className="h-64 min-h-[240px] shrink-0">
          <EphemerisTimeSeriesChart
            data={timeSeriesData}
            isLoading={isTimeSeriesLoading}
          />
        </div>
      </div>
    </div>
  );
};
