import React, { useEffect, useState } from 'react';
import { useDynamicAnalysisStore } from '../../stores/dynamicAnalysisStore';
import { useLocationStore } from '../../stores/locationStore';
import { fetchRegionalStatistics } from '../../services/dynamicAnalysisApi';
import { formatCoordinates } from '../../utils/lunarCoordinates';
import {
  BarChart3,
  MapPin,
  Info,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export const RegionalStatisticsPanel: React.FC = () => {
  const selectedLatitude = useLocationStore((state) => state.selectedLatitude);
  const selectedLongitude = useLocationStore((state) => state.selectedLongitude);

  const selectedRegionBbox = useDynamicAnalysisStore((state) => state.selectedRegionBbox);
  const activeDatasetId = useDynamicAnalysisStore((state) => state.activeDatasetId);
  const regionalStatistics = useDynamicAnalysisStore((state) => state.regionalStatistics);
  const setRegionalStatistics = useDynamicAnalysisStore((state) => state.setRegionalStatistics);
  const statisticsLoading = useDynamicAnalysisStore((state) => state.statisticsLoading);
  const setStatisticsLoading = useDynamicAnalysisStore((state) => state.setStatisticsLoading);
  const currentPointTelemetry = useDynamicAnalysisStore((state) => state.currentPointTelemetry);

  const [showProvenance, setShowProvenance] = useState(false);

  useEffect(() => {
    setStatisticsLoading(true);
    fetchRegionalStatistics(
      activeDatasetId,
      selectedRegionBbox.minLat,
      selectedRegionBbox.maxLat,
      selectedRegionBbox.minLon,
      selectedRegionBbox.maxLon
    )
      .then((stats) => {
        if (stats) setRegionalStatistics(stats);
      })
      .finally(() => setStatisticsLoading(false));
  }, [activeDatasetId, selectedRegionBbox]);

  return (
    <div className="flex flex-col gap-3 text-xs font-mono">
      {/* SECTION 1: POINT INSPECTION TELEMETRY */}
      <div className="bg-[#0c121e]/95 backdrop-blur-md border border-slate-800 rounded-xl p-3.5 shadow-xl space-y-2.5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="flex items-center gap-1.5 font-bold uppercase text-slate-200">
            <MapPin className="w-4 h-4 text-emerald-400" />
            INSPECTED LOCATION
          </span>
          <span className="text-[10px] text-slate-400">DATUM R=1,737.4 KM</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[10px] text-slate-500">COORDINATES</div>
            <div className="text-emerald-400 font-bold truncate">
              {formatCoordinates({ latitude: selectedLatitude, longitude: selectedLongitude }, 3)}
            </div>
            <div className="text-[10px] text-slate-400">
              {selectedLatitude.toFixed(5)}°, {selectedLongitude.toFixed(5)}°
            </div>
          </div>

          <div>
            <div className="text-[10px] text-slate-500">COVERAGE STATUS</div>
            <div className="flex items-center gap-1 mt-0.5">
              {currentPointTelemetry?.in_bounds ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-semibold uppercase">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  {currentPointTelemetry.quality_status}
                </span>
              ) : currentPointTelemetry ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  Outside Active DEM
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                  <Info className="w-3.5 h-3.5 text-slate-400" />
                  Click terrain to sample
                </span>
              )}
            </div>
          </div>

          <div>
            <div className="text-[10px] text-slate-500">SURFACE ELEVATION</div>
            <div className="text-base font-bold text-slate-100">
              {currentPointTelemetry?.in_bounds && typeof currentPointTelemetry.elevation_m === 'number'
                ? `${currentPointTelemetry.elevation_m > 0 ? '+' : ''}${currentPointTelemetry.elevation_m} m`
                : currentPointTelemetry ? 'Outside Bounds' : '—'}
            </div>
          </div>

          <div>
            <div className="text-[10px] text-slate-500">LOCAL SLOPE</div>
            <div className="text-base font-bold text-slate-100">
              {currentPointTelemetry?.in_bounds && typeof currentPointTelemetry.slope_deg === 'number'
                ? `${currentPointTelemetry.slope_deg}° ${currentPointTelemetry.slope_deg <= 10 ? '(Safe)' : ''}`
                : currentPointTelemetry ? 'N/A' : '—'}
            </div>
            {currentPointTelemetry?.slope_source && (
              <div className="text-[9px] text-slate-500 capitalize">
                Src: {currentPointTelemetry.slope_source.replace('_', ' ')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 2: REGIONAL TERRAIN STATISTICS */}
      <div className="bg-[#0c121e]/95 backdrop-blur-md border border-slate-800 rounded-xl p-3.5 shadow-xl space-y-2.5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-1.5 font-bold uppercase text-slate-200">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            <span>REGIONAL STATISTICS</span>
            {statisticsLoading && <RefreshCw className="w-3 h-3 text-emerald-400 animate-spin ml-1" />}
          </div>
          {regionalStatistics && (
            <span className="text-[10px] text-emerald-400">
              {regionalStatistics.valid_data_area_km2} km² ({regionalStatistics.data_coverage_percentage}%)
            </span>
          )}
        </div>

        {regionalStatistics && (
          <div className="space-y-3">
            {/* 4-Box Elevation Stats */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#070b12] p-2 rounded-lg border border-slate-800">
                <div className="text-[10px] text-slate-500">MAX ELEVATION</div>
                <div className="text-emerald-400 font-bold text-sm">
                  {regionalStatistics.elevation_max_m !== null ? `+${regionalStatistics.elevation_max_m} m` : 'N/A'}
                </div>
              </div>

              <div className="bg-[#070b12] p-2 rounded-lg border border-slate-800">
                <div className="text-[10px] text-slate-500">MIN ELEVATION</div>
                <div className="text-cyan-400 font-bold text-sm">
                  {regionalStatistics.elevation_min_m !== null ? `${regionalStatistics.elevation_min_m} m` : 'N/A'}
                </div>
              </div>

              <div className="bg-[#070b12] p-2 rounded-lg border border-slate-800">
                <div className="text-[10px] text-slate-500">MEAN ELEVATION</div>
                <div className="text-slate-200 font-bold text-sm">
                  {regionalStatistics.elevation_mean_m !== null ? `+${regionalStatistics.elevation_mean_m} m` : 'N/A'}
                </div>
              </div>

              <div className="bg-[#070b12] p-2 rounded-lg border border-slate-800">
                <div className="text-[10px] text-slate-500">TOTAL RELIEF (ΔH)</div>
                <div className="text-amber-400 font-bold text-sm">
                  {regionalStatistics.elevation_range_m !== null ? `${regionalStatistics.elevation_range_m} m` : 'N/A'}
                </div>
              </div>
            </div>

            {/* Slope Distribution Bar Progress */}
            <div className="space-y-1.5 bg-[#070b12] p-2.5 rounded-lg border border-slate-800">
              <div className="flex justify-between items-center text-[10px] text-slate-400 font-semibold mb-1">
                <span>SLOPE LANDING HAZARD BREAKDOWN:</span>
                <span className="text-emerald-400">Mean: {regionalStatistics.slope_mean_deg}°</span>
              </div>

              {Object.entries(regionalStatistics.slope_distribution_percentage).map(([label, pct]) => (
                <div key={label} className="space-y-0.5">
                  <div className="flex justify-between text-[9px] text-slate-400">
                    <span className="truncate">{label}</span>
                    <span className="font-bold text-slate-200">{pct}%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        label.includes('Safe')
                          ? 'bg-emerald-500'
                          : label.includes('Favorable')
                          ? 'bg-emerald-400'
                          : label.includes('Moderate')
                          ? 'bg-amber-400'
                          : label.includes('Steep')
                          ? 'bg-orange-500'
                          : label.includes('High')
                          ? 'bg-rose-500'
                          : label.includes('Severe')
                          ? 'bg-red-700'
                          : 'bg-pink-900'
                      }`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* SECTION 3: SCIENTIFIC DATA PROVENANCE (Collapsible) */}
      <div className="bg-[#0c121e]/95 backdrop-blur-md border border-slate-800 rounded-xl p-3 shadow-xl space-y-2">
        <button
          onClick={() => setShowProvenance(!showProvenance)}
          className="w-full flex items-center justify-between text-slate-300 hover:text-emerald-400 font-bold uppercase text-[11px] transition-colors"
        >
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-emerald-400" />
            <span>SCIENTIFIC PROVENANCE & DATUM</span>
          </div>
          {showProvenance ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showProvenance && (
          <div className="space-y-1.5 text-[10px] text-slate-400 pt-1 border-t border-slate-800">
            <div><strong className="text-slate-300">Dataset:</strong> {regionalStatistics?.dataset_name || 'NASA LOLA South Pole DEM'}</div>
            <div><strong className="text-slate-300">Reference Frame:</strong> MOON_ME (DE421)</div>
            <div><strong className="text-slate-300">Projection:</strong> South Polar Stereographic (R = 1,737,400 m)</div>
            <div><strong className="text-slate-300">Citation:</strong> {regionalStatistics?.citation || 'Barker et al., 2021/2023'}</div>
            <div className="p-2 rounded bg-[#070b12] border border-amber-900/40 text-amber-300/90 text-[9px] leading-relaxed">
              <strong className="text-amber-200 block mb-0.5">Scientific Caveat:</strong>
              Pixel spacing reflects nominal interpolation raster mesh. ~90% of pixels between orbital tracks are mathematically interpolated.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
