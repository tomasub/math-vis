# Study visualisations: instructions for Claude

Static study site of interactive math visualisations for a 3rd-year chemical engineering student
at Aalto. Read `README.md` for the architecture. This file holds the rules every session follows.

## Sources of truth

- `docs/catalogue.md`: what each visualisation shows, its controls, fixed values, purpose and
  "check yourself" element. Build exactly what the entry says. If an entry is unclear or seems
  wrong, say so in the report instead of guessing silently.
- `docs/la_notes.txt` + `docs/la_notes_index.md`: the course notes (Hannukainen, Hyvönen, Malinen)
  as searchable text, with an index mapping every definition, theorem, lemma, example and equation
  to a page and a line. Use them for notation, terminology and numbering: look the item up in the
  index or `grep -n "Lemma 1.1.2" docs/la_notes.txt`, then read only those lines with `sed -n`.
  Never invent a number.
- `docs/la_2020_HUGE.pdf`: the original notes. **Don't read it directly** — it is expensive and
  unsearchable. When an exact formula is still ambiguous after the text, render that one page:
  `pdftoppm -r 100 -png -f <page> -l <page> docs/la_2020_HUGE.pdf /tmp/pg`, at most 2 pages per
  visualisation.
- `docs/reference/`: the student's own MATLAB scripts and figures (`unitc.m`, `unit_2.m`,
  `unitspheres*.png`) where they exist. 3.1 should extend them.

## Notation (identical to the notes)

Matrices and subspaces are capitals (A, E). Vectors are bold lower case (**x**, **b**). Scalars are plain
(α, a_ij). R(A) is the range, N(A) the nullspace, e₁…e_n the Cartesian basis, κ(A) the condition
number and σ(A) the spectrum. In KaTeX use `\mathbf{x}` for vectors and `\boldsymbol{\alpha}` for
coefficient vectors.

## Architecture rules

- **Model / view split.** A visualisation file has a pure model (no DOM; `module.exports` for Node)
  and a Preact + htm view that only composes toolkit parts. Copy the pattern of `js/viz/span-explorer.js`.
- **No hand-built DOM or SVG in a visualisation.** If the toolkit lacks something (a curve, a scrubber,
  indicator lights…), add it to the toolkit (`js/toolkit/*`): both stages if it is a scene element,
  documented in the scene-format comment at the top of `stage2d.js`, and shown in `dev/gallery.html`.
  Keep additions small and general.
- **Plain scripts, no build step, no ES modules, no new runtime dependencies.** The site must keep
  working from `file://`. Libraries load lazily via `needs` / `SV.load` (`katex`, `three`, `plot`).
- **Colours only through CSS tokens** (`--q1`…`--q4`, `--accent`, `--warn`, `--text`, `--muted`…),
  so light and dark mode both work.
- Don't modify another visualisation's files except to fix a bug you caused through the toolkit.

## Numerical rules

- Rank and zero decisions use `tol = 1e-10·max(1, ‖A‖₂)` and show tol in the "Fixed by system" panel.
- Handle edge cases explicitly: singular and near-singular matrices, zero vectors, p → ∞ (use the max
  norm exactly, not a large p), complex eigenvalues, an empty solution set. When a value is undefined,
  show "undefined" plus the reason. Never show NaN, Infinity or a silently wrong number.
- Prefer closed forms for 2×2 cases and stable algorithms otherwise. Put new math in `js/math/`
  with JSDoc, not inside a visualisation.
- Every new math function gets NumPy reference cases in `tests/make_fixtures.py` (then
  `npm run fixtures`) and a comparison in the tests. If a visualisation demonstrates a numerical
  failure (floating point, normal equations…), the failure must be computed, never scripted.

## Definition of done for one visualisation

1. Manifest entry in `content/courses.js`: `status: "ready"`, `module`, `needs`, `source`
   (e.g. "Lecture 2 · Cor 1.1.1") and `purpose_html` in the notes' notation.
2. Every item of the catalogue entry is implemented: Shows, User controls, Fixed by system (listed
   in a "Fixed by system" panel), Purpose, Check yourself (predict → reveal; the answer stays hidden
   until revealed) and any Note or Correction to flag in the UI.
3. Model tests in `tests/viz/<id>.test.js`: default state, each control, each edge case, and the
   text and TeX output.
4. `npm test` passes, all of it, not just the new file.
5. `npm run smoke -- <id>` passes, and you have looked **once, at the end** at
   `tests/shots/<id>-light.png`, `-dark.png` (and `-3d.png`) and fixed anything that looks wrong:
   overlap, clipping, unreadable labels, colours that don't change in dark mode. Use
   `npm run smoke -- <id> --no-shots` for intermediate runs where you only need to know it mounts.
   A default state or preset that sits outside the [−3, 3] axis range, or that one drag or arrow-key
   press silently invalidates, is a defect.
6. Keyboard: every draggable point can be nudged with the arrow keys, and every control can be
   reached with Tab.
7. Write `docs/reports/<id>.md` (at most about 25 lines): what was built, toolkit changes, deviations from the
   catalogue and why, numbers checked against the notes, open questions.

## Commands

```
npm test                          # unit + NumPy-reference + per-visualisation tests
npm run smoke -- 1.2              # browser check + screenshots of the .viz element, light and dark
npm run smoke -- 1.2 --no-shots   # same checks, no screenshots (fast, nothing to look at)
npm run fixtures                  # regenerate tests/fixtures.json (needs numpy)
open dev/gallery.html             # toolkit gallery
```

Smoke needs Playwright once: `npm install && npx playwright install chromium`.

## How a batch is built

`/build-visualisations <ids> [--parallel N]` runs three phases: a cheap **plan**
(`docs/plans/<batch>.md`), one sequential **toolkit** builder that adds every shared part the batch
needs, then **parallel** builders — one visualisation each, in its own git worktree, merged back one
at a time. In the visualisation phase a builder may only create or edit `js/viz/<file>.js`,
`tests/viz/<id>.test.js`, `docs/reports/<id>.md` and the `"status"` field of its own manifest entry;
anything it needs from the toolkit goes in its report as `TOOLKIT REQUEST: …`. `scripts/build-all.sh`
does the same unattended.
