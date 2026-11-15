import { DialogSurface } from '../ui/DialogSurface';
import React from 'react';
import { useMissionProfileStore } from '../../stores/missionProfileStore';
import { Sparkles, X, Check, Clock, Sun, Radio, Mountain } from 'lucide-react';

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TemplateModal: React.FC<TemplateModalProps> = ({ isOpen, onClose }) => {
  const profiles = useMissionProfileStore((state) => state.profiles);
  const startCreate = useMissionProfileStore((state) => state.startCreate);

  if (!isOpen) return null;

  const templates = profiles.filter((p) => p.is_template);

  const handleSelectTemplate = (templateId: string) => {
    startCreate(templateId);
    onClose();
  };

  return (
    <DialogSurface label="Choose a mission template" onClose={onClose} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-4xl bg-[#141619] border border-[#303238]/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#2b2d32] flex items-center justify-between bg-[#191b20]">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-[#ffe3b0]" />
            <h2 className="text-base font-bold text-slate-100 font-mono tracking-wide">
              Illustrative Mission Profile Templates
            </h2>
          </div>
          <button
            aria-label="Close dialog" onClick={onClose}
            className="p-1 rounded-lg hover:bg-[#202228] text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scientific Notice Banner */}
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2.5 text-xs text-amber-300 flex items-center gap-2">
          <span className="font-semibold uppercase tracking-wider font-mono text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40">
            Notice
          </span>
          <span>
            These starter templates provide user-editable illustrative defaults. They are not NASA flight rules or official standards.
          </span>
        </div>

        {/* Templates Grid */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="p-4 rounded-xl border border-[#2b2d32] bg-[#141619] hover:border-[#ffe3b0]/60 hover:bg-[#191b20] transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#202228] text-slate-300 border border-[#2b2d32]">
                    {tpl.mission_type.replace('_', ' ')}
                  </span>
                  <div className="flex items-center gap-1 text-xs font-mono text-slate-400">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{tpl.duration_days} days</span>
                  </div>
                </div>

                <h3 className="text-sm font-semibold text-slate-100 mb-1.5 font-mono">
                  {tpl.name}
                </h3>
                <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                  {tpl.description}
                </p>

                {/* Key parameters preview */}
                <div className="grid grid-cols-3 gap-2 bg-[#08090b] p-2.5 rounded-lg border border-[#202228] mb-4 text-[11px] font-mono">
                  <div className="flex flex-col">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Sun className="w-3 h-3 text-amber-400" /> Min Sun
                    </span>
                    <span className="text-slate-200 font-semibold mt-0.5">
                      {tpl.requirements.solar.min_total_sunlight_hours.value} h
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Radio className="w-3 h-3 text-[#7bd0ff]" /> Min Earth
                    </span>
                    <span className="text-slate-200 font-semibold mt-0.5">
                      {tpl.requirements.earth.min_total_earth_visible_hours.value} h
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Mountain className="w-3 h-3 text-[#ffe3b0]" /> Max Slope
                    </span>
                    <span className="text-slate-200 font-semibold mt-0.5">
                      ≤ {tpl.requirements.terrain.max_local_slope_deg.value}°
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleSelectTemplate(tpl.id)}
                className="w-full py-2 px-3 rounded-lg bg-[#ffe3b0]/15 hover:bg-[#ffe3b0] text-[#ffe3b0] hover:text-[#141619] border border-[#ffe3b0]/40 hover:border-[#ffe3b0] text-xs font-mono font-bold transition-all flex items-center justify-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Use This Template</span>
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#2b2d32] bg-[#0e1013] flex items-center justify-between">
          <span className="text-xs text-slate-400 font-mono">
            {templates.length} templates available
          </span>
          <button
            onClick={() => {
              startCreate();
              onClose();
            }}
            className="text-xs font-mono text-slate-300 hover:text-[#ffe3b0] transition-colors"
          >
            Start with Blank Custom Profile →
          </button>
        </div>
      </div>
    </DialogSurface>
  );
};
