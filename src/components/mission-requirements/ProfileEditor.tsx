import React, { useEffect } from 'react';
import { useMissionProfileStore } from '../../stores/missionProfileStore';
import { RequirementCard } from './RequirementCard';
import {
  Edit3,
  Save,
  X,
  Copy,
  Trash2,
  Clock,
  Sun,
  Radio,
  Mountain,
  AlertTriangle,
  CheckCircle2,
  Info,
  Sparkles,
} from 'lucide-react';

export const ProfileEditor: React.FC = () => {
  const activeProfile = useMissionProfileStore((state) => state.activeProfile);
  const isEditing = useMissionProfileStore((state) => state.isEditing);
  const isCreating = useMissionProfileStore((state) => state.isCreating);
  const draftProfile = useMissionProfileStore((state) => state.draftProfile);
  const validation = useMissionProfileStore((state) => state.validation);
  const saving = useMissionProfileStore((state) => state.saving);
  const error = useMissionProfileStore((state) => state.error);
  const startEdit = useMissionProfileStore((state) => state.startEdit);
  const cancelEdit = useMissionProfileStore((state) => state.cancelEdit);
  const updateDraftField = useMissionProfileStore((state) => state.updateDraftField);
  const updateRequirement = useMissionProfileStore((state) => state.updateRequirement);
  const saveDraft = useMissionProfileStore((state) => state.saveDraft);
  const duplicateProfile = useMissionProfileStore((state) => state.duplicateProfile);
  const deleteProfile = useMissionProfileStore((state) => state.deleteProfile);

  const profile = isEditing ? draftProfile : activeProfile;

  useEffect(() => {
    if (isEditing) {
      useMissionProfileStore.getState().validateDraft();
    }
  }, [isEditing]);

  if (!profile || !profile.requirements) {
    return (
      <div className="mission-empty flex-1 flex items-center justify-center bg-[#0e1013] text-slate-400 font-mono text-sm">
        Choose a saved profile, or create one with your mission duration, equipment, and safety limits.
      </div>
    );
  }

  const getFieldError = (fieldKey: string) => {
    return validation?.errors.find((e) => e.field === fieldKey)?.message;
  };

  return (
    <div className="profile-editor flex-1 flex flex-col h-full bg-[#0e1013] overflow-hidden">
      {/* Top Action Header */}
      <div className="px-6 py-4 border-b border-[#2b2d32] bg-[#141619] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-100 font-mono tracking-wide">
                {isEditing ? (
                  <input
                    type="text"
                    value={profile.name}
                    onChange={(e) => updateDraftField('name', e.target.value)}
                    aria-label="Mission profile name" placeholder="Name your mission profile"
                    className="bg-[#08090b] border border-[#303238] text-slate-100 px-2.5 py-1 rounded text-sm font-mono focus:outline-none focus:border-[#ffe3b0] w-full min-w-0"
                  />
                ) : (
                  profile.name
                )}
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-[#303238]">
                v{profile.version}
              </span>
              {profile.is_template && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Illustrative Template
                </span>
              )}
            </div>
            <span className="text-xs text-slate-400 font-sans mt-0.5">
              Last updated {new Date(profile.updated_at_iso).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                onClick={cancelEdit}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-medium border border-[#303238] transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
              <button
                onClick={() => saveDraft()}
                disabled={Boolean(saving || (validation && !validation.is_valid))}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                  validation && !validation.is_valid
                    ? 'bg-slate-800 text-slate-400 border border-[#303238] cursor-not-allowed'
                    : 'bg-[#ffe3b0] hover:bg-[#ffdea3] text-[#141619] shadow-md shadow-[#ffe3b0]/20'
                }`}
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Saving...' : isCreating ? 'Create Profile' : 'Save Changes'}</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => duplicateProfile(profile.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#191b20] hover:bg-[#202228] text-slate-300 text-xs font-mono border border-[#2b2d32] transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Duplicate</span>
              </button>
              <button
                onClick={startEdit}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#ffe3b0]/15 hover:bg-[#ffe3b0] text-[#ffe3b0] hover:text-[#141619] text-xs font-mono font-bold border border-[#ffe3b0]/40 hover:border-[#ffe3b0] transition-all"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>
              {!profile.is_template && (
                <button
                  onClick={() => {
                    if (confirm(`Delete mission profile "${profile.name}"?`)) {
                      deleteProfile(profile.id);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white text-xs font-mono border border-rose-500/30 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main Form Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Global Error Banner */}
        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-mono flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Section 1: Mission Parameters & Time Horizon */}
        <div className="bg-[#141619] border border-[#2b2d32] rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[#202228]">
            <Clock className="w-4 h-4 text-[#ffe3b0]" />
            <h2 className="text-xs font-bold text-slate-100 font-mono tracking-wider">
              1. Mission basics & schedule
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Mission Type */}
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">
                Mission Type
              </label>
              {isEditing ? (
                <select
                  value={profile.mission_type}
                  onChange={(e) => updateDraftField('mission_type', e.target.value as any)}
                  className="w-full bg-[#08090b] border border-[#303238] text-slate-200 text-xs font-mono px-3 py-2 rounded-lg focus:outline-none focus:border-[#ffe3b0]"
                >
                  <option value="robotic_exploration">Robotic Exploration Rover</option>
                  <option value="robotic_lander">Robotic Static Lander</option>
                  <option value="crewed_surface">Crewed Surface Mission</option>
                  <option value="long_duration_station">Long-Duration Scientific Station</option>
                  <option value="custom">Custom Mission</option>
                </select>
              ) : (
                <div className="text-xs font-mono text-slate-200 bg-[#08090b] border border-[#202228] px-3 py-2 rounded-lg capitalize">
                  {profile.mission_type.replace('_', ' ')}
                </div>
              )}
            </div>

            {/* Mission Duration */}
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">
                Duration (Days)
              </label>
              {isEditing ? (
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="90"
                  value={profile.duration_days}
                  onChange={(e) => updateDraftField('duration_days', parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#08090b] border border-[#303238] text-[#ffe3b0] text-xs font-mono px-3 py-2 rounded-lg focus:outline-none focus:border-[#ffe3b0] font-semibold"
                />
              ) : (
                <div className="text-xs font-mono text-[#ffe3b0] bg-[#08090b] border border-[#202228] px-3 py-2 rounded-lg font-semibold">
                  {profile.duration_days} days ({(profile.duration_days * 24).toFixed(0)} hours)
                </div>
              )}
              {getFieldError('duration_days') && (
                <p className="text-[10px] text-rose-400 mt-1">{getFieldError('duration_days')}</p>
              )}
            </div>

            {/* Observer Height */}
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">
                Observer Instrument Height (m)
              </label>
              {isEditing ? (
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={profile.observer_height_m}
                  onChange={(e) => updateDraftField('observer_height_m', parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#08090b] border border-[#303238] text-slate-200 text-xs font-mono px-3 py-2 rounded-lg focus:outline-none focus:border-[#ffe3b0]"
                >
                </input>
              ) : (
                <div className="text-xs font-mono text-slate-200 bg-[#08090b] border border-[#202228] px-3 py-2 rounded-lg">
                  {profile.observer_height_m} meters above terrain
                </div>
              )}
            </div>
          </div>

          {/* Time Span */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">
                Analysis Start Epoch (UTC)
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={profile.start_timestamp_iso}
                  onChange={(e) => updateDraftField('start_timestamp_iso', e.target.value)}
                  placeholder="2026-10-04T12:00:00Z"
                  className="w-full bg-[#08090b] border border-[#303238] text-slate-200 text-xs font-mono px-3 py-2 rounded-lg focus:outline-none focus:border-[#ffe3b0]"
                />
              ) : (
                <div className="text-xs font-mono text-slate-300 bg-[#08090b] border border-[#202228] px-3 py-2 rounded-lg">
                  {profile.start_timestamp_iso}
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">
                Analysis End Epoch (UTC)
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={profile.end_timestamp_iso}
                  onChange={(e) => updateDraftField('end_timestamp_iso', e.target.value)}
                  placeholder="2026-10-11T12:00:00Z"
                  className="w-full bg-[#08090b] border border-[#303238] text-slate-200 text-xs font-mono px-3 py-2 rounded-lg focus:outline-none focus:border-[#ffe3b0]"
                />
              ) : (
                <div className="text-xs font-mono text-slate-300 bg-[#08090b] border border-[#202228] px-3 py-2 rounded-lg">
                  {profile.end_timestamp_iso}
                </div>
              )}
            </div>
          </div>

          {/* Mission Description */}
          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1">
              Operational Concept & Mission Description
            </label>
            {isEditing ? (
              <textarea
                rows={2}
                value={profile.description}
                onChange={(e) => updateDraftField('description', e.target.value)}
                placeholder="Describe mission operational scenario, goals, and constraints..."
                className="w-full bg-[#08090b] border border-[#303238] text-slate-200 text-xs font-sans p-2.5 rounded-lg focus:outline-none focus:border-[#ffe3b0]"
              />
            ) : (
              <p className="text-xs text-slate-300 font-sans leading-relaxed bg-[#08090b] p-3 rounded-lg border border-[#202228]">
                {profile.description || 'No description provided.'}
              </p>
            )}
          </div>
        </div>

        {/* Section 2: Solar Requirements */}
        <div className="bg-[#141619] border border-[#2b2d32] rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#202228] gap-2">
            <div className="flex items-center gap-2">
              <Sun className="w-4 h-4 text-amber-400" />
              <h2 className="text-xs font-bold text-slate-100 font-mono tracking-wider">
                2. SOLAR ILLUMINATION REQUIREMENTS
              </h2>
            </div>
            <div className="text-[10px] font-mono text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
              Geometric line-of-sight only • Does not model electrical battery/panel efficiency
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
            <RequirementCard
              category="solar"
              requirement={profile.requirements.solar.min_total_sunlight_hours}
              isEditing={isEditing}
              onUpdate={(up) =>
                updateRequirement('solar', 'min_total_sunlight_hours', up)
              }
              fieldError={getFieldError('solar.min_total_sunlight_hours')}
            />
            <RequirementCard
              category="solar"
              requirement={profile.requirements.solar.max_continuous_darkness_hours}
              isEditing={isEditing}
              onUpdate={(up) =>
                updateRequirement('solar', 'max_continuous_darkness_hours', up)
              }
              fieldError={getFieldError('solar.max_continuous_darkness_hours')}
            />
            <RequirementCard
              category="solar"
              requirement={profile.requirements.solar.min_sunlight_percentage}
              isEditing={isEditing}
              onUpdate={(up) =>
                updateRequirement('solar', 'min_sunlight_percentage', up)
              }
              fieldError={getFieldError('solar.min_sunlight_percentage')}
            />
            <RequirementCard
              category="solar"
              requirement={profile.requirements.solar.min_full_sunlight_hours}
              isEditing={isEditing}
              onUpdate={(up) =>
                updateRequirement('solar', 'min_full_sunlight_hours', up)
              }
              fieldError={getFieldError('solar.min_full_sunlight_hours')}
            />
            <RequirementCard
              category="solar"
              requirement={profile.requirements.solar.min_daily_sunlight_hours}
              isEditing={isEditing}
              onUpdate={(up) =>
                updateRequirement('solar', 'min_daily_sunlight_hours', up)
              }
              fieldError={getFieldError('solar.min_daily_sunlight_hours')}
            />
          </div>
        </div>

        {/* Section 3: Earth Visibility Requirements */}
        <div className="bg-[#141619] border border-[#2b2d32] rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#202228] gap-2">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-cyan-400" />
              <h2 className="text-xs font-bold text-slate-100 font-mono tracking-wider">
                3. DIRECT-TO-EARTH LINE-OF-SIGHT REQUIREMENTS
              </h2>
            </div>
            <div className="text-[10px] font-mono text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded">
              Geometric clearance only • Does not model RF link budget or comms schedules
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
            <RequirementCard
              category="earth"
              requirement={profile.requirements.earth.min_total_earth_visible_hours}
              isEditing={isEditing}
              onUpdate={(up) =>
                updateRequirement('earth', 'min_total_earth_visible_hours', up)
              }
              fieldError={getFieldError('earth.min_total_earth_visible_hours')}
            />
            <RequirementCard
              category="earth"
              requirement={profile.requirements.earth.max_continuous_earth_blackout_hours}
              isEditing={isEditing}
              onUpdate={(up) =>
                updateRequirement('earth', 'max_continuous_earth_blackout_hours', up)
              }
              fieldError={getFieldError('earth.max_continuous_earth_blackout_hours')}
            />
            <RequirementCard
              category="earth"
              requirement={profile.requirements.earth.min_daily_earth_visible_hours}
              isEditing={isEditing}
              onUpdate={(up) =>
                updateRequirement('earth', 'min_daily_earth_visible_hours', up)
              }
              fieldError={getFieldError('earth.min_daily_earth_visible_hours')}
            />
            <RequirementCard
              category="earth"
              requirement={profile.requirements.earth.min_full_disk_earth_visible_hours}
              isEditing={isEditing}
              onUpdate={(up) =>
                updateRequirement('earth', 'min_full_disk_earth_visible_hours', up)
              }
              fieldError={getFieldError('earth.min_full_disk_earth_visible_hours')}
            />
          </div>
        </div>

        {/* Section 4: Terrain Requirements */}
        <div className="bg-[#141619] border border-[#2b2d32] rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#202228] gap-2">
            <div className="flex items-center gap-2">
              <Mountain className="w-4 h-4 text-[#ffe3b0]" />
              <h2 className="text-xs font-bold text-slate-100 font-mono tracking-wider">
                4. TERRAIN GEOMORPHOMETRIC LIMITS
              </h2>
            </div>
            <div className="text-[10px] font-mono text-[#ffe3b0] bg-[#ffe3b0]/10 border border-[#ffe3b0]/20 px-2 py-0.5 rounded">
              NASA LOLA 5 m DEM criteria • Does not guarantee sub-pixel boulder clearance
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
            <RequirementCard
              category="terrain"
              requirement={profile.requirements.terrain.max_local_slope_deg}
              isEditing={isEditing}
              onUpdate={(up) =>
                updateRequirement('terrain', 'max_local_slope_deg', up)
              }
              fieldError={getFieldError('terrain.max_local_slope_deg')}
            />
            <RequirementCard
              category="terrain"
              requirement={profile.requirements.terrain.min_elevation_m}
              isEditing={isEditing}
              onUpdate={(up) =>
                updateRequirement('terrain', 'min_elevation_m', up)
              }
              fieldError={getFieldError('terrain.min_elevation_m')}
            />
            <RequirementCard
              category="terrain"
              requirement={profile.requirements.terrain.max_elevation_m}
              isEditing={isEditing}
              onUpdate={(up) =>
                updateRequirement('terrain', 'max_elevation_m', up)
              }
              fieldError={getFieldError('terrain.max_elevation_m')}
            />
            <RequirementCard
              category="terrain"
              requirement={profile.requirements.terrain.max_roughness_factor}
              isEditing={isEditing}
              onUpdate={(up) =>
                updateRequirement('terrain', 'max_roughness_factor', up)
              }
              fieldError={getFieldError('terrain.max_roughness_factor')}
            />
          </div>
        </div>

        {/* Live Validation Feedback Drawer */}
        {validation && (
          <div
            className={`p-4 rounded-xl border ${
              !validation.is_valid
                ? 'bg-rose-950/20 border-rose-500/40'
                : validation.warnings.length > 0
                ? 'bg-amber-950/20 border-amber-500/40'
                : 'bg-emerald-950/20 border-emerald-500/40'
            }`}
          >
            <div className="flex items-center gap-2 mb-2 font-mono text-xs font-semibold">
              {!validation.is_valid ? (
                <>
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span className="text-rose-300">
                    Validation Errors Detected ({validation.errors.length}) — Cannot Save
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-300">
                    Configuration Valid & Scientifically Consistent
                  </span>
                </>
              )}
            </div>

            {/* List Errors */}
            {validation.errors.length > 0 && (
              <ul className="space-y-1 mb-2">
                {validation.errors.map((err, idx) => (
                  <li key={idx} className="text-xs text-rose-300 flex items-start gap-1.5 font-mono">
                    <span className="text-rose-400 font-bold">•</span>
                    <span>
                      <strong className="text-rose-200">[{err.field}]:</strong> {err.message}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {/* List Warnings */}
            {validation.warnings.length > 0 && (
              <ul className="space-y-1 mb-2">
                {validation.warnings.map((warn, idx) => (
                  <li key={idx} className="text-xs text-amber-300 flex items-start gap-1.5 font-mono">
                    <span className="text-amber-400 font-bold">▲</span>
                    <span>
                      <strong className="text-amber-200">[{warn.field}]:</strong> {warn.message}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {/* Info notes */}
            {validation.info_notes.length > 0 && (
              <ul className="space-y-0.5">
                {validation.info_notes.map((info, idx) => (
                  <li key={idx} className="text-[11px] text-slate-400 flex items-start gap-1.5 font-sans italic">
                    <Info className="w-3.5 h-3.5 shrink-0 text-slate-400 mt-0.5" />
                    <span>{info.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
