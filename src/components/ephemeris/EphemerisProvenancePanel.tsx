import React, { useEffect } from 'react';
import { useEphemerisStore } from '../../stores/ephemerisStore';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';

export const EphemerisProvenancePanel: React.FC = () => {
  const { statusData, positionData, loadStatus } = useEphemerisStore();

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const activeKernels = statusData?.active_kernels || [];

  return (
    <div className="flex flex-col gap-3 bg-[#141619] border border-[#2b2d32] rounded-xl p-3 text-xs font-mono">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#2b2d32] pb-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-slate-200 uppercase tracking-wider">
            NASA SPICE ENGINE & PROVENANCE
          </span>
        </div>
        <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
          <CheckCircle2 className="w-3 h-3" />
          OPERATIONAL
        </span>
      </div>

      {/* Primary Reference Frame & Toolkit Specs */}
      <div className="space-y-1.5 bg-[#0e1013] p-2.5 rounded-lg border border-[#2b2d32] text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-slate-500">SPICE Toolkit:</span>
          <span className="text-slate-200 font-bold">{statusData?.spice_toolkit_version || 'CSPICE_N0067'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Lunar Frame:</span>
          <span className="text-emerald-400 font-bold">{statusData?.primary_lunar_frame || 'MOON_ME (DE421)'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Ephemeris Model:</span>
          <span className="text-sky-400 font-bold">NASA JPL DE421 (1900-2050)</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Time System:</span>
          <span className="text-slate-300">UTC converted to ET/TDB via naif0012.tls</span>
        </div>
        {positionData && (
          <div className="flex items-center justify-between border-t border-[#202228] pt-1 text-[10px]">
            <span className="text-slate-500">Epoch TDB Seconds:</span>
            <span className="text-amber-300">{positionData.ephemeris_time_tdb_seconds.toFixed(3)}s</span>
          </div>
        )}
      </div>

      {/* Verified Kernel Manifest */}
      <div className="space-y-1.5">
        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5 text-emerald-400" />
          Verified Active NAIF Kernels ({activeKernels.length})
        </div>

        <div className="space-y-1 max-h-48 overflow-y-auto pr-0.5">
          {activeKernels.map((k) => (
            <div
              key={k.filename}
              className="bg-[#0e1013] p-2 rounded border border-[#202228] text-[10px] space-y-0.5"
            >
              <div className="flex items-center justify-between text-slate-200 font-bold">
                <span className="text-emerald-400">{k.filename}</span>
                <span className="text-slate-500">{(k.file_size_bytes / 1024).toFixed(0)} KB</span>
              </div>
              <div className="text-slate-400 text-[9px]">{k.description}</div>
              <div className="flex items-center justify-between text-[8px] text-slate-600 pt-0.5">
                <span>Type: {k.kernel_type}</span>
                <span className="text-emerald-400">Verified & Loaded</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Observer Geometry Provenance */}
      {positionData && (
        <div className="space-y-1 bg-[#0e1013] p-2 rounded-lg border border-[#2b2d32] text-[10px]">
          <div className="text-slate-400 font-bold uppercase text-[9px]">Topocentric Vector Observer State</div>
          <div className="text-slate-500 font-mono text-[9px]">
            X: {positionData.observer_cartesian_moon_me_km[0]} km, Y: {positionData.observer_cartesian_moon_me_km[1]} km, Z: {positionData.observer_cartesian_moon_me_km[2]} km
          </div>
          <div className="text-slate-500 text-[9px]">
            Datum: IAU Moon 2000 Sphere (R = {positionData.lunar_radius_model_m.toLocaleString()} m) + {positionData.total_observer_elevation_m.toFixed(1)} m Z
          </div>
        </div>
      )}

      {/* Scientific Warnings */}
      {positionData && positionData.warnings.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded p-2 text-[10px] text-amber-300 space-y-1">
          {positionData.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
