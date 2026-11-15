import { DialogSurface } from '../ui/DialogSurface';
import React, { useState, useEffect } from 'react';
import { X, Plus, AlertCircle, MapPin, CheckCircle2 } from 'lucide-react';
import { useScenarioStore } from '../../stores/scenarioStore';
import { PlainLanguageExplainer } from '../ui/PlainLanguageExplainer';

export interface ScenarioInitialValues {
  name?: string;
  description?: string;
  siteId?: string;
  latitude?: number;
  longitude?: number;
  observerHeight?: number;
  startIso?: string;
  endIso?: string;
  stepHours?: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialValues?: ScenarioInitialValues;
}

interface SitePreset {
  id: string;
  name: string;
  detail: string;
  latRange: { min: number; max: number };
  lonRange: { min: number; max: number };
  rois: { name: string; lat: number; lon: number; note: string }[];
}

const SITE_PRESETS: SitePreset[] = [
  {
    id: 'site01',
    name: 'Site 01 — Connecting Ridge',
    detail: 'Connecting Ridge between Shackleton and de Gerlache (5 m/px LOLA DEM)',
    latRange: { min: -89.8351, max: -89.0903 },
    lonRange: { min: -171.4692, max: -101.8887 },
    rois: [
      { name: 'NASA ROI #1 (Peak)', lat: -89.4387, lon: -137.0865, note: 'Elev ~1140m, slope 3.1°' },
      { name: 'NASA ROI #2 (Saddle)', lat: -89.4388, lon: -137.5471, note: 'Elev ~1150m, slope 2.8°' },
      { name: 'NASA ROI #4 (Plateau)', lat: -89.4527, lon: -137.1487, note: 'Elev ~1200m, slope 4.5°' },
    ],
  },
  {
    id: 'site04',
    name: 'Site 04 — Shackleton Rim',
    detail: 'South Pole / Shackleton Crater Rim Crest (5 m/px LOLA DEM)',
    latRange: { min: -89.7668, max: -89.4231 },
    lonRange: { min: -180.0, max: 180.0 },
    rois: [
      { name: 'NASA ROI #1 (Rim Crest)', lat: -89.7614, lon: -157.1156, note: 'Elev 1728m, slope 2.3°' },
      { name: 'NASA ROI #2 (South Ridge)', lat: -89.7717, lon: -156.5151, note: 'Elev 1733m, slope 4.7°' },
      { name: 'NASA ROI #3 (High Knoll)', lat: -89.7801, lon: -156.3202, note: 'Elev 1750m, slope 3.1°' },
    ],
  },
  {
    id: 'site11',
    name: 'Site 11 — de Gerlache Rim',
    detail: 'de Gerlache Crater Rim with high Earth line-of-sight (5 m/px LOLA DEM)',
    latRange: { min: -89.0162, max: -88.3335 },
    lonRange: { min: -81.1582, max: -51.5819 },
    rois: [
      { name: 'NASA ROI #1 (High Point)', lat: -88.6682, lon: -68.3820, note: 'Elev 1814m, slope 1.7°' },
      { name: 'NASA ROI #3 (Shoulder)', lat: -88.7031, lon: -68.4055, note: 'Elev 1781m, slope 2.4°' },
      { name: 'Center Crest', lat: -88.6834, lon: -67.9321, note: 'Elev 1650m, slope 3.2°' },
    ],
  },
];

