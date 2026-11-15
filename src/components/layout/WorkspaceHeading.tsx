import { CircleHelp, ExternalLink } from 'lucide-react';
import { useLocationStore } from '../../stores/locationStore';
import { navigation } from './navigation';
import { API_BASE_URL } from '../../services/apiClient';

export function WorkspaceHeading() {
  const screen = useLocationStore(s => s.appScreen);
  const page = navigation.find(item => item.id === screen)!;

  return (
    <div className="workspace-heading">
      <div>
        <p className="workspace-breadcrumb">{page.group}<span>/</span>{page.label}</p>
        <h1>{page.title}</h1>
        <p className="workspace-description">{page.description}</p>
      </div>
      <div className="flex items-center gap-2">
        <a
          href={`${API_BASE_URL || ''}/docs`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-amber-200 px-3 py-2 border border-slate-700/60 rounded-lg hover:border-amber-400/40 bg-slate-900/40 transition-colors"
          title="Open interactive Swagger API Documentation in a new tab"
        >
          <ExternalLink size={14} className="text-amber-400" />
          <span>API Docs</span>
        </a>
        <details key={screen} className="workspace-guide">
          <summary><CircleHelp size={17} /> How to use this</summary>
          <ol>{page.steps.map(step => <li key={step}>{step}</li>)}</ol>
        </details>
      </div>
    </div>
  );
}
