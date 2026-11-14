import { useLocationStore } from '../../stores/locationStore';
import { Orbit } from 'lucide-react';
export function Header() {
  const { appScreen, setAppScreen } = useLocationStore();
  return <header className="app-header">
    <a href="#main-content" className="skip-link">Skip to explorer</a>
    <div className="brand"><Orbit aria-hidden="true" /><div><h1>LUNAVISTA</h1><p>Explore the Moon, understand the terrain</p></div></div>
    <nav aria-label="Workspace"><button aria-current={appScreen === 'lunar-explorer' ? 'page' : undefined} onClick={() => setAppScreen('lunar-explorer')}>Lunar Explorer</button><button aria-current={appScreen === 'terrain-explorer' ? 'page' : undefined} onClick={() => setAppScreen('terrain-explorer')}>Terrain Explorer</button></nav>
  </header>;
}