export const ScenarioCreateModal: React.FC<Props> = ({ isOpen, onClose, initialValues }) => {
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

  useEffect(() => {
    if (isOpen && initialValues) {
      if (initialValues.name !== undefined) setName(initialValues.name);
      if (initialValues.description !== undefined) setDescription(initialValues.description);
      if (initialValues.siteId !== undefined) setSiteId(initialValues.siteId);
      if (initialValues.latitude !== undefined) setLatitude(initialValues.latitude);
      if (initialValues.longitude !== undefined) setLongitude(initialValues.longitude);
      if (initialValues.observerHeight !== undefined) setObserverHeight(initialValues.observerHeight);
      if (initialValues.startIso !== undefined) setStartIso(initialValues.startIso);
      if (initialValues.endIso !== undefined) setEndIso(initialValues.endIso);
      if (initialValues.stepHours !== undefined) setStepHours(initialValues.stepHours);
    }
  }, [isOpen, initialValues]);

  const currentPreset = SITE_PRESETS.find((s) => s.id === siteId) || SITE_PRESETS[0];

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
    const preset = SITE_PRESETS.find((s) => s.id === id);
    if (preset && preset.rois.length > 0) {
      setLatitude(preset.rois[0].lat);
      setLongitude(preset.rois[0].lon);
      if (!name || name.includes('—')) {
        setName(`${preset.name.split('—')[1]?.trim()} — Candidate`);
      }
    }
  };

  const handleApplyRoi = (roi: { name: string; lat: number; lon: number }) => {
    setLatitude(roi.lat);
    setLongitude(roi.lon);
    if (!name || name.includes('—')) {
      setName(`${currentPreset.name.split('—')[1]?.trim()} — ${roi.name}`);
    }
  };

  return (
    <DialogSurface
      label="Create a scenario"
      onClose={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-mono text-xs"
    >
      <div className="bg-[#0c121e] border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-slate-100 text-sm">
              CREATE CANDIDATE MISSION SCENARIO
            </span>
          </div>
          <button
            aria-label="Close dialog"
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
              placeholder="e.g. Shackleton Rim — Artemis Outpost"
              className="w-full bg-[#070b12] border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-bold focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-slate-400 text-[10px] uppercase font-bold">
              Description / Mission Context
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Primary habitat site on high ridge crest with persistent sunlight"
              className="w-full bg-[#070b12] border border-slate-700 rounded-lg px-3 py-1.5 text-slate-300 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Candidate DEM Site */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-slate-400 text-[10px] uppercase font-bold">
                Authentic NASA LOLA DEM Dataset (Product 78)
              </label>
              <PlainLanguageExplainer topic="coverage" compact />
            </div>
            <select
              value={siteId}
              onChange={(e) => handleSiteSelect(e.target.value)}
              className="w-full bg-[#070b12] border border-slate-700 rounded-lg px-3 py-2 text-emerald-400 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              {SITE_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.detail}
                </option>
              ))}
            </select>
            <div className="text-[10px] text-slate-400 mt-1">
              {currentPreset.detail}
            </div>
          </div>

          {/* Quick NASA ROI presets */}
          <div className="bg-[#070b14] border border-slate-800 p-2.5 rounded-lg space-y-1.5">
            <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center justify-between">
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-emerald-400" />
                NASA ROI Shapefile Landmarks (Quick Fill):
              </span>
              <span className="text-emerald-400 text-[9px]">Authentic Centroids</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {currentPreset.rois.map((roi) => (
                <button
                  type="button"
                  key={roi.name}
                  onClick={() => handleApplyRoi(roi)}
                  className="px-2.5 py-1 bg-slate-900 hover:bg-emerald-500/20 hover:border-emerald-500/50 border border-slate-700 rounded text-[11px] text-slate-200 hover:text-emerald-300 transition-colors flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>{roi.name}</span>
                  <span className="text-[9px] text-slate-500">({roi.note})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Lat / Lon */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-slate-400 text-[10px] uppercase font-bold">
                Observer Latitude (°)
              </label>
              <input
                type="number"
                step="0.0001"
                min={currentPreset.latRange.min}
                max={currentPreset.latRange.max}
                required
                value={latitude}
                onChange={(e) => setLatitude(parseFloat(e.target.value))}
                className="w-full bg-[#070b12] border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-bold focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[9px] text-slate-500">
                Coverage: {currentPreset.latRange.min}° to {currentPreset.latRange.max}°
              </span>
            </div>

            <div className="space-y-1">
              <label className="text-slate-400 text-[10px] uppercase font-bold">
                Observer Longitude (°)
              </label>
              <input
                type="number"
                step="0.0001"
                min={currentPreset.lonRange.min}
                max={currentPreset.lonRange.max}
                required
                value={longitude}
                onChange={(e) => setLongitude(parseFloat(e.target.value))}
                className="w-full bg-[#070b12] border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-bold focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[9px] text-slate-500">
                Coverage: {currentPreset.lonRange.min}° to {currentPreset.lonRange.max}°
              </span>
            </div>
          </div>

          {/* Eye Height */}
          <div className="space-y-1">
            <label className="text-slate-400 text-[10px] uppercase font-bold">
              Observer Eye / Antenna Height (m)
            </label>
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
              aria-label="Close dialog"
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
    </DialogSurface>
  );
};
