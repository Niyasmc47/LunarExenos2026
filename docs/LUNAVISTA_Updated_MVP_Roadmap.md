# LUNAVISTA — Updated MVP roadmap

Audit date: 14 November 2026. Baseline: branch `zundiac`, commit `d3ab20bd25a028857cea4b4a5729bc90f2a6f363`.

This replaces the status assessment in the supplied roadmap, not its original source file. It is based on the supplied challenge statement, repository inspection, a frontend build, the existing explorer verification script, backend test attempts, and direct terrain-service checks. Detailed evidence is in [the product document](LUNAVISTA_Product_Document.md).

## Product objective

Help a user quickly compare lunar landing locations and dates by showing the Sun and Earth against the actual terrain horizon, together with illumination opportunities, Earth line-of-sight windows, and the consequences of a schedule or site change.

The core challenge is not complete until the user can compare scenarios. Terrain exploration and ephemeris calculations are supporting capabilities.

## Corrected status

| MVP | Current status | What prevents completion |
|---|---|---|
| 1. Lunar Explorer | Implemented; build and explorer verification passed | Browser interaction/accessibility audit still needed |
| 2. Terrain Engine and Explorer | Implemented; selected local services verified | Coordinate picking, partial-coverage mapping, data-quality claims and dataset consistency need fixes |
| 3. Terrain Horizon Engine | Implemented; local calculation verified | Dataset fallback, per-ray unknowns, sampling correctness and complete-horizon validation |
| 4. Sun and Earth Ephemeris | Implemented in source; runtime verification blocked | Missing `spiceypy`; dataset/elevation consistency and independent validation |
| 5. Terrain-aware Visibility and Operational Windows | Not implemented as an integrated capability | Horizon and ephemeris must be combined; event detection and metrics absent |
| 6. Rapid Scenario Comparison | Not implemented | Saved scenarios, shared timeline and baseline-versus-alternative comparison |
| 7. Mission Requirements and Explainable Decision Support | Not implemented | Explicit thresholds, evidence-linked decisions and reproducible reports |

“Implemented” means source exists and is connected in the app; it does not mean scientifically validated or fully working end to end. The backend test suite currently stops during collection with four errors because `spiceypy` is missing.

## Immediate release gate: repair the shared foundation

Treat this as required work across MVPs 1–4, not as an eighth feature MVP.

- Declare all runtime dependencies, including SpiceyPy and Pillow, and document a clean setup. Rerun the complete backend suite.
- Use one observer definition across screens: coordinates, terrain dataset, sampled ground elevation, instrument height, lunar frame and calculation settings.
- Fix 3D picking using the DEM's projected coordinates or actual mesh coordinates; do not interpolate geographic bounds linearly from texture coordinates.
- Stop substituting Site01 when another terrain dataset is requested. Reject unavailable data or offer an explicit, recorded alternative.
- Preserve actual raster-window transforms and coverage masks when a selection crosses a dataset boundary.
- Replace invented measured/interpolated labels with evidence from the count layer; use “unknown” when that evidence is unavailable.
- Represent missing horizon directions as unknown, not a zero-degree horizon.
- Change current “Solar Power Active” and “Link Connected” claims to geometric position descriptions until the relevant models exist.
- Prevent old results from appearing to belong to newly edited inputs; show loading, stale, error and unknown states explicitly.

Acceptance: a fresh setup starts successfully; automated tests run; all analysis panels identify the same observer and actual data source; unavailable data cannot produce a confident operational status.

## MVP 1 — Lunar Explorer and accessible site selection

**Goal:** Choose and understand a location without needing specialist tools.

Already present:

- 2D lunar imagery map, 3D globe, manual coordinates and synchronized selection state.
- Named presets, including Apollo sites, Connecting Ridge, Shackleton and Chang'e 4.
- NASA imagery integration and local terrain-overlay infrastructure.

Complete or improve:

- Search/filter the site catalogue; distinguish landing locations from landmarks and candidate regions.
- Record coordinate sources, reference frames and verification dates for presets. Expand CLPS/international presets only with sourced coordinates; they are helpful, not mandatory for the challenge.
- Make imagery-only coverage and terrain-analysis coverage visibly different.
- Provide keyboard coordinate/site selection, readable labels, screen-reader descriptions and responsive controls.
- Add an introductory explanation of lunar azimuth, elevation, Earth visibility and terrain obstruction.

Acceptance: a user selects a preset or custom location, switches views without moving it, sees coverage status, and can complete the same task without manipulating the 3D globe.

## MVP 2 — Reliable Terrain Engine and Explorer

**Goal:** Inspect real terrain while preserving its location, resolution and limitations.

Already present:

