import React, { useState } from 'react';
import { X, Plus, AlertCircle } from 'lucide-react';
import { useScenarioStore } from '../../stores/scenarioStore';
import { PREDEFINED_SITES } from '../../stores/dynamicAnalysisStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ScenarioCreateModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const addScenario = useScenarioStore((state) => state.addScenario);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [siteId, setSiteId] = useState('site01');
  const [latitude, setLatitude] = useState(-89.4632);
  const [longitude, setLongitude] = useState(-137.4896);
  const [observerHeight, setObserverHeight] = useState(2.0);
  const [startIso, setStartIso] = useState('2026-10-04T12:00:00Z');
  const [endIso, setEndIso] = useState('2026-10-07T12:00:00Z');
  const [stepHours, setStepHours] = useState(2.0);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const ok = await addScenario({
        name,
        description,
        site_id: siteId,
        latitude,
        longitude,
        observer_height_m: observerHeight,
        start_timestamp_iso: startIso,
        end_timestamp_iso: endIso,
        step_interval_hours: stepHours,
      });

      if (ok) {
        onClose();
      } else {
        setError('Failed to create scenario. Please verify coordinates and DEM boundaries.');
      }
    } catch (err: any) {
      setError(err?.message || 'Scenario creation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSiteSelect = (id: string) => {
    setSiteId(id);
    const site = PREDEFINED_SITES.find((s) => s.id === id);
    if (site) {
      setLatitude(site.center.lat);
      setLongitude(site.center.lon);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-mono text-xs">
      <div className="bg-[#0c121e] border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-slate-100 text-sm">CREATE CANDIDATE MISSION SCENARIO</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 overflow-y-auto flex-1">
          {error && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Name & Description */}
          <div className="space-y-1">
            <label className="text-slate-400 text-[10px] uppercase font-bold">Scenario Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Connecting Ridge — Outpost Echo"
              className="w-full bg-[#070b12] border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-bold focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-slate-400 text-[10px] uppercase font-bold">Description / Mission Context</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Primary rover habitat zone with high solar illumination"
              className="w-full bg-[#070b12] border border-slate-700 rounded-lg px-3 py-1.5 text-slate-300 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Candidate DEM Site */}
          <div className="space-y-1">
            <label className="text-slate-400 text-[10px] uppercase font-bold">Verified NASA LOLA DEM Dataset</label>
            <select
              value={siteId}
              onChange={(e) => handleSiteSelect(e.target.value)}
              className="w-full bg-[#070b12] border border-slate-700 rounded-lg px-3 py-1.5 text-emerald-400 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="site01">Site 01 — Connecting Ridge (5 m/pixel LOLA DEM - Locally Available)</option>
            </select>
            <div className="text-[10px] text-slate-500">
              * Candidate locations must reside within the actual coverage extent of real NASA LOLA DEMs.
            </div>
          </div>

          {/* Lat / Lon */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-slate-400 text-[10px] uppercase font-bold">Observer Latitude (°)</label>
              <input
                type="number"
                step="0.0001"
                min="-89.8351"
                max="-89.0903"
                required
                value={latitude}
                onChange={(e) => setLatitude(parseFloat(e.target.value))}
                className="w-full bg-[#070b12] border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-bold focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[9px] text-slate-500">Bounds: -89.8351° to -89.0903°</span>
            </div>

            <div className="space-y-1">
              <label className="text-slate-400 text-[10px] uppercase font-bold">Observer Longitude (°)</label>
              <input
                type="number"
                step="0.0001"
                min="-171.4692"
                max="-101.8887"
                required
                value={longitude}
                onChange={(e) => setLongitude(parseFloat(e.target.value))}
                className="w-full bg-[#070b12] border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-bold focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[9px] text-slate-500">Bounds: -171.4692° to -101.8887°</span>
            </div>
          </div>

          {/* Eye Height */}
          <div className="space-y-1">
            <label className="text-slate-400 text-[10px] uppercase font-bold">Observer Eye / Antenna Height (m)</label>
            <div className="flex items-center gap-2">
              {[0, 1.0, 2.0, 10.0].map((h) => (
                <button
                  type="button"
                  key={h}
                  onClick={() => setObserverHeight(h)}
                  className={`px-3 py-1 rounded font-bold transition-all ${
                    observerHeight === h
                      ? 'bg-emerald-500 text-black'
                      : 'bg-[#070b12] text-slate-400 border border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {h} m
                </button>
              ))}
            </div>
          </div>

          {/* Start and End Timestamps */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-slate-400 text-[10px] uppercase font-bold">Start Epoch (UTC)</label>
              <input
                type="text"
                required
                value={startIso}
                onChange={(e) => setStartIso(e.target.value)}
                className="w-full bg-[#070b12] border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-400 text-[10px] uppercase font-bold">End Epoch (UTC)</label>
              <input
                type="text"
                required
                value={endIso}
                onChange={(e) => setEndIso(e.target.value)}
                className="w-full bg-[#070b12] border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-400 text-[10px] uppercase font-bold">Step (Hours)</label>
              <input
                type="number"
                min="0.5"
                max="24"
                step="0.5"
                required
                value={stepHours}
                onChange={(e) => setStepHours(parseFloat(e.target.value))}
                className="w-full bg-[#070b12] border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 font-bold"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold shadow-lg shadow-emerald-500/20 disabled:bg-slate-800 disabled:text-slate-500"
            >
              {isSubmitting ? 'CREATING...' : 'SAVE SCENARIO'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
