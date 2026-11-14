import React, { lazy, Suspense } from 'react';
import { useLocationStore } from './stores/locationStore';
import { Header } from './components/layout/Header';
import { Dashboard } from './components/layout/Dashboard';
const TerrainExplorer = lazy(() => import('./components/terrain-analysis/TerrainExplorer').then(module => ({ default: module.TerrainExplorer })));

export const App: React.FC = () => {
  const appScreen = useLocationStore((state) => state.appScreen);

  return (
    <div className="flex flex-col h-dvh w-full bg-[#070b12] text-slate-100 font-sans overflow-hidden">
      <Header />
      {appScreen === 'lunar-explorer' ? <Dashboard /> : <div id="main-content" className="flex flex-1 min-h-0" tabIndex={-1}><Suspense fallback={<p role="status" className="p-6">Loading Terrain Explorer…</p>}><TerrainExplorer /></Suspense></div>}
    </div>
  );
};

export default App;
