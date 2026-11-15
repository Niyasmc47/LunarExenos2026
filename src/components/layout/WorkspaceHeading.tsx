import { CircleHelp } from 'lucide-react';
import { useLocationStore } from '../../stores/locationStore';
import { navigation } from './navigation';
export function WorkspaceHeading() {
  const screen = useLocationStore(s => s.appScreen);
  const page = navigation.find(item => item.id === screen)!;
  return (
    <div className="workspace-heading">
      <div>
        <p className="workspace-breadcrumb">
          {page.group}<span>/</span>{page.label}
        </p>
        <h1>{page.title}</h1>
        <p className="workspace-description">{page.description}</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden xl:flex items-center gap-2 bg-[#141619] border border-[#2b2d32] px-3 py-1.5 rounded-lg shadow-sm text-left">
          <div className="flex flex-col">
            <span className="font-mono text-[#969ba6] text-[10px] uppercase">Ephemeris Target</span>
            <span className="font-mono text-[#f2f1ed] text-xs font-semibold">LUNAR SOUTH POLE</span>
          </div>
          <div className="w-px h-6 bg-[#292c32] mx-1"></div>
          <div className="flex flex-col">
            <span className="font-mono text-[#969ba6] text-[10px] uppercase">LOLA Accuracy</span>
            <span className="font-mono text-[#10B981] text-xs font-semibold">±0.45 m (Ver. 2.4)</span>
          </div>
        </div>
        <details key={screen} className="workspace-guide">
          <summary><CircleHelp size={17} /> How to use this</summary>
          <ol>{page.steps.map(step => <li key={step}>{step}</li>)}</ol>
        </details>
      </div>
    </div>
  );
}
