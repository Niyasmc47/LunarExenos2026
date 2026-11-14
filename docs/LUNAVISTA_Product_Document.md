# LUNAVISTA — Product definition, implementation audit and delivery plan

Date: 14 November 2026  
Repository: [Niyasmc47/LunarExenos2026](https://github.com/Niyasmc47/LunarExenos2026)  
Audited branch: `zundiac`  
Audited commit: `d3ab20bd25a028857cea4b4a5729bc90f2a6f363`

## 1. Executive assessment

LUNAVISTA has a substantial lunar exploration and terrain-analysis foundation, plus implemented terrain-horizon and Sun/Earth ephemeris modules. The supplied roadmap understates progress by marking MVPs 3 and 4 as entirely pending.

However, the application's central challenge outcome is still incomplete: it does not yet calculate integrated terrain-aware Sun/Earth visibility windows or rapidly compare site/date scenarios. The current celestial view checks elevation against zero, independently of the terrain horizon. Its labels overstate this as active solar power and connected communications.

The next product milestone should be a trustworthy single-site visibility analysis followed immediately by a two-scenario comparison. Before that, fix the shared coordinate, dataset, coverage and startup problems documented below. More visual polish or broader terrain coverage alone will not close the challenge gap.

This document is an audit and product plan, not a claim that all implemented code works. No application fixes, dependency installation, commits or pushes were performed for this review. Companion deliverable: [Updated MVP roadmap](LUNAVISTA_Updated_MVP_Roadmap.md).

## 2. Inputs, scope and evidence standard

Inputs reviewed:

- User-supplied challenge statement and definition in `Pasted text.txt`.
- User-supplied `LUNAVISTA_MVP_Roadmap_and_Status.md`.
- Frontend components, stores, coordinate utilities and API clients; backend routes, services, schemas, tests and local data.
- Official NASA/NAIF/JPL documentation where relevant to data and ephemeris interpretation.

Status terms:

- **Implemented:** code and app wiring exist.
- **Verified in this audit:** the stated command or isolated service check actually succeeded.
- **Blocked:** a required check could not execute because of a concrete environment/dependency problem.
- **Not found:** no implementation was found in the inspected frontend/backend source; a planned feature is not counted as delivered.
- **Needs validation:** source exists, but accuracy, coverage or user-visible behaviour has not been established.

This was a source and execution audit, not a browser usability test or independent scientific certification. No full visual/browser walkthrough was performed. Remote terrain products were not comprehensively downloaded or validated. Test names and code comments are not treated as proof of scientific accuracy.

## 3. Product purpose and intended users

**Product promise:** Choose a lunar site, select a mission window, see Sun/Earth motion against the terrain skyline, and compare an alternative without repeatedly navigating specialist tools.

| User | Primary need | Product response |
|---|---|---|
| Mission planner/engineer | Understand whether a delayed date or nearby site changes operational opportunities | Comparable timelines, longest outages, joint windows, assumptions and exports |
| Scientist/team reviewer | Balance engineering availability with scientific objectives | Shared scenarios, annotated sites, traceable comparison brief |
| Educator/student | Understand why lunar polar lighting and Earth visibility vary | Guided examples, animated sky/terrain view and plain-language explanation |
| Interested public | Explore locations without interpreting raw ephemerides | Presets, simple controls and clear coverage/accuracy labels |

Supported first-release scope should be a declared south-pole region with validated terrain. The global imagery explorer may remain available, but global navigation must not imply global terrain-horizon support.

## 4. Challenge-to-implementation mapping

| Challenge capability | Workspace evidence | Assessment / next requirement |
|---|---|---|
| Interactive site selection and custom coordinates | `CoordinatePanel`, `LunarMap`, `LunarGlobe`, shared location store | Implemented; explorer verification passed. Browser behaviour still needs review. |
| Curated sites | `LUNAR_PRESETS`; regional presets | Present, including Apollo and Chang'e 4. Expand/verify provenance; a comprehensive CLPS catalogue is absent. |
| Flexible date/time and multiple-day exploration | Ephemeris toolbar, time-series API/store | Implemented in source; backend currently blocked by missing dependency. |
| Sun/Earth relative to horizon | Celestial radar and separate terrain-horizon screen | Partial: celestial view uses the zero-degree tangent plane; no combined terrain skyline/trajectory analysis. |
| Solar elevation and power opportunity | Sun body telemetry and elevation time series | Position fields exist; no terrain-aware duration or electrical model. Current power labels overclaim. |
| Earth communication windows | Earth telemetry and elevation series | No event-window calculation; no RF link model or ground-station geometry. |
| Time remaining to sunset/Earthset | No event/countdown service found | Missing; include as first-class MVP 5 output. |
| 2D/3D visual understanding | Global map/globe, local terrain, radar and charts | Broad implementation; selected coordinates and data consistency need repair. |
| Temporal dynamics | Date stepping and one-hour-per-second position playback | Source present; not terrain-aware visibility animation. |
| Rapid site/date comparison | No scenario collection or comparison flow found | Missing and central to challenge completion. |
| Accessible to different skill levels | Presets, tooltips, some explanatory text | Partial; no verified keyboard/screen-reader flow or guided comparison. |
| Terrain/libration/orbital effects | Horizon service; SPICE lunar orientation and planetary kernels | Architecture addresses these, but correctness and integration remain unproven. |
| Small-change sensitivity | Point selection and date controls separately | No side-by-side differences or windows gained/lost. |

The challenge describes several optional approaches. Named mission lists, heatmaps, 3D views and detailed engineering models can improve the product, but they should not displace its essential rapid-comparison workflow.

## 5. What exists today

### 5.1 Frontend and explorer

React/TypeScript with Vite, Zustand state, OpenLayers mapping, Three.js/React Three Fiber terrain/globe rendering and Recharts plots. The top-level application switches between a Lunar Explorer and Terrain Explorer. Terrain Explorer has 3D terrain, 2D maps, horizon and ephemeris modes.

The explorer uses NASA Moon Trek imagery, coordinate entry, named locations and location synchronization. The globe is primarily an imagery sphere with a local terrain-patch path; it is not evidence of a globally terrain-accurate Moon.

### 5.2 Terrain

FastAPI services support catalogue/discovery, raster windows, elevation/slope/hillshade, profiles, statistics, mesh generation and exports. The active regional UI is in `src/components/terrain-analysis`; older `terrain-explorer` components also remain, and some are reused by the active screen. Source-file presence alone should not be used to claim a separate delivered workflow.

Two Site01 rasters are present locally: surface and slope, each about 41 MB. The surface was opened successfully: 3,200 × 3,200 pixels, 5 m spacing, polar stereographic projection, lunar radius 1,737,400 m, bounds X −19,000 to −3,000 m and Y −20,000 to −4,000 m. Actual nodata is NaN; some metadata in source instead declares −32767.

Count, elevation-uncertainty and slope-uncertainty companions were not present in the inspected Site01 directory. The catalogue lists additional remote sites and mosaics; these entries do not establish end-to-end support in every service.

NASA's product page distinguishes 5 m grid spacing from effective data resolution and describes substantial interpolation between LOLA measurements. Per-pixel confidence must come from applicable data, not a generic resolution label. [NASA PGDA Product 78](https://pgda.gsfc.nasa.gov/products/78)

### 5.3 Horizon

The horizon service samples terrain along azimuth rays, incorporates observer height and spherical curvature, and returns maximum elevation angle and obstruction location/distance. It provides aggregate coverage warnings and polar/Cartesian views. A direct Site01 call succeeded, but all 72 sampled rays in that check ended before the requested 15 km radius because of limited data coverage.

### 5.4 Ephemeris

The repository contains five SPICE kernel files, a kernel manager, position/time-series APIs, schemas, provenance and UI. The service calls `spkcpo` with a constant observer in `MOON_ME`, uses local east/north/up projections and supports NONE/LT/LT+S corrections. This is an appropriate architectural basis for a fixed lunar observer: the official API explicitly supports a caller-specified constant observer position. That API choice does not itself establish implementation accuracy. [NAIF spkcpo documentation](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/spkcpo_c.html)

The backend cannot currently import the complete application in the inspected virtual environment because `spiceypy` is absent. It is also missing from `backend/requirements.txt`. Pillow is imported for image generation but likewise absent from that declared list, although image-related imports were available in the current environment.

### 5.5 Missing product layer

No integrated visibility-event engine, scenario persistence/comparison model, mission constraint evaluation or evidence-based decision brief was found. Existing CSV/GeoTIFF export code exports terrain products; it is not scenario-comparison export.

## 6. What was actually verified

| Check | Observed result | Interpretation |
|---|---|---|
| `npm run build` | Passed TypeScript/build; 3,286 modules transformed | Frontend compiles. Does not prove browser/API operation. |
| Bundle output | Main JS approximately 2,056 kB, 575 kB gzip; chunk-size warning | Split heavy screens/modules and benchmark loading performance. |
| `node scripts/verify-mvp1.mjs` | Passed coordinate round trips, longitude wrapping, distance and four live NASA endpoints | Explorer helper checks and sampled imagery availability passed. Initial restricted-network failure passed on permitted retry. |
| Backend pytest using `backend/.venv/Scripts/python.exe` | Four collection errors; missing `spiceypy` | No backend test suite pass can be claimed. |
| Direct Site01 raster/point access | Passed; sample at −89.54°, −137.49° returned elevation 1,633.208 m and slope 18.1° | Local service/data access works; values were not independently surveyed. |
| Direct coarse mesh | 1,024 vertices, 1,922 triangles | Mesh generation executes for local data; geographic picking remains incorrect. |
| Direct regional raster window | Returned a valid 64 × 64 array | Execution works; partial-coverage georeferencing problem identified below. |
| Direct horizon | 72 directions at 5° spacing; partial coverage, 42,298 valid samples | The engine executes; not a complete or independently validated skyline. |
| Horizon dataset-selection probe | Requesting `site04` at the same coordinate returned Site01-derived observer elevation, labelled Site04 | Confirms silent source substitution. |
| 3D coordinate-mapping probe | Mesh centre ≈ (−89.463163°, −137.489553°); current UV-bound interpolation ≈ (−89.462697°, −136.678946°) | Confirms the current picking mapping disagrees with mesh geography. |

The direct horizon check returned maximum 19.358° at 320° and minimum −9.232° at 145°. These are diagnostic outputs, not validated mission planning results; coverage and sampling defects prevent that interpretation.

The explorer verification script is a helper/network check, not a substitute for clicking the real application. The ephemeris test file contains a purported independent benchmark with hard-coded expected values, but no saved originating query/response or complete independent reference configuration was found. Treat its independence as unverified, even after it eventually passes.

## 7. Priority findings and improvements

Priority definitions: **P0** blocks trustworthy analysis or startup; **P1** undermines accuracy, reproducibility or the core user experience; **P2** improves release quality.

| ID | Priority | Finding and evidence | Required improvement |
|---|---|---|---|
| F01 | P0 | `app/main.py` imports ephemeris; `ephemeris_service.py:5` requires missing `spiceypy`; pytest cannot collect | Declare tested dependencies, document setup and verify clean application startup/full tests. |
| F02 | P0 | `EphemerisExplorerView.tsx` uses elevation ≥ 0, then claims “Solar Power Active” and “Direct-to-Earth Link (Connected)” | Show position relative to tangent plane; use unknown while loading. Only show terrain visibility after MVP 5, and reserve power/link status for appropriate models. |
| F03 | P0 | `horizon_service.py:38–54` falls back to Site01 while retaining requested metadata; direct `site04` probe reproduced this. Ephemeris always samples the global Site01 loader | Resolve one actual dataset for every service; return true provenance; explicitly reject or disclose alternatives. |
| F04 | P0 | `TerrainViewer3D.tsx:190–198` maps UVs linearly into geographic min/max bounds, although the mesh comes from polar projected coordinates | Convert the picked projected/mesh position through the correct transform. Test known pixels, corners and centre. |
| F05 | P1 | `raster_window.py` clamps to raster bounds, resamples to the full requested output, then returns the original requested bounds | Return the true transform/window or reproject into a requested grid with nodata padding. Prevent stretching valid terrain over uncovered areas. |
| F06 | P1 | `profile_service.py:104` marks every eighth sample “measured” using sample index | Remove invented quality labels; sample count/quality products, otherwise report unknown provenance. |
| F07 | P1 | `horizon_service.py:283` emits 0° for a ray with no valid data; schema lacks per-ray validity | Use nullable angles and explicit validity/coverage. Do not treat absent terrain as clear sky. |
| F08 | P1 | Horizon interpolation uses inverse-affine corner coordinates directly in `map_coordinates`; shared transformer elsewhere subtracts 0.5 for centres | Unify raster sampling conventions and verify gradients/known-pixel fixtures. This can affect both observer and obstacle elevations. |
| F09 | P1 | Horizon summary indexes filtered `max_angles` into unfiltered `horizon_profile` | Keep azimuth-angle pairs together so extrema identify the correct direction after missing rays. |
| F10 | P1 | Ephemeris ignores requested terrain source; single-position zero-elevation fallback has a warning but time-series fallback does not | Carry explicit elevation source/mode and identical warnings into every output. |
| F11 | P1 | `ephemeris_service.py:45–46,159–160` uses hard-coded ET bounds with misleading date comments | Compute coverage from loaded kernels and test actual endpoints; ET is seconds from J2000, not Unix time. |
| F12 | P1 | Horizon uses float32 geometry and projected ray distances as spherical arc distances; no convergence/error budget found | Validate float64 geometry, geodesic/projection effects, sampling interval, azimuth interval and remote-terrain truncation. Quantify acceptable error. |
| F13 | P1 | Independent ephemeris benchmark has no captured external provenance; existing synthetic horizon tests were blocked | Save independent query/results and conventions; add mixed-nodata, nonzero-longitude and event tests. |
| F14 | P1 | Ephemeris store retains old results on input changes/failure; series failures are swallowed; separate stores own observer heights and datasets | Centralize immutable scenario inputs, attach input IDs to responses, cancel/ignore stale requests and show actionable errors. |
| F15 | P1 | 3D viewer explicitly requests `site01`; regional dataset selection is separate | Either support the active source in all modes or clearly restrict those modes and prevent misleading transitions. |
| F16 | P1 | API allows 0.1° azimuth × 100 km / 2 m samples: up to 180 million ray samples plus intermediates | Add combined-work/memory limits, chunking, cancellation and cached horizon jobs. |
| F17 | P2 | API clients hard-code `http://127.0.0.1:8000`; README contains only repeated repository title | Add environment-based service configuration, install/run/data instructions, deployment smoke tests and version reporting. |
| F18 | P2 | Export toolbar announces success when initiating a download, and profile export does not check `res.ok` | Confirm successful response before showing success; report failures and release generated object URLs. |

Additional metadata cleanup: read nodata and CRS from actual files; distinguish unavailable companion layers from catalogue-listed layers; replace unsupported generic precision or perpetual-visibility claims with sourced statements or computed results. A listed dataset footprint is not a guarantee that every pixel is valid.

The partial-window issue was exercised with a request extending outside Site01: requested projected bounds extended to roughly X −21,009 m and Y −22,796 m, while the dataset begins at X −19,000 m and Y −20,000 m. The returned grid nevertheless had 4,096 finite cells and retained the broader requested bounds. It must not be used as an accurate coverage map in that form.

## 8. Updated MVP register

| MVP | Deliverable | Current state | Completion gate |
|---|---|---|---|
| 1 | Explorer and accessible site selection | Implemented; limited checks passed | Real interaction/accessibility regression checks |
| 2 | Reliable terrain data and exploration | Implemented; local service checks passed | Correct transforms, dataset propagation, coverage and quality |
| 3 | Validated terrain skyline | Implemented; partial local check passed | Per-ray validity, distant coverage, numerical/synthetic validation |
| 4 | Validated Sun/Earth positions | Source implemented; runtime blocked | Dependencies, consistent observer, independent benchmarks |
| 5 | Visibility intervals, metrics and countdowns | Missing integrated capability | Terrain+ephemeris event engine and synchronized visualization |
| 6 | Rapid scenario comparison | Missing | Baseline/alternative workflow, saved settings, deltas and exports |
| 7 | Mission requirements and decision brief | Missing | Explainable pass/fail/unknown against user requirements |

The [updated roadmap](LUNAVISTA_Updated_MVP_Roadmap.md) specifies required features and acceptance criteria for each. Preserve the original seven-stage structure. Add a cross-cutting correctness/reproducibility release gate rather than inflating the number of MVPs.

## 9. Target experience

1. **Choose a site.** Select a named place or coordinates. Immediately see terrain coverage and available analysis modes.
2. **Define a mission window.** Set UTC start, duration and instrument height. Advanced settings are optional but recorded.
3. **Inspect visibility.** See the actual skyline, Sun/Earth paths, current state, next transitions, longest darkness/blackout and unknown intervals.
4. **Duplicate a scenario.** Move the date by a week or choose a nearby location while keeping other assumptions fixed.
5. **Compare consequences.** View aligned timelines and differences in usable joint windows, longest outages and data quality.
6. **Apply requirements and share.** Evaluate explicit mission constraints and export a reproducible brief.

Use plain-language screen names such as “Explore”, “Visibility” and “Compare”; keep technical engine names in advanced details. Make the central workflow possible in 2D without requiring 3D manipulation. Use text/icons as well as colour for visible, blocked and unknown states.

## 10. Proposed data and calculation contract

A saved scenario should contain an ID/name, source/notes, latitude/longitude and convention, lunar frame, ground-elevation source/value, instrument height, start/end UTC, dataset identifiers/checksums, kernel identifiers/checksums, horizon sampling/search settings, correction mode and visibility policy.

An analysis result should retain the exact scenario input version, generated timestamp, software/model version, actual source files, coverage masks, warnings, precision settings, horizon, celestial series, event intervals and derived metrics. Results must not inherit a newly edited label when they were computed from old inputs.

Calculation flow:

`site + dataset → ground position → terrain skyline`

`ground position + UTC interval + kernels → Sun/Earth trajectories`

`skyline + trajectories + visibility policy → events/windows → metrics → scenario comparison → requirement checks`

For a point-centre model, clearance is body elevation minus the horizon elevation at that body's azimuth. Interpolate across 359°/0° correctly and refuse to bridge unknown skyline sectors as though known. Finite-disk visibility needs an explicit policy and, for irregular skylines, adequate sampling across the disk; centre clearance alone is insufficient.

Detect events using adaptive temporal refinement, including short/grazing windows; a coarse series or endpoint sign checks alone can miss events. Include the requested final time even when it is not an exact multiple of the sampling step. Keep precision internally and report achieved event tolerance.

Darkness and Earth-blackout totals must distinguish known blocked time from unknown time. “Longest blackout” is limited to the evaluated interval; identify events clipped by its start/end. Earth's centre/disk is an initial geometric proxy, not a particular receiving station.

No terrestrial atmospheric refraction model should be silently applied to the lunar observer. Keep the adopted spherical reference, terrain datum and physical frame explicit.

## 11. Validation and release acceptance

| Area | Required evidence |
|---|---|
| Clean setup | Fresh dependency installation, kernel/data setup instructions, API startup and health/readiness checks |
| Coordinates | Known raster pixels, multiple longitudes, poles, antimeridian, 3D pick-to-raster agreement |
| Terrain | Raw-raster comparisons, nodata tests, clipped-window georeferencing, slope/profile sampling resolution |
| Horizon | Flat sphere, ridges, crater, missing sectors, boundary tests, height sensitivity and search/sampling convergence |
| Ephemeris | Stored independent reference results with frame, time scale, observer elevation and correction settings; actual kernel-boundary tests |
| Visibility | Known analytic/synthetic events, finite disk policy, grazing and short windows, partial coverage, interval boundaries |
| Comparison | Identical scenarios give zero differences; date-only changes reuse correct horizons; incompatible settings are flagged |
| User experience | Browser walkthrough, mobile layout, keyboard flow, readable legends, stale-request/error handling |
| Reproducibility | Export/import produces the same result with the same versions and files |
| Performance | Measured cold/cached response times and memory on a named reference environment; documented request limits |

JPL Horizons supports configurable observer ephemerides, but reference comparisons must match observing-site, frame, timing and output conventions. A numerical disagreement is not automatically a bug until those inputs align. [JPL Horizons manual](https://ssd.jpl.nasa.gov/horizons/manual.html)

Proposed usability target: a first-time user can create a baseline, duplicate it with a seven-day delay and explain the changed windows within two minutes after a short introduction. Proposed performance target: cached two-scenario comparison within five seconds on a specified reference device. These are future acceptance targets, not measured current achievements.

## 12. Delivery plan

**Stage A — Stabilize the implemented foundation.** Resolve F01–F10 and the shared scenario/data contract first. Rerun all tests and document remaining scientific limitations. Add targeted tests for confirmed bugs rather than relying on output-shape assertions.

**Stage B — Complete the first real visibility flow.** Deliver MVP 5 for one validated region, including combined skyline display, unknown propagation, transition refinement, interval metrics and countdowns.

**Stage C — Complete the challenge workflow.** Deliver the smallest useful MVP 6: two saved scenarios, date shifts, aligned timelines, gained/lost windows and reproducible exports. This is higher product priority than expanding the global 3D experience.

**Stage D — Add transparent decision support.** Deliver MVP 7 requirement checks and a decision brief. Expand site coverage and optional power/communications estimates only after the comparison flow is trusted.

Do not assign a completion percentage based on counting modules. The difficult remaining work combines scientific consistency, event detection and a usable comparison experience. Estimates should follow correction of the foundational issues and a benchmark of the visibility engine.

## 13. Scope boundaries

First release: stationary surface observer; validated regional terrain; Sun and Earth geometric visibility; configurable dates/heights; rapid scenario comparison; explicit limitations and evidence.

Later options: terrain visibility heatmaps, moving-rover routes, wider multi-resolution coverage, receiving-station geometry, electrical energy/storage estimates, thermal models and RF link budgets.

Not established by this prototype: certified landing safety, guaranteed electrical power, guaranteed communications service, launch/trajectory optimization or a globally complete terrain model. Terrain slope indicators alone are not a comprehensive landing-hazard assessment.

## 14. Source and implementation index

Local evidence anchors, relative to the repository root:

- Entry/navigation: `src/App.tsx`, `src/components/terrain-analysis/TerrainExplorer.tsx`.
- Explorer/presets: `src/components/controls/CoordinatePanel.tsx`, `src/utils/lunarCoordinates.ts`, `scripts/verify-mvp1.mjs`.
- Terrain data: `backend/app/services/dem_loader.py`, `dataset_catalogue.py`, `raster_window.py`, `profile_service.py`, `terrain_mesh.py`, `terrain_quality.py`.
- Picking/data wiring: `src/components/terrain-explorer/TerrainViewer3D.tsx`, `src/stores/dynamicAnalysisStore.ts`.
- Horizon: `backend/app/services/horizon_service.py`, `backend/app/schemas/horizon.py`, `src/stores/horizonStore.ts`, `src/components/horizon/`.
- Ephemeris: `backend/app/services/ephemeris_service.py`, `kernel_manager.py`, `backend/app/schemas/ephemeris.py`, `src/stores/ephemerisStore.ts`, `src/components/ephemeris/`.
- API/dependencies/tests: `backend/app/main.py`, `backend/requirements.txt`, `backend/tests/`.
- Export behaviour: `src/components/terrain-analysis/ExportToolbar.tsx`.

External references consulted on the audit date:

- [NASA PGDA Product 78](https://pgda.gsfc.nasa.gov/products/78): terrain products, interpolation and uncertainty context.
- [NAIF spkcpo](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/spkcpo_c.html): fixed-observer state calculation and time/frame semantics.
- [JPL Horizons manual](https://ssd.jpl.nasa.gov/horizons/manual.html): independent ephemeris reference configuration.

The supplied challenge and roadmap define the requested product scope. Their progress claims were independently reassessed against this workspace; they were not treated as instructions to implement or certify features.
