import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { estimateWindows, utcFromInput, utcInputValue } from '../../src/utils/planningInputs';
import { navigation } from '../../src/components/layout/navigation';
import { Header } from '../../src/components/layout/Header';
import { ScreeningControls } from '../../src/components/screening/ScreeningControls';
import { SearchControls } from '../../src/components/window-planner/SearchControls';
import { AssessmentControls } from '../../src/components/terrain-assessment/AssessmentControls';
import { MissionRequirementsWorkspace } from '../../src/components/mission-requirements/MissionRequirementsWorkspace';
import { CandidateScreeningWorkspace } from '../../src/components/screening/CandidateScreeningWorkspace';
import { MissionWindowPlannerWorkspace } from '../../src/components/window-planner/MissionWindowPlannerWorkspace';
import { TerrainAssessmentWorkspace } from '../../src/components/terrain-assessment/TerrainAssessmentWorkspace';
import { TradeOffWorkspace } from '../../src/components/trade-off/TradeOffWorkspace';
import { ReportGeneratorWorkspace } from '../../src/components/decision-reports/ReportGeneratorWorkspace';
import { CoordinatePanel } from '../../src/components/controls/CoordinatePanel';
import { DialogSurface } from '../../src/components/ui/DialogSurface';

// These are source-level rendering checks; they do not launch or access a browser.
test('UTC form conversion keeps time zone offsets and seconds explicit', () => {
  assert.equal(utcInputValue('2026-10-04T05:30:15+05:30'), '2026-10-04T00:00:15');
  assert.equal(utcFromInput('2026-10-04T00:00:15'), '2026-10-04T00:00:15Z');
  assert.equal(utcFromInput(''), '');
  assert.equal(utcInputValue('invalid'), '');
});
test('window estimates reject invalid intervals and include exact-fit missions', () => {
  const start = '2026-10-04T00:00:00Z', end = '2026-10-14T00:00:00Z';
  assert.equal(estimateWindows(start, end, 3, 12), 15);
  assert.equal(estimateWindows(start, end, 10, 12), 1);
  for (const [days, step] of [[0,12],[-1,12],[3,0],[3,-1],[NaN,12],[3,Infinity],[11,12]]) assert.equal(estimateWindows(start,end,days,step), 0);
  assert.equal(estimateWindows('invalid',end,3,12),0);
  assert.equal(estimateWindows(end,start,3,12),0);
});
test('main navigation exposes all nine destinations and current-page semantics', () => {
  const html = renderToStaticMarkup(React.createElement(Header));
  assert.equal(navigation.length,9);
  assert.equal(new Set(navigation.map(p=>p.id)).size,9);
  for (const page of navigation) assert.ok(html.includes(page.label.replaceAll('&','&amp;')), page.label);
  assert.match(html, /aria-current="page"/);
  assert.match(html, /aria-controls="mission-navigation"/);
});
for (const [name, Component, expected] of [
 ['Moon selection', CoordinatePanel, 'Enter exact coordinates'],
 ['Mission requirements', MissionRequirementsWorkspace, 'Your mission profiles'],
 ['Screening', CandidateScreeningWorkspace, 'Which sites meet your requirements?'],
 ['Window planner', MissionWindowPlannerWorkspace, 'Review your mission windows'],
 ['Terrain assessment', TerrainAssessmentWorkspace, 'Review landing terrain'],
 ['Trade-offs', TradeOffWorkspace, 'Create your first study'],
 ['Reports', ReportGeneratorWorkspace, 'Tell the story behind your decision'],
] as const) test(`${name} renders its revised starting state`, () => {
 const html = renderToStaticMarkup(React.createElement(Component));
 assert.ok(html.includes(expected), name);
 assert.ok(!html.includes('undefined'));
});
for (const Component of [ScreeningControls,SearchControls,AssessmentControls]) test(`${Component.name} prevents running with missing source data`, () => {
 const html = renderToStaticMarkup(React.createElement(Component));
 assert.match(html, /disabled=""/);
 assert.match(html, /Choose an available/);
 assert.match(html, /<label class="mission-field">/);
});
test('dialogs expose an accessible name and native modal semantics', () => {
 const html = renderToStaticMarkup(React.createElement(DialogSurface,{label:'Export results',onClose:()=>{}},React.createElement('button',null,'Close')));
 assert.match(html, /<dialog/);
 assert.match(html, /aria-label="Export results"/);
 assert.match(html, /aria-modal="true"/);
});
// Import the graphics workspaces without starting effects or network requests.
for (const [path, name, expected] of [
 ['../../src/components/layout/Dashboard', 'Dashboard', 'Choose a named place'],
 ['../../src/components/terrain-analysis/TerrainExplorer', 'TerrainExplorer', 'Explore local terrain'],
 ['../../src/components/scenario-comparison/MissionComparisonWorkspace', 'MissionComparisonWorkspace', 'Compare selected'],
 ['../../src/components/horizon/HorizonExplorerView', 'HorizonExplorerView', 'Your local skyline'],
 ['../../src/components/ephemeris/EphemerisExplorerView', 'EphemerisExplorerView', 'Sun position not loaded'],
 ['../../src/components/visibility/VisibilityExplorerView', 'VisibilityExplorerView', 'When is the sky clear?'],
] as const) test(`${name} renders without running live analysis`, async () => {
 const module = await import(path);
 const html = renderToStaticMarkup(React.createElement(module[name]));
 assert.ok(html.includes(expected), name);
});
