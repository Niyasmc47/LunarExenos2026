import { useEffect, useId, type ReactNode } from 'react';
import { ArrowRight, MapPin } from 'lucide-react';
import { useMissionProfileStore } from '../../stores/missionProfileStore';
import { useScenarioStore } from '../../stores/scenarioStore';
import { useLocationStore } from '../../stores/locationStore';

export function useSetupData() {
  const profiles = useMissionProfileStore(s => s.profiles);
  const loadProfiles = useMissionProfileStore(s => s.loadProfiles);
  const scenarios = useScenarioStore(s => s.scenarios);
  const loadScenarios = useScenarioStore(s => s.loadScenarios);
  useEffect(() => { loadProfiles(); loadScenarios(); }, [loadProfiles, loadScenarios]);
  return { profiles, scenarios };
}
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="mission-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}
export function SetupStep({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return <section className="setup-step"><h3><span>{number}</span>{title}</h3>{children}</section>;
}
export function SetupPanel({ title, description, children, action, error }: { title: string; description: string; children: ReactNode; action: ReactNode; error?: string | null }) {
  const id = useId();
  return <section className="analysis-setup" aria-labelledby={id}>
    <details open><summary><span><strong id={id}>{title}</strong><small>{description}</small></span><span className="setup-disclosure">Settings</span></summary><div className="setup-grid">{children}</div></details>
    {error && <p className="setup-error" role="alert">{error}</p>}
    <div className="setup-action">{action}</div>
  </section>;
}
export function ProfileField({ profiles, value, onChange }: { profiles: {id: string; name: string; description: string}[]; value: string; onChange: (id: string) => void }) {
  const setScreen = useLocationStore(s => s.setAppScreen);
  return <><Field label="Mission profile" hint={profiles.find(p => p.id === value)?.description}><select value={value} onChange={e => onChange(e.target.value)}><option value="" disabled>Choose a profile</option>{profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
    {!profiles.length && <p className="setup-hint">No profiles are available. <button type="button" onClick={() => setScreen('mission-requirements')}>Open mission requirements <ArrowRight size={13}/></button></p>}</>;
}
export function CandidatePicker({ scenarios, selected, toggle, selectAll, clear }: { scenarios: {id: string; name: string; latitude: number; longitude: number}[]; selected: string[]; toggle: (id: string) => void; selectAll: (ids: string[]) => void; clear: () => void }) {
  const setScreen = useLocationStore(s => s.setAppScreen);
  return <div className="candidate-picker"><div className="candidate-picker-tools"><span>{scenarios.filter(s => selected.includes(s.id)).length} selected</span><button type="button" onClick={() => selectAll(scenarios.map(s => s.id))}>Select all</button><button type="button" onClick={clear}>Clear</button></div>
    <div className="candidate-options">{scenarios.map(s => <label key={s.id}><input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)} /><span><strong>{s.name}</strong><small>{s.latitude.toFixed(3)}°, {s.longitude.toFixed(3)}°</small></span><MapPin size={15}/></label>)}</div>
    {!scenarios.length && <p className="setup-hint">Add a scenario to choose a site. <button type="button" onClick={() => setScreen('mission-comparison')}>Open scenarios <ArrowRight size={13}/></button></p>}
  </div>;
}
export function ResultIntro({ title, description }: { title: string; description: string }) {
  return <div className="result-intro"><span className="eyebrow">Your results</span><h2>{title}</h2><p>{description}</p></div>;
}
