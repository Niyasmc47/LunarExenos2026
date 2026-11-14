import React from 'react';
import { useLocationStore } from './stores/locationStore';
import { Header } from './components/layout/Header';
import { Dashboard } from './components/layout/Dashboard';
import { TerrainExplorer } from './components/terrain-analysis/TerrainExplorer';

export const App: React.FC = () => {
  const appScreen = useLocationStore((state) => state.appScreen);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#070b12] text-slate-100 font-sans overflow-hidden">
      <Header />
      {appScreen === 'lunar-explorer' ? <Dashboard /> : <TerrainExplorer />}
    </div>
  );
};

export default App;
