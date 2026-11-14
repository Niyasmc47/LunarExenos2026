import React from 'react';
import { Header } from './components/layout/Header';
import { Dashboard } from './components/layout/Dashboard';

export const App: React.FC = () => {
  return (
    <div className="flex flex-col h-screen w-screen bg-[#070b12] text-slate-100 font-sans overflow-hidden">
      <Header />
      <Dashboard />
    </div>
  );
};

export default App;