- Local Site01 elevation and slope rasters; regional catalogue/discovery code.
- Elevation/slope maps, hillshade, DEM mesh, point inspection, profiles and statistics.
- Terrain CSV/GeoTIFF export paths and provenance panels.

Complete or improve:

- Apply the selected dataset consistently to maps, mesh, inspection, profiles, horizon and ephemeris observer height.
- Verify each remote dataset URL, footprint, CRS, datum and actual availability; catalogue entries alone are not proof of working coverage.
- Correct mesh picking, clipped-window placement and pixel-centre conventions.
- Compute scientific sampling/statistics at documented resolution; label display-resampled statistics as approximate.
- Support partial coverage and unknown quality explicitly; ingest count and uncertainty companions where available.
- Verify transect distances and projection distortion for the supported region; handle pole and longitude-wrap selections.
- Clearly label hillshade as illustrative lighting, separate from time-dependent solar visibility.

Acceptance: reference points reproduce source-raster values within declared sampling tolerances; clicked positions match the mesh; clipped exports preserve georeferencing; nodata stays unknown; source and effective resolution are visible.

## MVP 3 — Validated Terrain Horizon

**Goal:** Establish the actual terrain skyline for the chosen observer.

Already present:

- 360-degree ray sampling, horizon angle/distance/location, observer-height input and spherical curvature calculation.
- Polar and Cartesian horizon visualizations, 3D observer interaction and aggregate coverage warnings.
- Synthetic flat, ridge, crater and height tests in source; these did not execute in the full suite during this audit.

Complete or improve:

- Correct dataset resolution and pixel-centre alignment; validate near-horizon numerical precision and projected-distance approximations.
- Add per-direction validity, search extent, source, uncertainty and completeness information.
- Use null/unknown for missing rays; fix extrema-to-azimuth indexing when some rays have no samples.
- Establish distant-terrain adequacy through convergence checks; use compatible regional/coarser terrain explicitly when needed.
- Distinguish “all samples inside this search radius exist” from “the full skyline is known.”
- Validate multiple observer longitudes, cardinal directions, boundaries, nodata gaps and azimuth wraparound.
- Limit memory/work per request and cache horizons independently of date.

Acceptance: synthetic and source-raster benchmarks pass; increasing search extent/resolution demonstrates a documented convergence bound; incomplete rays remain visibly unknown and cannot silently certify visibility.

## MVP 4 — Validated Sun and Earth Ephemeris

**Goal:** Return reproducible apparent positions from the same physical observer used by the horizon engine.

Already present in source:

- NAIF SPICE kernel loader and bundled kernels; topocentric Sun/Earth calculations using `spkcpo`.
- Azimuth, elevation, distance, disk diameter and light time.
- UTC controls, time series, stepping/playback and kernel provenance.

Complete or improve:

- Restore backend startup by declaring/installing the missing dependency through the normal project setup.
- Sample elevation from the requested dataset; expose an explicit reference-sphere mode when no terrain is available.
- Return the same fallback warnings for single positions and time series.
- Derive valid dates from the intersection of loaded kernel coverage, rather than approximate hard-coded seconds.
- Preserve precise values for event calculations; round only presentation values.
- Store independent reference queries/responses and compare multiple locations, dates, heights and frame conventions.
- Keep time controls, plots, selected observer and returned timestamps synchronized; discard superseded responses.

Acceptance: API and browser flows run on a clean setup; independent benchmarks pass with documented tolerances; invalid dates fail clearly; reference-sphere results cannot be confused with terrain-aware visibility.

## MVP 5 — Terrain-aware Visibility and Operational Windows

**Goal:** Answer “What can this site see, when, and for how long?”

Required:

- Overlay Sun/Earth positions and trajectories on the calculated terrain skyline for the identical observer.
- Calculate centre-point clearance and separately define full/partial disk visibility. Unknown terrain must propagate into unknown visibility.
- Generate Sun visibility and Earth line-of-sight intervals, total/percentage visible time, longest darkness and longest Earth blackout.
- Calculate next sunrise/sunset and Earthrise/Earthset with countdowns from the selected time. Say “outside evaluated interval” when an event is not found.
- Show joint states: both visible, Sun only, Earth only, neither, plus unknown/indeterminate.
- Refine transition times adaptively and validate convergence; detect short windows and grazing events that coarse samples can miss.
- Show event precision, horizon resolution, interval boundaries and coverage limitations. Report boundary-truncated events explicitly.
- Provide synchronized timeline scrubbing/playback and prominent solar elevation/terrain-clearance metrics.
- Define Earth-disk visibility as a geometric proxy; a specific ground station's visibility is a separate extension.

Acceptance: known ridge/occultation cases pass; integrated metrics match event intervals; short windows survive refinement; all views agree at the same time; no power or radio connection is inferred solely from visibility.

