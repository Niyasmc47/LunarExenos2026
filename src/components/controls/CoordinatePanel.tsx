import React, { useState, useEffect } from 'react';
import { useLocationStore } from '../../stores/locationStore';
import {
  validateCoordinates,
  formatCoordinates,
  formatLatitude,
  formatLongitude,
  LUNAR_PRESETS,
  lunarHaversineDistance,
} from '../../utils/lunarCoordinates';
import {
  Crosshair,
  MapPin,
  RotateCcw,
  Send,
  AlertCircle,
  CheckCircle2,
  Bookmark,
} from 'lucide-react';

export const CoordinatePanel: React.FC = () => {
  const selectedLatitude = useLocationStore((state) => state.selectedLatitude);
  const selectedLongitude = useLocationStore((state) => state.selectedLongitude);
  const selectedLocationSource = useLocationStore((state) => state.selectedLocationSource);
  const setSelectedCoordinates = useLocationStore((state) => state.setSelectedCoordinates);
  const resetToDefault = useLocationStore((state) => state.resetToDefault);

  // Local form state
  const [latInput, setLatInput] = useState<string>(selectedLatitude.toFixed(4));
  const [lonInput, setLonInput] = useState<string>(selectedLongitude.toFixed(4));
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sync inputs when external selection happens (map click, globe click, preset)
  useEffect(() => {
    setLatInput(selectedLatitude.toFixed(4));
    setLonInput(selectedLongitude.toFixed(4));
    setValidationError(null);
  }, [selectedLatitude, selectedLongitude]);

  const handleApply = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const lat = parseFloat(latInput.trim());
    const lon = parseFloat(lonInput.trim());

    const validation = validateCoordinates(lat, lon);
    if (!validation.valid) {
      setValidationError(validation.error || 'Invalid coordinates');
      setSuccessMessage(null);
      return;
    }

    setValidationError(null);
    setSelectedCoordinates(lat, lon, 'manual');
    setSuccessMessage('Coordinates applied successfully');
    setTimeout(() => setSuccessMessage(null), 2500);
  };

  const handleSelectPreset = (presetId: string) => {
    const preset = LUNAR_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    setSelectedCoordinates(preset.latitude, preset.longitude, 'preset');
    setLatInput(preset.latitude.toFixed(4));
    setLonInput(preset.longitude.toFixed(4));
    setValidationError(null);
  };

  // Distance from Sub-Earth point (0, 0)
  const distFromCenter = lunarHaversineDistance(
    { latitude: 0, longitude: 0 },
    { latitude: selectedLatitude, longitude: selectedLongitude }
  );

  return (
    <div className="flex flex-col gap-4 bg-[#0c121e]/95 backdrop-blur-md border border-slate-800 rounded-xl p-4 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Crosshair className="w-4 h-4 text-emerald-400" />
          <h2 className="text-xs font-bold tracking-wider uppercase text-slate-200 font-mono">
            COORDINATE CONTROLS
          </h2>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
          <span>SOURCE:</span>
          <span className="text-emerald-400 uppercase font-semibold">
            {selectedLocationSource}
          </span>
        </div>
      </div>

      {/* Manual Input Form */}
      <form onSubmit={handleApply} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1 flex items-center justify-between">
              <span>LATITUDE (°N/S)</span>
              <span className="text-[10px] text-slate-500">[-90, +90]</span>
            </label>
            <input
              type="number"
              step="any"
              value={latInput}
              onChange={(e) => {
                setLatInput(e.target.value);
                setValidationError(null);
              }}
              className="w-full bg-[#070b12] border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 placeholder-slate-600 outline-none transition-colors"
              placeholder="e.g. 0.6741"
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1 flex items-center justify-between">
              <span>LONGITUDE (°E/W)</span>
              <span className="text-[10px] text-slate-500">[-180, +180]</span>
            </label>
            <input
              type="number"
              step="any"
              value={lonInput}
              onChange={(e) => {
                setLonInput(e.target.value);
                setValidationError(null);
              }}
              className="w-full bg-[#070b12] border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 placeholder-slate-600 outline-none transition-colors"
              placeholder="e.g. 23.4730"
            />
          </div>
        </div>

        {/* Validation Error Message */}
        {validationError && (
          <div className="flex items-center gap-1.5 text-xs text-red-400 font-mono bg-red-950/40 border border-red-800/60 p-2 rounded-lg">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Success Feedback */}
        {successMessage && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono bg-emerald-950/40 border border-emerald-800/60 p-2 rounded-lg">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Form Action Buttons */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold px-3 py-2 rounded-lg text-xs font-mono transition-all shadow-md hover:shadow-emerald-900/40"
          >
            <Send className="w-3.5 h-3.5" />
            <span>APPLY COORDINATES</span>
          </button>

          <button
            type="button"
            onClick={resetToDefault}
            title="Reset to Apollo 11 default coordinates"
            className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-lg text-xs font-mono transition-colors border border-slate-700"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>RESET</span>
          </button>
        </div>
      </form>

      {/* Quick Presets / Landing Sites */}
      <div className="pt-2 border-t border-slate-800">
        <label className="block text-[11px] font-mono text-slate-400 mb-2 flex items-center gap-1.5">
          <Bookmark className="w-3.5 h-3.5 text-emerald-400" />
          <span>LUNAR TARGET PRESETS</span>
        </label>
        <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
          {LUNAR_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleSelectPreset(preset.id)}
              className="flex flex-col text-left p-2 rounded-lg bg-[#070b12] hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 transition-colors group"
            >
              <span className="text-[11px] font-semibold text-slate-300 group-hover:text-emerald-400 truncate">
                {preset.name}
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                {formatLatitude(preset.latitude, 2)}, {formatLongitude(preset.longitude, 2)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Target Telemetry Summary Card */}
      <div className="bg-[#070b12] border border-slate-800 rounded-lg p-3 text-xs font-mono">
        <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-slate-800/80">
          <span className="flex items-center gap-1.5 text-[11px]">
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            TARGET TELEMETRY
          </span>
          <span className="text-[10px] text-slate-500">MOON MEAN R = 1,737.4 KM</span>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2.5">
          <div>
            <div className="text-[10px] text-slate-500">FORMATTED</div>
            <div className="text-emerald-400 font-semibold text-[11px] truncate">
              {formatCoordinates({ latitude: selectedLatitude, longitude: selectedLongitude }, 4)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500">DECIMAL (LAT, LON)</div>
            <div className="text-slate-300 text-[11px] truncate">
              {selectedLatitude.toFixed(5)}, {selectedLongitude.toFixed(5)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500">DISTANCE TO SUB-EARTH</div>
            <div className="text-slate-300 text-[11px]">
              {distFromCenter.toFixed(1)} km
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500">HEMISPHERE</div>
            <div className="text-slate-300 text-[11px]">
              {selectedLongitude >= -90 && selectedLongitude <= 90 ? 'Near Side' : 'Far Side'} /{' '}
              {selectedLatitude >= 0 ? 'North' : 'South'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
