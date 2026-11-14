import React from 'react';
import { useTerrainAssessmentStore } from '../../stores/terrainAssessmentStore';
import {
  X,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Info,
} from 'lucide-react';

export const TerrainDetailDrawer: React.FC = () => {
  const isDetailOpen = useTerrainAssessmentStore((state) => state.isDetailOpen);
  const activeAssessment = useTerrainAssessmentStore((state) => state.activeAssessment);
  const selectedCandidateId = useTerrainAssessmentStore((state) => state.selectedCandidateId);
  const closeDetailDrawer = useTerrainAssessmentStore((state) => state.closeDetailDrawer);

  if (!isDetailOpen || !activeAssessment) return null;

  const candidate = activeAssessment.candidates.find(
    (c) => c.candidate_id === selectedCandidateId
  ) || activeAssessment.candidates[0];

  if (!candidate) return null;

  const c = candidate;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#0b101c] border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 sticky top-0 bg-[#0b101c]/95 backdrop-blur z-10">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-mono font-bold text-white tracking-wide">
                  {c.candidate_name}
                </h2>
                <span className="text-xs font-mono text-slate-400">
                  ({c.site_id})
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Lat: {c.latitude.toFixed(4)}° • Lon: {c.longitude.toFixed(4)}° • Radius: {c.data_quality.requested_radius_m} m
              </span>
            </div>

            {c.overall_status === 'COMPLIANT' && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>COMPLIANT</span>
              </span>
            )}
            {c.overall_status === 'NON_COMPLIANT' && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono font-semibold">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>NON-COMPLIANT</span>
              </span>
            )}
            {c.overall_status === 'INDETERMINATE' && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>INDETERMINATE</span>
              </span>
            )}
          </div>

          <button
            onClick={closeDetailDrawer}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Metadata Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800 text-xs font-mono">
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                Evaluated Mission Profile
              </span>
              <span className="text-slate-200 font-semibold mt-1 block">
                {activeAssessment.profile_name}
              </span>
              <span className="text-[10px] text-slate-500 block">
                Version {activeAssessment.profile_version}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                DEM Dataset
              </span>
              <span className="text-slate-200 font-semibold mt-1 block">
                {activeAssessment.dataset_metadata.name || 'Site 01 (Connecting Ridge)'}
              </span>
              <span className="text-[10px] text-slate-500 block">
                NASA LOLA 5 m/px Grid
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                Footprint Coverage
              </span>
              <span className="text-emerald-400 font-semibold mt-1 block">
                {c.data_quality.coverage_status} ({c.data_quality.valid_data_percentage}%)
              </span>
              <span className="text-[10px] text-slate-500 block">
                {c.data_quality.valid_pixels_in_footprint} valid 5m pixels
              </span>
            </div>
          </div>

          {/* Hard Constraints Table */}
          <div className="space-y-3">
            <h3 className="text-xs font-mono font-bold text-white tracking-wide flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>HARD CONSTRAINTS EVALUATION MATRIX</span>
            </h3>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
                    <th className="py-2.5 px-3">Parameter</th>
                    <th className="py-2.5 px-3">Target Condition</th>
                    <th className="py-2.5 px-3">Measured Value</th>
                    <th className="py-2.5 px-3 text-center">Verdict</th>
                    <th className="py-2.5 px-3">Evaluation Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/30">
                  {c.hard_constraint_results.map((r, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 text-slate-200 font-medium">
                        {r.requirement_name}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {r.operator} {r.threshold_str}
                      </td>
                      <td className="py-2.5 px-3 text-slate-200 font-semibold">
                        {r.actual_value_str}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {r.verdict === 'PASS' && (
                          <span className="inline-block px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-semibold">
                            PASS
                          </span>
                        )}
                        {r.verdict === 'FAIL' && (
                          <span className="inline-block px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-semibold">
                            FAIL
                          </span>
                        )}
                        {r.verdict === 'INDETERMINATE' && (
                          <span className="inline-block px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-semibold">
                            INDETERMINATE
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                        {r.explanation}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Soft Preferences & Informational Metrics */}
          {(c.soft_preference_results.length > 0 || c.informational_metrics.length > 0) && (
            <div className="space-y-3">
              <h3 className="text-xs font-mono font-bold text-slate-300 tracking-wide">
                SOFT PREFERENCES & INFORMATIONAL METRICS
              </h3>
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
                      <th className="py-2.5 px-3">Parameter</th>
                      <th className="py-2.5 px-3">Classification</th>
                      <th className="py-2.5 px-3">Target / Preference</th>
                      <th className="py-2.5 px-3">Measured Value</th>
                      <th className="py-2.5 px-3">Explanation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/30">
                    {[...c.soft_preference_results, ...c.informational_metrics].map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="py-2.5 px-3 text-slate-200">{r.requirement_name}</td>
                        <td className="py-2.5 px-3 text-sky-400 text-[10px]">{r.classification}</td>
                        <td className="py-2.5 px-3 text-slate-400">{r.threshold_str}</td>
                        <td className="py-2.5 px-3 text-slate-200 font-semibold">{r.actual_value_str}</td>
                        <td className="py-2.5 px-3 text-slate-400 text-[11px]">{r.explanation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Mandatory Scientific Disclaimers */}
          <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-mono font-semibold">
              <Info className="w-4 h-4 shrink-0" />
              <span>MANDATORY SCIENTIFIC ACCURACY DISCLAIMERS</span>
            </div>
            <ul className="text-[11px] font-mono text-amber-300/80 space-y-1 list-disc list-inside">
              <li>
                Elevation is not landing safety. Measurements are referenced to the IAU Moon 2000 Sphere (R = 1,737,400.0 m), not spacecraft altitude.
              </li>
              <li>
                Slope is not rover traversability. Geomorphic slope alone does not guarantee boulder clearance or regolith trafficability.
              </li>
              <li>
                Terrain roughness is not a substitute for boulder detection. Meter-scale obstacles are below DEM pixel resolution.
              </li>
              <li>
                A digital elevation model does not establish subsurface mechanical properties or bearing strength.
              </li>
              <li>
                A 5 m nominal grid spacing does not guarantee 5 m effective measurement resolution (~90% interpolated).
              </li>
              <li>
                A point measurement does not certify the suitability of an entire landing footprint.
              </li>
              <li>
                Partial DEM coverage cannot certify the missing terrain.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
