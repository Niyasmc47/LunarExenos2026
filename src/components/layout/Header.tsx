import { useState } from 'react';
import { Moon, Globe2, Mountain, GitCompare, SlidersHorizontal, ShieldCheck, CalendarClock, Compass, Scale, FileText, Menu, X } from 'lucide-react';
import { useLocationStore } from '../../stores/locationStore';
import { navigation, navigationGroups } from './navigation';
const icons = { 'lunar-explorer': Globe2, 'terrain-explorer': Mountain, 'mission-requirements': SlidersHorizontal, 'mission-comparison': GitCompare, 'candidate-screening': ShieldCheck, 'window-planner': CalendarClock, 'terrain-assessment': Compass, 'trade-off-analysis': Scale, 'mission-reports': FileText };
export function Header() {
 const screen = useLocationStore(s => s.appScreen);
 const setScreen = useLocationStore(s => s.setAppScreen);
 const [open, setOpen] = useState(false);
 return <header className="mission-sidebar" onKeyDown={event => { if (event.key === 'Escape') { setOpen(false); document.querySelector<HTMLButtonElement>('.navigation-toggle')?.focus(); } }}>
 <a className="skip-link" href="#main-content">Skip to workspace</a>
 <div className="mission-brand"><span className="brand-moon"><Moon size={22} /></span><div><strong>LUNAVISTA</strong><span>A clearer view of the Moon</span></div><button className="navigation-toggle" aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} aria-controls="mission-navigation" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button></div>
 <div className="pb-4 px-2 hidden md:block">
   <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0c0e11] border border-[#2b2d32] text-[10px] text-slate-400 font-mono w-full shadow-inner">
     <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
     <span className="truncate">SPICE: DE421 • LRO/LOLA</span>
   </div>
 </div>
 <nav id="mission-navigation" className={open ? 'mission-navigation is-open' : 'mission-navigation'} aria-label="Main navigation">{navigationGroups.map((group, index) => <section key={group}><h2><span>0{index + 1}</span> {group}</h2>{navigation.filter(item => item.group === group).map(item => { const Icon = icons[item.id]; return <button key={item.id} aria-current={screen === item.id ? 'page' : undefined} onClick={() => { setScreen(item.id); setOpen(false); document.getElementById('main-content')?.focus(); }}><Icon size={18} /><span>{item.label}</span>{screen === item.id && <span className="nav-dot" />}</button>; })}</section>)}</nav>
 <div className="sidebar-note">
  <div className="lunar-horizon" aria-hidden="true" />
  <p>From a place on the Moon<br />to a mission with a plan.</p>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
    <span>Lunar mission planning</span>
    <a
      href="http://127.0.0.1:8000/docs"
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: '#e5c68d', fontSize: '11px', textDecoration: 'none', fontWeight: 600 }}
      title="Open Swagger API documentation in a new browser tab"
    >
      API Docs ↗
    </a>
  </div>
 </div>
 </header>;
}
