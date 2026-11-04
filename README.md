---
date created: 2026-11-04T13:11
date modified: 2026-11-04T13:11
---
# Infoa prototyypistä

Tein prototyypin Claude Opus 5.5 -mallilla, ja jatkan sen kehitystä kunnes saan kokonaisen sivun vähintään lineaarialgebran visualisaatioille. Kehitin prototyyppiä aste kerrallaan, ensin wireframe-mallilla, sitten lisäämällä osioita ja suunnittelemalla niiden sisällöt, ja lopuksi tekemällä osaan 1.1 proof-of-concept -mallin.

# Study visualisations

Interactive visualisations for chemical engineering math courses, organised as
courses → lectures → visualisations. Static site: plain HTML, CSS and JavaScript,
no build step, no backend.

Linear algebra follows the Aalto *Linear Algebra* lecture notes (Hannukainen, Hyvönen,
Malinen). Its catalogue has 34 visualisations; **1.1 Span and linear independence
explorer** is built, the rest are placeholders.

## Open it

- **Double-click `index.html`.** Everything is a plain script and all libraries are in
  `vendor/`, so it works from disk and offline. Unzip the whole folder first: opening
  `index.html` from inside a zip preview gives the page without its scripts.
- **Or serve it:** `python3 -m http.server 8000` in this folder, then http://localhost:8000.
- **GitHub Pages:** push the folder and enable Pages. Routes are hash-based (`#/la/1.1`),
  so no rewrites are needed. `.nojekyll` is included.

If the app ever fails to start, the page says so after a few seconds and lists the
script errors, instead of showing "Loading…" forever.

## Tests

```sh
node tests/run.js                 # 187 checks, Node 18+, no dependencies
python3 tests/make_fixtures.py    # regenerate NumPy reference results (needs numpy)
```

`tests/fixtures.json` holds results computed by NumPy/LAPACK (eigenvalues, ‖·‖₂, rank
with tol, first linear relation). The JS math is checked against them, so it is tested
against an independent implementation, not just against hand-picked cases. Add new
cases to `make_fixtures.py` whenever you add math (SVD, QR, expm, …).

`dev/gallery.html` shows every toolkit component on one page; use it after changing one.

## How a visualisation is built

Each visualisation is two parts in one file:

1. **Model**: pure functions, no DOM. `initial()` gives the state, `derive(state)` the
   computed values, `scene(state, derived, onMove)` a plain-data description of what to
   draw, `tex(…)` the formulas. Node tests import this directly.
2. **View**: a small Preact component (written with `htm`, no JSX/build) that composes
   toolkit pieces and passes the scene to a stage.

```
scene → SV.stage.Stage → Stage2D (SVG)            for dim 2
                       → Stage3D (three.js/WebGL)  for dim 3, falls back to Stage2D without WebGL
```

The stages handle drawing, dragging, orbiting, keyboard nudging (arrows; Page Up/Down
for x₃), focus rings, screen-reader labels and the light/dark theme. A visualisation
only says what is in the scene. The scene format is documented at the top of
`js/toolkit/stage2d.js`.

Toolkit (`SV.ui`): `Seg`, `Check`, `Btn`, `Slider`, `MatrixEditor`, `Panel`, `KV`,
`Tex` (KaTeX, with `\htmlClass{q1}{…}` for series colours), `Chart` (Observable Plot),
`useMerge` (state hook with object merging).

## Structure

```
index.html               app shell + start-up check
css/style.css            styles; colour tokens for light/dark at the top
css/fonts.css            IBM Plex @font-face (vendored)
content/courses.js       manifest: courses → lectures → visualisations
js/core.js               SV namespace, lazy library loader, visualisation registry
js/app.js                router + pages generated from the manifest
js/math/linalg.js        numerics (Jacobi eigenvalues, ‖·‖₂, rank with tol, relations, formatting)
js/toolkit/ui.js         controls, panels, Tex, Chart
js/toolkit/stage2d.js    scene format + SVG stage
js/toolkit/stage3d.js    three.js stage
js/viz/span-explorer.js  1.1 (model + view)
tests/                   run.js, make_fixtures.py, fixtures.json
dev/gallery.html         toolkit gallery
vendor/                  pinned libraries, see vendor/VERSIONS.md
```

## Add a course or a planned visualisation

Edit `content/courses.js`.

- **A course:** add `{ "id", "title", "group", "status": "placeholder", "note", "lectures": [] }`
  to `courses` (`group` must be one of `groups`).
- **A lecture:** add `{ "n", "title", "sections", "visualisations": […] }` to a course's `lectures`.
- **A planned visualisation:** add `{ "id", "title", "refs", "interaction", "star", "status": "placeholder" }`.
  It gets a "not built yet" page automatically.

## Build a visualisation

1. Copy `js/viz/span-explorer.js` as a starting point. Keep the model pure and register the
   view with `SV.viz.register('<id>', { component, needs: ['katex'] })`. `needs` lists the
   libraries to load first (`katex`, `three`, `plot`); the 3D stage loads three.js itself.
2. In the manifest entry set `"status": "ready"`, `"module": "js/viz/<file>.js"`,
   `"needs"`, and optionally `"source"` and `"purpose_html"`.
3. Add model tests to `tests/run.js` and NumPy cases to `tests/make_fixtures.py` for new math.

## Conventions

- Notation as in the notes: R(A), N(A), κ(A), σ(A), bold vectors.
- Rank and zero decisions use `tol = 1e-10·max(1, ‖A‖₂)`, shown in the UI.
- Colours only through CSS tokens (`--q1`…`--q4` for series, `--accent`, `--warn`, …).
- Undefined values are shown as undefined, with the reason, never as a number.
