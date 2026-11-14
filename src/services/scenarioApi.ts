import {
  ScenarioRecord,
  ScenarioCreateRequest,
  ScenarioUpdateRequest,
  MultiScenarioComparisonRequest,
  MultiScenarioComparisonResponse,
  ScenarioExportRequest,
} from '../types/scenario';

const BACKEND_BASE = 'http://127.0.0.1:8000';

export async function fetchScenarios(): Promise<ScenarioRecord[]> {
  try {
    const res = await fetch(`${BACKEND_BASE}/api/scenarios`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('[Scenario API] fetchScenarios error:', err);
    return [];
  }
}

export async function createScenario(
  req: ScenarioCreateRequest
): Promise<ScenarioRecord | null> {
  try {
    const res = await fetch(`${BACKEND_BASE}/api/scenarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText);
    }
    return await res.json();
  } catch (err) {
    console.error('[Scenario API] createScenario error:', err);
    throw err;
  }
}

export async function updateScenario(
  scenarioId: string,
  req: ScenarioUpdateRequest
): Promise<ScenarioRecord | null> {
  try {
    const res = await fetch(`${BACKEND_BASE}/api/scenarios/${scenarioId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText);
    }
    return await res.json();
  } catch (err) {
    console.error('[Scenario API] updateScenario error:', err);
    throw err;
  }
}

export async function deleteScenario(scenarioId: string): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_BASE}/api/scenarios/${scenarioId}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch (err) {
    console.error('[Scenario API] deleteScenario error:', err);
    return false;
  }
}

export async function duplicateScenario(
  scenarioId: string
): Promise<ScenarioRecord | null> {
  try {
    const res = await fetch(
      `${BACKEND_BASE}/api/scenarios/${scenarioId}/duplicate`,
      { method: 'POST' }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('[Scenario API] duplicateScenario error:', err);
    return null;
  }
}

export async function compareScenarios(
  req: MultiScenarioComparisonRequest
): Promise<MultiScenarioComparisonResponse | null> {
  try {
    const res = await fetch(`${BACKEND_BASE}/api/scenarios/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText);
    }
    return await res.json();
  } catch (err) {
    console.error('[Scenario API] compareScenarios error:', err);
    throw err;
  }
}

export async function exportComparison(
  req: ScenarioExportRequest
): Promise<string> {
  try {
    const res = await fetch(`${BACKEND_BASE}/api/scenarios/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (err) {
    console.error('[Scenario API] exportComparison error:', err);
    throw err;
  }
}
