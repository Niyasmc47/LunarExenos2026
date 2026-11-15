import React, { useState } from 'react';
import { HelpCircle, Info, X } from 'lucide-react';

export type ExplainerTopic =
  | 'elevation'
  | 'slope'
  | 'solar'
  | 'earth'
  | 'coverage'
  | 'lola_interpolation';

interface TopicContent {
  title: string;
  plainEnglish: string;
  scientificDetail: string;
  missionImpact: string;
}

const TOPICS: Record<ExplainerTopic, TopicContent> = {
  elevation: {
    title: 'Surface Elevation (Reference Sphere)',
    plainEnglish:
      'This is the ground height compared to an average smooth Moon sphere (radius 1,737.4 km). It is not the altitude of your spacecraft above ground.',
    scientificDetail:
      'Referenced to IAU Moon 2000 datum with DE421 ephemerides. High ridges at the South Pole reach up to +1,950 m, while crater floors dip below -2,800 m.',
    missionImpact:
      'Higher ground typically catches longer periods of sunlight and offers clearer horizon views.',
  },
  slope: {
    title: 'Terrain Slope (Inclination)',
    plainEnglish:
      'How steep the local ground is, measured in degrees. Flat ground is 0°; a typical ramp is around 5°–8°.',
    scientificDetail:
      'Derived from adjacent 5-metre LOLA elevation cells. NASA Artemis landing limits typically restrict acceptable landing slope to ≤ 10°–15°.',
    missionImpact:
      'Steep slopes increase lander tipping hazards on touchdown and prevent rovers from climbing safely.',
  },
  solar: {
    title: 'Sunlight & Solar Illumination',
    plainEnglish:
      'Shows whether the Sun is visible above the surrounding hills and ridges. It does not automatically guarantee continuous battery charging.',
    scientificDetail:
      'Calculated as geometric line-of-sight to the top edge (upper limb) of the solar disk using SPICE topocentric ephemerides.',
    missionImpact:
      'South Pole shadows are long and change slowly. Even brief shadow periods require battery reserves or thermal survival heating.',
  },
  earth: {
    title: 'Earth Visibility & Direct Communications',
    plainEnglish:
      'Shows if the Earth can be seen above the local horizon from this point. It does not guarantee a radio connection without pointing antennas properly.',
    scientificDetail:
      'Geometric line-of-sight to Earth centre over 360° terrain skyline. Lunar libration causes the Earth to bob up and down by ~6° over each monthly cycle.',
    missionImpact:
      'If Earth dips below the ridge, direct-to-Earth (DTE) radio links drop completely until a lunar relay orbiter passes overhead.',
  },
  coverage: {
    title: 'DEM Terrain Data Coverage',
    plainEnglish:
      'The percentage of the requested search area covered by authentic NASA LOLA elevation measurements.',
    scientificDetail:
      'Verified against NASA Product 78 (LOLA 5m/pixel polar stereographic rasters). Rays or footprints that exit raster boundaries report partial coverage.',
    missionImpact:
      'Partial coverage means unmapped obstacles or distant ridges might lie just beyond the border of the data.',
  },
  lola_interpolation: {
    title: 'NASA LOLA Grid & Laser Measurements',
    plainEnglish:
      'NASA gathered laser pulses from the Lunar Reconnaissance Orbiter. The 5-metre grid blends real laser hits (~10–20 metres apart) into a continuous surface.',
    scientificDetail:
      'Barker et al. (2021) co-registered track adjustments. Observation counts (LDEC) and uncertainty rasters (toterr / slperr) disclose local measurement density.',
    missionImpact:
      'High-confidence planning requires verifying both observation count and total uncertainty.',
  },
};

interface PlainLanguageExplainerProps {
  topic: ExplainerTopic;
  compact?: boolean;
}

export const PlainLanguageExplainer: React.FC<PlainLanguageExplainerProps> = ({
  topic,
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const data = TOPICS[topic];
  if (!data) return null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
        title={`What does ${data.title} mean?`}
        className={`inline-flex items-center gap-1 rounded transition-colors text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 ${
          compact ? 'p-0.5' : 'px-1.5 py-0.5 text-[10px] font-mono'
        }`}
      >
        <HelpCircle className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5 text-emerald-400/80'} />
        {!compact && <span>Explain</span>}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0b121e] border border-slate-700 rounded-xl p-5 max-w-md w-full shadow-2xl space-y-3.5 text-left font-sans"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-emerald-400" />
                <h4 className="text-sm font-bold text-slate-100 font-mono">{data.title}</h4>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-lg">
                <span className="text-[10px] font-mono uppercase text-emerald-400 font-bold block mb-1">
                  Plain English
                </span>
                <p className="text-slate-200 leading-relaxed">{data.plainEnglish}</p>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-lg">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block mb-1">
                  Scientific Definition
                </span>
                <p className="text-slate-300 leading-relaxed font-mono text-[11px]">
                  {data.scientificDetail}
                </p>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-lg">
                <span className="text-[10px] font-mono uppercase text-amber-400 font-bold block mb-1">
                  Mission Impact
                </span>
                <p className="text-slate-300 leading-relaxed">{data.missionImpact}</p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono font-bold"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
