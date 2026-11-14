# LUNAVISTA

Lunar exploration using NASA Moon Trek / LRO WAC imagery, a synchronized 2D map and 3D reference globe, sourced place presets and explicit terrain coverage.

## Run the explorer

Use Node.js 22 or later and npm:

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Open [the local app](http://127.0.0.1:5173/). NASA imagery requires an internet connection. MVP 1 works without the Python backend; imagery outages retain coordinate and catalogue controls and expose retry actions.

The explorer provides manual coordinates, searchable place types, source notes, map/globe/split views, keyboard selection and responsive controls. Positive coordinates mean north/east; negative coordinates mean south/west.

The global globe is an imagery sphere, with illustrative lighting. The green map outline is the local Site01 DEM footprint, not a guarantee of valid pixels, backend availability or complete terrain-horizon coverage. Elevation-derived visualization remains in Terrain Explorer. A place preset does not certify landing suitability.

## Check changes

```sh
npm test
npm run build
node scripts/verify-mvp1.mjs
npx playwright install chromium
npm run test:e2e
```

`npm test` exercises actual coordinate, globe conversion, coverage, catalogue and shared-state modules. The existing verification script additionally checks live NASA endpoints. The five browser regression cases use mocked imagery transport so external availability does not determine interaction-test results; they do not validate scientific imagery content. Browser installation/execution must be allowed in the testing environment.

## Terrain and later MVPs

The Python backend and local DEMs are needed only for Terrain Explorer and later scientific analysis. Existing `backend/requirements.txt` is incomplete (including missing SpiceyPy); see the product audit before treating it as a reproducible backend setup. MVP 1 changes do not certify the horizon, ephemeris or visibility engines.

See [MVP 1 delivery and verification](docs/MVP1_Delivery.md), [updated roadmap](docs/LUNAVISTA_Updated_MVP_Roadmap.md), and [product audit](docs/LUNAVISTA_Product_Document.md).
