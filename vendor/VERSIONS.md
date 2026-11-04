# Vendored libraries

All files are copied unchanged from the npm packages below (pinned versions). Each folder keeps the upstream licence.

| Folder | Package | Version | Licence | Used for |
|---|---|---|---|---|
| `preact/` | htm (Preact standalone build) | 3.1.1 | Apache-2.0 (htm), MIT (Preact) | components without a build step (global `htmPreact`) |
| `katex/` | katex | 0.16.11 | MIT | formulas (woff2 fonts only) |
| `three/` | three | 0.159.0 | MIT | 3D stage; last release with the plain-script build `three.min.js` |
| `plot/` | d3 7.9.0, @observablehq/plot 0.6.16 | — | ISC | charts (`ui.Chart`) |
| `fonts/` | @fontsource/ibm-plex-sans 5.0.20, @fontsource/ibm-plex-mono 5.0.13 | — | SIL OFL 1.1 | site typeface (Latin subset) |

three.js r159 prints a console warning that `build/three.min.js` is deprecated. It still works; switching to the
ES-module build later means giving up opening the site from `file://`.
