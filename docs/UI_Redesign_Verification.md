# LUNAVISTA UI review — 15 November 2026

## Coverage

All nine main destinations received direct UI updates, in addition to the shared lunar theme and Explore / Plan / Decide navigation.

| Workspace | Changes | Source-level validation |
|---|---|---|
| Moon explorer | Selection summary first, shorter catalogue, expandable exact coordinates, clearer view controls | Starting state, coordinate validation and shared selection tests |
| Terrain & visibility | Wrapping mode controls, clearer region/data labels, skyline/Sun/Earth/visibility introductions, readable missing-data states | Main terrain view and three analysis subviews render |
| Mission requirements | More readable profile editor, responsive title/input area, clearer schedule heading | Starting state and saved profile read/edit states render |
| Compare scenarios | Clear add/compare/export actions, named result views, selected-button semantics, continuous scrolling | Main view renders |
| Screen candidate sites | Three-step setup, labelled inputs, native candidate checkboxes, explicit prerequisites, result introduction | Empty and saved-result states render |
| Find mission windows | UTC date pickers, understandable sampling controls, invalid-search guidance, labelled history/sort controls | Empty/saved results, UTC conversion and window-count boundaries |
| Assess landing terrain | Three-step setup, radius explanation, optional name, explicit prerequisites, clearer results | Empty and saved-result states render |
| Balance priorities | Five plain-language result tabs with explanations, study selection, preference editor resets on study switch | All five saved-study views render |
| Decision reports | Clear starting state, gold PDF action, dynamic section count, current-section semantics, reader resets on report switch | Starting state, saved report and all 12 saved report sections render |

All 12 existing modal/detail surfaces use the shared native dialog component: templates, scenario creation, screening export, window export/comparison/detail, terrain export/detail, study creation/export/alternative detail, and report creation. This provides named dialogs, native focus containment, an inert background, Escape-to-close, and focus restoration. Runtime keyboard behavior still requires browser verification.

## Validation completed

- `npm test`: 26 passing tests. These cover coordinate behavior, UTC conversion, window estimates, navigation, initial rendering of all nine destinations, terrain subviews, missing-data safeguards, and dialog markup.
- `npx tsx --tsconfig tsconfig.app.json scripts/verify-workspace-render.ts`: 35 passing checks against locally saved data. Reads existing records without writing them or sending analysis requests. Includes populated results, all five trade-off tabs, all 12 dialogs, profile editing, and each report section.
- `npm run build`: production compilation and bundling.
- `git diff --check`: patch whitespace check.

Rendering tests execute React on the server. They do not run browser effects, WebGL, charts after mounting, downloads, focus behavior, or user interactions. The saved-data script depends on the local backend data files; it is an additional local audit, not a replacement for the repeatable unit suite.

## Remaining browser verification

The browser tool rejected access to http://127.0.0.1:5173/ because a saved permission or managed policy denies observation. No alternate browser or indirect access was used to bypass that restriction.

Once access is available, verify desktop and narrow layouts for every destination; navigation and view switching; form edits and run actions; populated/empty/error states; dialogs with keyboard and Escape; report section selection and exports; terrain/globe/map interaction; and chart sizing. Do not treat the source-level checks above as completed end-to-end verification.

## Onlook

Cloned separately at `C:/Users/jishu/Desktop/onlook`. Its README describes Next.js + Tailwind support and lists non-Next.js support as unfinished. LUNAVISTA uses Vite, so Onlook was not integrated and the app framework was not migrated.
