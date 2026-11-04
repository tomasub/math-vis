# Prompt: build the Lecture 1–3 visualisations (one model, interactive)

Paste everything below the line into Claude Code in VS Code, with the model set to Sonnet (`/model sonnet`).
For the supervised version (Opus reviews, Sonnet builds) run `/build-visualisations 1.2 1.3 2.1 2.2 2.3 3.1 3.2 3.3` instead.

---

Build the visualisations for Lectures 1–3 of the linear algebra course, **one at a time**, in this order:
**1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3**. 1.1 is already done. It is the reference implementation;
copy its pattern.

Before you start:
1. Read `CLAUDE.md` (rules and the definition of done), `README.md` (architecture), the 1.1 files
   (`js/viz/span-explorer.js`, `tests/viz/1.1.test.js`), `js/toolkit/stage2d.js` (the scene format)
   and `js/toolkit/ui.js`.
2. Read the catalogue entries for all eight in `docs/catalogue.md`. List the toolkit parts each one
   needs that don't exist yet. Expect at least:
   - curves/polylines in both stages (3.1 unit spheres, 3.3 ellipses and hyperbolas)
   - a play/scrub animation control (2.1)
   - indicator lights (2.3)
   - two linked stages side by side (1.2)
   - a "check yourself" predict → reveal component (1.2)
   - a bar comparison (2.1, 3.1, 3.2)
   - a small side plot (3.3; use `ui.Chart`)

   Show me that list and your plan for the toolkit before writing code. Wait for my OK.

For each visualisation, in order:
1. Read its catalogue entry and the matching pages of `docs/la_2020_HUGE.pdf`. Use the PDF's
   numbering for every definition, theorem, example and equation you cite.
2. Write the pure model first, with tests in `tests/viz/<id>.test.js`. Put new math in `js/math/`,
   with NumPy reference cases in `tests/make_fixtures.py` (`npm run fixtures`). Get `npm test` green.
3. Add any missing toolkit part in general form. That means both stages for scene elements, a demo
   in `dev/gallery.html`, and docs in the scene-format comment. Re-run `npm run smoke -- 1.1` to
   prove nothing broke.
4. Build the view from toolkit parts only, then update the manifest entry.
5. Run `npm run smoke -- <id>`, open every screenshot it lists, and fix what looks wrong.
6. Go through the catalogue entry bullet by bullet and the definition of done item by item.
   Write `docs/reports/<id>.md`.
7. Stop and give me a 5-line summary. Then wait for my "next" before starting the next one, so I
   can try it in the browser and commit.

Specific things to get right:
- **1.2:** both presets from the notes (Example 1.1.1 and Example 1.1.2). Verify N(A) for
  Example 1.1.2 is span[−1, −1, 1]ᵀ. Show the distance from **b** to R(A) when there's no solution.
  The verdict stays hidden until the student has predicted 0, 1 or ∞.
- **2.1:** the complement is N(A)^⊥, and the UI says any complement works. The rank slider
  generates a matrix of exactly that rank; test that.
- **2.2:** the sampler uses real random b from a ball, and for tall A explains why almost every
  sample is unsolvable.
- **2.3:** the six conditions are each computed independently, not one result copied six times,
  and each shows its number. Include the note that ‖A⁻¹‖, not det A, tells you how close A is to
  singular.
- **3.1:**
  - Look at `docs/reference/` (unitc.m, unit_2.m, unitspheres*.png) and match their construction
    (1000 directions, ρ = 1/‖x‖_p).
  - p uses a log slider from 1 to 50, plus an ∞ button that uses the max norm exactly.
  - p < 1 is labelled "not a norm; triangle inequality fails" and marked as extra (not in course
    notes).
- **3.2:** C–S equality only when **x** ∥ **y** (decide that with tol). Mode B keeps q₂ ⟂ q₁ exactly.
- **3.3:** symmetry is enforced. Positive definiteness is decided by eigenvalues with tol. The
  semidefinite and indefinite cases say "not an inner product" and why. The Example 1.2.1 preset
  is A = [1 ½; ½ ⅓].

General rules:
- Never fake a number or a numerical behaviour.
- Never weaken a test to make it pass.
- Never start the next visualisation without my "next".
- If the catalogue and the notes disagree, follow the notes and tell me.