Regional heatmaps are a later enhancement, after point calculations are reliable. Full battery, thermal and RF simulations are not prerequisites for this MVP.

## MVP 6 — Rapid Site and Date Scenario Comparison

**Goal:** Make the challenge's central workflow usable: compare alternatives after a landing delay or location change.

Required:

- Create, name, duplicate, save/reload and remove scenarios containing site, coordinates, date/time, duration, observer height, dataset and calculation settings.
- Compare at least two scenarios side by side; support same site/different dates and different sites/same mission window.
- Add quick date shifts such as +1 day and +7 days, plus nearby-site alternatives.
- Provide aligned timelines in absolute UTC and elapsed mission time; clearly identify the chosen alignment.
- Show sunlight, darkness, Earth visibility, blackout and joint visibility metrics with baseline-relative differences.
- Highlight windows gained/lost; show incomplete or incompatible data instead of forcing a ranking.
- Reuse cached terrain horizons when only time changes; show progress, cancellation and stale-result status.
- Export/import reproducible scenario JSON and comparison CSV; provide a readable summary. Shareable links may follow if hosting/persistence is introduced.

Acceptance: changing a baseline to a delayed date produces a reproducible comparison without re-entering coordinates; results retain their scenario identity and source settings after reload/export.

## MVP 7 — Mission Requirements and Explainable Decisions

**Goal:** Explain which evaluated alternatives satisfy user-defined requirements and why.

Required:

- Accept explicit thresholds: maximum darkness, maximum Earth blackout, minimum joint visibility, terrain constraints and optional minimum elevation margin.
- Return pass/fail/unknown for each requirement, linked to the interval or terrain evidence.
- Let teams add science objectives/notes separately from computed engineering metrics.
- Rank only evaluated alternatives using disclosed criteria; show trade-offs and missing evidence rather than an arbitrary universal score.
- Provide an exportable decision brief with scenario settings, findings, charts, sources, model versions, limitations and reproducibility information.
- Offer clear beginner explanations with optional technical detail.

Optional later extensions:

- Solar-energy estimates with panel orientation, area, efficiency and losses; storage/load assumptions for survival estimates.
- Specific Earth ground-station visibility and RF link-budget estimates with antenna, frequency, power, pointing, margin and scheduling inputs.
- Thermal modelling only with appropriate physical/system inputs; illumination duration alone is not a temperature estimate.

Acceptance: every recommendation can be traced to stated inputs, constraints and evidence; insufficient coverage yields unknown; no “safe” or “mission-ready” certification is implied.

## Requirements strengthened or added to the original roadmap

The original roadmap already covered curvature, finite disks, transition refinement, provenance and geometric-versus-engineering distinctions. Preserve these; they were not missing. The main additions are explicit product workflows and completion criteria:

| Addition or clarification | Why it matters | Owner |
|---|---|---|
| One shared observer/scenario contract | Prevents mixing sites, heights or datasets | All, especially 2–5 |
| One combined sky-and-terrain view | Directly answers the challenge's visualization requirement | 5 |
| Sunset/Earthset countdowns | Operationally useful beyond a position plot | 5 |
| Delay/nearby-site comparison with visible deltas | Makes replanning quick | 6 |
| Save, reload, share/export settings | Supports team review and reproducibility | 6–7 |
| Beginner explanations and accessibility acceptance | Serves educators/public as well as specialists | 1, 5–7 |
| Explicit unknown/stale/partial states | Stops missing or old data becoming a confident answer | All |
| Distant-horizon completeness and error budget | A finite local patch may omit blocking terrain | 3–5 |
| Ground-station versus Earth-disk distinction | Earth visibility alone is not a usable link | 5, optional 7 |
| Work limits, caching and performance targets | Rapid comparison must also be responsive | 3–6 |
| Reproducible deployment and release tests | Source implementation must work on another machine | All |

## Delivery order and release scope

1. Repair shared correctness/startup issues and verify MVPs 1–4.
2. Deliver MVP 5 for a clearly supported south-pole region.
3. Deliver a minimal MVP 6 immediately afterward: baseline plus one alternative and date-shift comparison.
4. Add MVP 7 requirement checks and the decision brief.
5. Expand coverage, catalogue content, regional heatmaps and optional engineering models.

The first challenge-complete release needs a validated location-to-visibility-to-comparison flow. Do not delay comparison to build a global high-detail terrain model or advanced RF/thermal simulation.

Suggested product acceptance targets, to benchmark rather than present as current performance: first saved baseline and alternative within two minutes in a usability session; cached comparison within five seconds on a documented reference device; keyboard-accessible core flow; every result carries its inputs, coverage and provenance.
