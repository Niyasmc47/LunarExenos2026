import { useState } from 'react';
import { useLocationStore } from '../../stores/locationStore';
import { LunarGlobe } from '../lunar-globe/LunarGlobe';
import { LunarMap } from '../lunar-map/LunarMap';
import { CoordinatePanel } from '../controls/CoordinatePanel';
import { ViewSwitcher } from '../controls/ViewSwitcher';
export function Dashboard() {
  const activeView = useLocationStore(s => s.activeView);
  const [panelOpen, setPanelOpen] = useState(true);
  return <main id="main-content" className="explorer-layout" tabIndex={-1}>
    <div className="explorer-toolbar"><div><p className="eyebrow">LUNAR EXPLORER</p><p>One Moon. Many perspectives.</p></div><ViewSwitcher />
      <button className="secondary-button" aria-expanded={panelOpen} aria-controls="location-panel" onClick={() => setPanelOpen(!panelOpen)}>{panelOpen ? 'Hide location controls' : 'Show location controls'}</button>
    </div>
    <div className={'explorer-body ' + (panelOpen ? '' : 'controls-hidden')}>
      <div className={'explorer-views view-' + activeView}>
        <section aria-label="3D lunar globe" hidden={activeView === '2d'}><LunarGlobe /></section>
        <section aria-label="2D lunar map" hidden={activeView === '3d'}><LunarMap /></section>
      </div>
      <aside id="location-panel" hidden={!panelOpen}><CoordinatePanel /></aside>
    </div>
  </main>;
}
