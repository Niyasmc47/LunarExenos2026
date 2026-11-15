import React, { useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useDynamicAnalysisStore } from '../../stores/dynamicAnalysisStore';
import { useLocationStore } from '../../stores/locationStore';
import { fetchTransectProfile } from '../../services/dynamicAnalysisApi';
import {
  Activity,
  Download,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

export const DynamicElevationProfile: React.FC = () => {
  const transectStart = useDynamicAnalysisStore((state) => state.transectStart);
  const transectEnd = useDynamicAnalysisStore((state) => state.transectEnd);
  const activeDatasetId = useDynamicAnalysisStore((state) => state.activeDatasetId);
  const transectProfile = useDynamicAnalysisStore((state) => state.transectProfile);
  const setTransectProfile = useDynamicAnalysisStore((state) => state.setTransectProfile);
  const profileLoading = useDynamicAnalysisStore((state) => state.profileLoading);
  const setProfileLoading = useDynamicAnalysisStore((state) => state.setProfileLoading);

  const setSelectedCoordinates = useLocationStore((state) => state.setSelectedCoordinates);

  // Fetch transect profile when start/end/dataset changes
  useEffect(() => {
    if (!transectStart || !transectEnd) return;

    setProfileLoading(true);
    fetchTransectProfile(
      activeDatasetId,
      transectStart.lat,
      transectStart.lon,
      transectEnd.lat,
      transectEnd.lon,
      140
    )
      .then((resp) => {
        if (resp) setTransectProfile(resp);
      })
      .finally(() => setProfileLoading(false));
  }, [transectStart, transectEnd, activeDatasetId]);

  const chartData = (transectProfile?.samples || []).map((s) => ({
    distKm: s.distance_km,
    elevation: s.elevation_m !== null && s.elevation_m !== undefined ? Math.round(s.elevation_m) : null,
    slope: s.slope_deg !== null && s.slope_deg !== undefined ? s.slope_deg.toFixed(1) : null,
    lat: s.latitude,
    lon: s.longitude,
  }));

  const handleChartClick = (e: any) => {
    if (e && e.activePayload && e.activePayload.length > 0) {
      const pt = e.activePayload[0].payload;
      if (pt && typeof pt.lat === 'number' && typeof pt.lon === 'number') {
        setSelectedCoordinates(pt.lat, pt.lon, 'map');
      }
    }
  };

  const handleExportCsv = async () => {
    if (!transectStart || !transectEnd) return;
    try {
      const res = await fetch('http://127.0.0.1:8000/api/exports/profile-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataset_id: activeDatasetId,
          start_latitude: transectStart.lat,
          start_longitude: transectStart.lon,
          end_latitude: transectEnd.lat,
          end_longitude: transectEnd.lon,
          num_samples: 150,
        }),
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lunavista_transect_${activeDatasetId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error('Error exporting CSV:', err);
    }
  };

  return (
    <div className="bg-[#141619] backdrop-blur-md border border-[#2b2d32] rounded-xl p-3 flex flex-col h-full shadow-xl text-xs font-mono">
      {/* Top Header & Metrics Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2b2d32] pb-2 mb-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-slate-200 uppercase tracking-wider">
            SCIENTIFIC ELEVATION TRANSECT
          </span>
          {profileLoading && <RefreshCw className="w-3 h-3 text-emerald-400 animate-spin ml-1" />}
        </div>

        <button
          onClick={handleExportCsv}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0e1013] hover:bg-slate-800 border border-[#303238] text-slate-300 hover:text-emerald-400 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span>EXPORT TRANSECT CSV</span>
        </button>
      </div>

      {/* Numerical Metrics Summary Pills */}
      {transectProfile && (
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-1.5 mb-2 text-[11px]">
          <div className="bg-[#0e1013] p-1.5 rounded border border-[#2b2d32] flex justify-between items-center">
            <span className="text-slate-500">DISTANCE:</span>
            <span className="text-slate-200 font-bold">{transectProfile.total_distance_km} km</span>
          </div>

          <div className="bg-[#0e1013] p-1.5 rounded border border-[#2b2d32] flex justify-between items-center">
            <span className="text-slate-500">MAX ELEV:</span>
            <span className="text-emerald-400 font-bold">
              {transectProfile.elevation_max_m !== null ? `+${transectProfile.elevation_max_m} m` : 'N/A'}
            </span>
          </div>

          <div className="bg-[#0e1013] p-1.5 rounded border border-[#2b2d32] flex justify-between items-center">
            <span className="text-slate-500">MIN ELEV:</span>
            <span className="text-cyan-400 font-bold">
              {transectProfile.elevation_min_m !== null ? `${transectProfile.elevation_min_m} m` : 'N/A'}
            </span>
          </div>

          <div className="bg-[#0e1013] p-1.5 rounded border border-[#2b2d32] flex justify-between items-center">
            <span className="text-slate-500">RELIEF ΔH:</span>
            <span className="text-amber-400 font-bold">
              {transectProfile.total_relief_m !== null ? `${transectProfile.total_relief_m} m` : 'N/A'}
            </span>
          </div>

          <div className="bg-[#0e1013] p-1.5 rounded border border-[#2b2d32] flex justify-between items-center">
            <span className="text-slate-500 flex items-center gap-0.5"><ArrowUpRight className="w-3 h-3 text-emerald-400" /> GAIN:</span>
            <span className="text-emerald-400 font-bold">
              {transectProfile.elevation_gain_m !== null ? `+${transectProfile.elevation_gain_m} m` : 'N/A'}
            </span>
          </div>

          <div className="bg-[#0e1013] p-1.5 rounded border border-[#2b2d32] flex justify-between items-center">
            <span className="text-slate-500 flex items-center gap-0.5"><ArrowDownRight className="w-3 h-3 text-rose-400" /> LOSS:</span>
            <span className="text-rose-400 font-bold">
              {transectProfile.elevation_loss_m !== null ? `-${transectProfile.elevation_loss_m} m` : 'N/A'}
            </span>
          </div>
        </div>
      )}

      {/* Chart Canvas */}
      <div className="flex-1 w-full min-h-[140px]">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} onClick={handleChartClick} margin={{ top: 5, right: 15, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="transectElevationGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.65} />
                  <stop offset="95%" stopColor="#047857" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="distKm" stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} unit=" km" />
              <YAxis stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} unit="m" domain={['auto', 'auto']} />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-[#0e1013] border border-[#303238] p-2 rounded-lg text-xs font-mono shadow-xl">
                        <div className="text-emerald-400 font-bold">
                          Elevation: {data.elevation !== null ? `${data.elevation > 0 ? '+' : ''}${data.elevation} m` : 'N/A'}
                        </div>
                        <div className="text-slate-300">Distance: {data.distKm} km</div>
                        {data.slope && <div className="text-amber-400">Slope: {data.slope}°</div>}
                        <div className="text-[10px] text-slate-500 mt-1">
                          {data.lat.toFixed(4)}°, {data.lon.toFixed(4)}°
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area type="monotone" dataKey="elevation" stroke="#10b981" strokeWidth={2} fill="url(#transectElevationGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500">
            Sampling elevation transect from NASA DEM...
          </div>
        )}
      </div>
    </div>
  );
};
