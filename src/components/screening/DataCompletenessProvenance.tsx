import React from 'react';
import { CandidateScreeningSummary } from '../../types/screening';
import { ShieldCheck, Database, Orbit, AlertTriangle } from 'lucide-react';

interface DataCompletenessProvenanceProps {
  candidate: CandidateScreeningSummary;
}

export const DataCompletenessProvenance: React.FC<DataCompletenessProvenanceProps> = ({ candidate }) => {
  const { dem_provenance, spice_provenance, scientific_disclaimers, warnings } = candidate;

  return (
    <div className="space-y-4 bg-[#0b101c] border border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-bold text-slate-100 font-mono tracking-wider">
            DATA COMPLETENESS & PROVENANCE
          </h3>
        </div>
        <span className="text-[10px] font-mono text-slate-400">
          Coverage: {candidate.coverage_certainty}
        </span>
      </div>

      {warnings && warnings.length > 0 && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs font-mono text-amber-300 space-y-1">
          <div className="flex items-center gap-1.5 font-bold">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>Candidate Data Warnings</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-200/90 pl-1">
            {warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
        {/* DEM Provenance */}
        <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-lg space-y-2">
          <div className="flex items-center gap-1.5 text-slate-300 font-bold">
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span>Digital Elevation Model (DEM)</span>
          </div>
          <div className="space-y-1 text-[11px] text-slate-400">
            <div>
              <span className="text-slate-400">Product:</span>{' '}
              <span className="text-slate-200">{dem_provenance.product_name || 'NASA LOLA 5 m DEM'}</span>
            </div>
            <div>
              <span className="text-slate-400">Citation:</span>{' '}
              <span className="text-slate-200">{dem_provenance.citation || 'Barker et al. (2016)'}</span>
            </div>
            <div>
              <span className="text-slate-400">Resolution:</span>{' '}
              <span className="text-slate-200">{dem_provenance.grid_resolution_m || 5.0} m/pixel</span>
            </div>
            <div>
              <span className="text-slate-400">Vertical Datum:</span>{' '}
              <span className="text-slate-200">{dem_provenance.vertical_datum || 'IAU Moon 2000 Sphere'}</span>
            </div>
          </div>
        </div>

        {/* SPICE Ephemeris Provenance */}
        <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-lg space-y-2">
          <div className="flex items-center gap-1.5 text-slate-300 font-bold">
            <Orbit className="w-3.5 h-3.5 text-amber-400" />
            <span>NASA SPICE Toolkit & Reference Frame</span>
          </div>
          <div className="space-y-1 text-[11px] text-slate-400">
            <div>
              <span className="text-slate-400">Frame:</span>{' '}
              <span className="text-slate-200">{spice_provenance.reference_frame || 'MOON_ME (DE421)'}</span>
            </div>
            <div>
              <span className="text-slate-400">Ephemeris Model:</span>{' '}
              <span className="text-slate-200">{spice_provenance.ephemeris_model || 'NASA JPL DE421'}</span>
            </div>
            <div>
              <span className="text-slate-400">Observer:</span>{' '}
              <span className="text-slate-200">{spice_provenance.target_observer || 'Topocentric Lunar Surface'}</span>
            </div>
            <div>
              <span className="text-slate-400">Toolkit:</span>{' '}
              <span className="text-slate-200">{spice_provenance.spice_toolkit || 'CSPICE_N0067'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mandatory Scientific Disclaimers & NASA Provenance */}
      <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 space-y-2 font-sans">
        <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-lg space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-emerald-400 uppercase font-bold">
              NASA Product 78 (PGDA) Provenance & LOLA Track Disclosure
            </span>
            <a
              href="https://pgda.gsfc.nasa.gov/products/78"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 underline"
            >
              pgda.gsfc.nasa.gov/products/78 ↗
            </a>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Data sourced from NASA Planetary Geology, Geophysics and Geochemistry Laboratory LOLA 5 mpp products (Barker et al., 2021).
            <strong> Notice:</strong> While rasters have a nominal 5 m/pixel grid spacing, the Lunar Reconnaissance Orbiter (LRO) LOLA laser altimeter ground tracks were spaced 10–20+ metres apart near the pole.
            Approximately 85–90% of raster cell values represent along-track interpolation between laser observations. Refer to companion observation count (LDEC) and uncertainty (toterr/slperr) layers for localized accuracy.
          </p>
        </div>

        <span className="font-mono text-[10px] text-slate-400 uppercase font-semibold block">
          Mandatory Scientific Disclaimers:
        </span>
        <ul className="space-y-1 list-disc list-inside">
          {scientific_disclaimers.map((d, idx) => (
            <li key={idx} className="leading-relaxed">
              {d}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
