# MVP 1 implementation and verification

Date: 14 November 2026. Scope: Lunar Explorer improvements from the updated MVP roadmap.

## Implemented

- Searchable preset catalogue with place-type filters, empty-result recovery, selected-place state, source links, coordinate notes and review dates.
- Apollo 11/12/17 Lunar Module coordinates corrected to the NASA NSSDCA list. Approximate landmarks and the Connecting Ridge navigation point are explicitly distinguished from surveyed landing sites.
- Labelled decimal coordinate inputs, finite/range validation, reset, clipboard success/failure feedback and live selection announcements.
- Shared map/globe selection, manual-input map recentering, globe camera focus for external selection, drag-versus-click protection and selection preservation across view modes.
- Site01 coverage computed using the polar projected raster footprint, with a densified outline on the map. Footprint membership is not described as valid-pixel or horizon coverage.
- Imagery/elevation separation: global explorer uses imagery and a reference sphere; elevation-derived rendering remains in Terrain Explorer. Removed automatic backend requests and geographically stretched terrain overlay from the global imagery view.
- Persistent NASA imagery attribution, beginner guidance, plain-language controls, semantic labels/pressed states, visible focus, keyboard site selection and reduced-motion support.
- Responsive stacked mobile views, scrollable location controls, desktop panel toggle and accessible skip navigation.
- Imagery failure/status/retry handling, cancellable globe texture requests, bounded progressive loading, WebGL fallback, and duplicate/stale close-up tile protection.
- Lazy-loaded Terrain Explorer reduces the initial JavaScript bundle; a bundle-size warning remains.
- Removed unused `three-tile`, whose Three.js peer version conflicted with the actual application dependency and prevented normal dependency installation.

## Verification evidence

- Six source-module regression tests passed with `npm test`.
- Production TypeScript/Vite build passed.
- Existing explorer coordinate/distance and live NASA imagery verification passed; all four sampled NASA endpoints returned HTTP 200.
- Five browser regression cases were added for validation/recentering, catalogue/provenance/keyboard selection, globe selection/drag, mobile layout, and imagery failure/retry.
- Browser tests did **not** execute successfully: the initial runner lacked its headless executable; the downloaded full Chromium runner then failed to launch with `spawn UNKNOWN`. No assertion result is claimed from those attempts.
- A subsequent attempt to inspect the local app through the connected browser was denied by the origin permission gate. Browser inspection was stopped; no alternate browser route was used after that denial.

Implementation is delivered and the local development server is running at `http://127.0.0.1:5173/`. Final visual, interactive and assistive-technology acceptance remains pending browser access. Do not label MVP 1 fully verified until that gate passes.

## Remaining acceptance gate

Run `npm run test:e2e` in an approved browser environment, then inspect actual live imagery at desktop and mobile sizes. Confirm named/custom selections, both poles and longitude seams, 2D/3D/split toggles, globe/map clicks, keyboard-only entry, search/filter, source disclosure, coverage messaging, network retry and a WebGL-unavailable device. Confirm layout/readability with real assistive technology where available; semantic improvements are not a formal accessibility conformance certification.

## Sources

- [NASA NSSDCA Apollo Lunar Module coordinates](https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html): planetocentric Mean Earth / Polar Axis, DE421.
- [NASA PGDA Product 78](https://pgda.gsfc.nasa.gov/products/78): Site01 terrain source. The preset itself is the project's raster-centre navigation point.
- [LROC initial Chang'e 4 location](https://www.lroc.im-ldi.com/images/1087): retained as a labelled initial estimate rather than a new refined solution.
- [USGS Copernicus](https://planetarynames.wr.usgs.gov/Feature/1296) and [Tycho](https://planetarynames.wr.usgs.gov/Feature/6163): landmark context; approximate project points are not surveyed landing coordinates.

No commits or pushes were made for this delivery. The earlier product audit remains a historical baseline; this note records the subsequent MVP 1 changes.
