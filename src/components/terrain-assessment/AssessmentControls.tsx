import { useTerrainAssessmentStore } from '../../stores/terrainAssessmentStore';
import { CandidatePicker, Field, ProfileField, SetupPanel, SetupStep, useSetupData } from '../ui/MissionSetup';
export function AssessmentControls() {
  const { profiles, scenarios } = useSetupData();
  const s = useTerrainAssessmentStore();
  const ready = profiles.some(p => p.id === s.selectedProfileId) && s.selectedScenarioIds.length > 0 && s.selectedScenarioIds.every(id => scenarios.some(sc => sc.id === id));
  return <SetupPanel title="Set up a terrain assessment" description="Check the ground around each candidate against the same mission requirements." error={s.error} action={<><p>{ready ? `${s.selectedScenarioIds.length} candidates · ${s.assessmentRadiusM === 0 ? 'Point sample' : `${s.assessmentRadiusM} m radius`}` : 'Choose an available profile and at least one candidate.'}</p><button className="primary-button" disabled={!ready || s.executing} onClick={s.executeAssessment}>{s.executing ? 'Assessing terrain…' : 'Assess selected sites'}</button></>}>
    <SetupStep number="01" title="Your requirements"><ProfileField profiles={profiles} value={s.selectedProfileId} onChange={s.setSelectedProfileId}/></SetupStep>
    <SetupStep number="02" title="Candidate sites"><CandidatePicker scenarios={scenarios} selected={s.selectedScenarioIds} toggle={s.toggleScenarioSelection} selectAll={s.selectAllScenarios} clear={s.clearScenarioSelection}/></SetupStep>
    <SetupStep number="03" title="Area to inspect"><Field label="Assessment radius" hint="The distance around each candidate to include in the assessment."><select value={s.assessmentRadiusM} onChange={e => s.setAssessmentRadius(Number(e.target.value))}><option value={0}>Point sample only</option><option value={25}>25 metres</option><option value={50}>50 metres</option><option value={100}>100 metres</option><option value={250}>250 metres</option></select></Field><Field label="Assessment name (optional)"><input value={s.customName} placeholder="e.g. South pole shortlist" onChange={e => s.setCustomName(e.target.value)}/></Field><p className="setup-hint">Review coverage with each result. A larger area can extend beyond available elevation data.</p></SetupStep>
  </SetupPanel>;
}
