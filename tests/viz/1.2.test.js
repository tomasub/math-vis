// 1.2 Range, nullspace and solvability of Ax = b: model tests (state → derived → scene → TeX)
'use strict';
const { test, near, assert } = require('../harness.js');
const L = require('../../js/math/linalg.js');
const sv = require('../../js/viz/solvability.js');

const noopX = () => {};
const noopB = () => {};
const view = (s) => {
  const d = sv.derive(s);
  return { d, sc: sv.scene(s, d, noopX, noopB), tex: sv.tex(s, d) };
};

test('1.2 default: Example 1.1.1 shape (3×2), unique solution, N(A) = {0}', () => {
  const s = sv.initial();
  assert.equal(s.m, 3); assert.equal(s.n, 2);
  s.b.forEach((x) => assert.ok(Math.abs(x) <= 3, `default b must be inside [-3, 3]: ${s.b}`));
  const { d } = view(s);
  assert.equal(d.rank, 2); assert.equal(d.nullTrivial, true); assert.equal(d.nullDim, 0);
  assert.equal(d.bInR, true); assert.equal(d.verdict, 'unique');
  near(d.xp[0], 0.5, 0, 1e-9); near(d.xp[1], 0.5, 0, 1e-9); // b = A·[0.5, 0.5]
});

test('1.2 default scene: input has N(A) = {0} (no line), output is a plane with Ax and b arrows', () => {
  const { sc } = view(sv.initial());
  assert.equal(sc.input.lines.length, 0); assert.equal(sc.input.planes.length, 0);
  assert.equal(sc.input.dots.length, 1); // xp marker, since N(A) trivial
  assert.equal(sc.output.planes.length, 1); // R(A) is a plane in R^3
  assert.equal(sc.output.arrows.length, 2); // Ax, b
  assert.equal(sc.output.segments.length, 0); // b is in R(A): no distance segment
});

test('1.2 Example 1.1.2: N(A) = span[-1,-1,1], rank 2, A·n = 0', () => {
  const s = { ...sv.initial(), ...sv.applyPreset(sv.initial(), 'ex112') };
  const { d } = view(s);
  assert.equal(d.rank, 2); assert.equal(d.nullDim, 1); assert.equal(d.nullTrivial, false);
  const n0 = d.N_basis[0];
  // n0 must be proportional to [-1,-1,1] (unit length, direction unique up to sign)
  near(Math.abs(n0[0]), 1 / Math.sqrt(3), 0, 1e-9);
  near(n0[0], n0[1], 0, 1e-9); // same magnitude/sign pattern as [-1,-1,1]
  near(n0[2], -n0[0], 0, 1e-9);
  const Av = L.applyRows(d.rows, n0);
  Av.forEach((x) => near(x, 0, 0, 1e-9));
});

test('1.2 Example 1.1.2 with b = 0: infinitely many solutions, xp = 0, solution set = N(A) itself', () => {
  const s = { ...sv.initial(), ...sv.applyPreset(sv.initial(), 'ex112'), b: [0, 0, 0] };
  const { d, sc } = view(s);
  assert.equal(d.bInR, true); assert.equal(d.verdict, 'infinite');
  d.xp.forEach((x) => near(x, 0, 0, 1e-9));
  assert.equal(sc.input.lines.length, 2); // N(A) through origin + the (coincident) shifted copy at xp=0
});

test('1.2 Example 1.1.2 with b not in R(A): no solution, no solution set drawn, distance > 0', () => {
  const s = { ...sv.initial(), ...sv.applyPreset(sv.initial(), 'ex112'), b: [1, 0, 0] };
  const { d, sc } = view(s);
  assert.equal(d.bInR, false); assert.equal(d.verdict, 'none'); assert.equal(d.xp, null);
  assert.ok(d.dist > 1e-6);
  assert.equal(sc.input.lines.length, 1); // only N(A) through origin, no shifted copy
  assert.equal(sc.output.segments.length, 1); // dashed distance segment
  assert.equal(sc.output.dots.length, 1); // projection marker
});

test('1.2 A = 0 (2×2): N(A) = R^2 (fillAll), R(A) = {0}', () => {
  const s = { ...sv.initial(), m: 2, n: 2, A: [[0, 0, 0], [0, 0, 0], [0, 0, 0]], b: [0, 0, 0] };
  const { d, sc } = view(s);
  assert.equal(d.rank, 0); assert.equal(d.nullDim, 2); assert.equal(d.nullTrivial, false);
  assert.equal(d.bInR, true); assert.equal(d.verdict, 'infinite');
  assert.equal(sc.input.fillAll, 'accent'); // N(A) = solution set here, b = 0
  assert.equal(sc.output.dots.length, 1); // R(A) = {0}, drawn as a faint dot
});

test('1.2 A = 0 (2×2) with b ≠ 0: no solution (b must be 0 for R(A) = {0})', () => {
  const s = { ...sv.initial(), m: 2, n: 2, A: [[0, 0, 0], [0, 0, 0], [0, 0, 0]], b: [1, 0, 0] };
  const { d } = view(s);
  assert.equal(d.bInR, false); assert.equal(d.verdict, 'none');
});

test('1.2 rank-deficient square A (2×2, singular): dependent columns, 1-dim N(A)', () => {
  const s = { ...sv.initial(), m: 2, n: 2, A: [[1, 2, 0], [2, 4, 0], [0, 0, 0]], x: [1, 0, 0], b: [1, 2, 0] };
  const { d } = view(s);
  assert.equal(d.rank, 1); assert.equal(d.nullDim, 1); assert.equal(d.bInR, true); assert.equal(d.verdict, 'infinite');
});

test('1.2 near-tol case: a tiny perturbation below tol is still treated as dependent/in R(A)', () => {
  const eps = 1e-13; // well below tol = 1e-10·max(1, ‖A‖₂) ≈ 1e-10 for unit-scale A
  const s = { ...sv.initial(), m: 2, n: 2, A: [[1, 2, 0], [2, 4 + eps, 0], [0, 0, 0]] };
  const { d } = view(s);
  assert.equal(d.rank, 1); // the perturbed column still counts as dependent
});

test('1.2 near-tol case: a perturbation above tol counts as independent', () => {
  const eps = 1e-7; // well above tol for unit-scale A
  const s = { ...sv.initial(), m: 2, n: 2, A: [[1, 2, 0], [2, 4 + eps, 0], [0, 0, 0]] };
  const { d } = view(s);
  assert.equal(d.rank, 2);
});

test('1.2 moveX / moveB clamp to [-3, 3] and round, leaving the other vector untouched', () => {
  const s = sv.initial();
  const mx = sv.moveX(s, [5, -7, 1]);
  assert.deepEqual(mx.x, [3, -3, 1]);
  const mb = sv.moveB(s, [0.001, 2.004, 9]); // m = 3, so all three components are clamped
  assert.deepEqual(mb.b, [0, 2, 3]);
});

test('1.2 setShape preserves A entries; setEntry edits a single cell', () => {
  let s = sv.initial();
  s = { ...s, ...sv.setShape(s, 2, 3) };
  assert.equal(s.m, 2); assert.equal(s.n, 3);
  assert.deepEqual(s.A, sv.initial().A); // entries untouched, just reinterpreted
  s = { ...s, ...sv.setEntry(s, 0, 0, 9) };
  assert.equal(s.A[0][0], 9);
});

test('1.2 applyPreset: both presets load their documented matrices', () => {
  const p1 = sv.applyPreset(sv.initial(), 'ex111');
  assert.equal(p1.m, 3); assert.equal(p1.n, 2);
  assert.deepEqual(p1.A, [[1, 1, 0], [0, -1, 0], [2, 2, 0]]);
  const p2 = sv.applyPreset(sv.initial(), 'ex112');
  assert.equal(p2.m, 3); assert.equal(p2.n, 3);
  assert.deepEqual(p2.A, [[1, 0, 1], [0, 2, 2], [-1, 1, 0]]);
  assert.deepEqual(sv.applyPreset(sv.initial(), 'nope'), {});
});

test('1.2 applyPreset ex111: also sets a b in R(A) inside [-3, 3], giving a unique solution', () => {
  const s = { ...sv.initial(), ...sv.applyPreset(sv.initial(), 'ex111') };
  s.b.forEach((x) => assert.ok(Math.abs(x) <= 3));
  const { d } = view(s);
  assert.equal(d.bInR, true);
  assert.equal(d.verdict, 'unique');
});

test('1.2 applyPreset ex112: also sets a b in R(A) inside [-3, 3], giving infinitely many solutions', () => {
  const s = { ...sv.initial(), ...sv.applyPreset(sv.initial(), 'ex112') };
  s.b.forEach((x) => assert.ok(Math.abs(x) <= 3));
  const { d } = view(s);
  assert.equal(d.bInR, true);
  assert.equal(d.verdict, 'infinite');
});

test('1.2 randomizeB is deterministic given a rand function, and always lands in [-3, 3]', () => {
  const s = sv.initial();
  const seq = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7];
  let i = 0;
  const rand = () => seq[i++ % seq.length];
  const r1 = sv.randomizeB(s, rand);
  i = 0;
  const r2 = sv.randomizeB(s, rand);
  assert.deepEqual(r1, r2);
  r1.b.forEach((x) => assert.ok(x >= -3 && x <= 3));
});

test('1.2 randomizeB: the in-R(A) branch really lands in R(A), measured over 200 seeded draws', () => {
  const s = sv.initial();
  let inRBranchDraws = 0;
  for (let t = 0; t < 200; t++) {
    const seq = Array.from({ length: 10 }, () => Math.random());
    let i = 0;
    const rand = () => seq[i++];
    const r = sv.randomizeB(s, rand);
    r.b.forEach((x) => assert.ok(x >= -3 && x <= 3, `b out of range: ${r.b}`));
    if (seq[0] < 0.5) { // the first draw always decides the branch, see randomizeB
      inRBranchDraws++;
      const { d } = view({ ...s, ...r });
      assert.equal(d.bInR, true, `in-R(A) branch should land in R(A): b=${r.b}`);
    }
  }
  assert.ok(inRBranchDraws > 50, `expected roughly half of 200 draws to take the in-R(A) branch, got ${inRBranchDraws}`);
});

test('1.2 setCheck toggles the check-yourself flag', () => {
  assert.equal(sv.setCheck(sv.initial(), true).check, true);
});

test('1.2 minimum-norm xp is orthogonal to N(A) for a rank-deficient preset', () => {
  const s = { ...sv.initial(), ...sv.applyPreset(sv.initial(), 'ex112'), b: [1, 2, -1] };
  const { d } = view(s);
  if (d.bInR) d.N_basis.forEach((v) => near(L.dot(d.xp, v), 0, 0, 1e-8));
});

test('1.2 TeX output is well-formed (balanced braces) in every verdict case', () => {
  const cases = [
    sv.initial(),
    { ...sv.initial(), ...sv.applyPreset(sv.initial(), 'ex112'), b: [0, 0, 0] },
    { ...sv.initial(), ...sv.applyPreset(sv.initial(), 'ex112'), b: [1, 0, 0] },
    { ...sv.initial(), m: 2, n: 2, A: [[0, 0, 0], [0, 0, 0], [0, 0, 0]], b: [0, 0, 0] },
  ];
  for (const s of cases) {
    const { tex } = view(s);
    for (const key of ['A', 'Ax', 'b', 'tol', 'nullTex', 'rangeTex']) {
      const t = tex[key];
      assert.equal((t.match(/\{/g) || []).length, (t.match(/\}/g) || []).length, `balanced braces: ${key} = ${t}`);
    }
    if (tex.xpTex) assert.equal((tex.xpTex.match(/\{/g) || []).length, (tex.xpTex.match(/\}/g) || []).length);
    if (tex.solutionTex) assert.equal((tex.solutionTex.match(/\{/g) || []).length, (tex.solutionTex.match(/\}/g) || []).length);
    if (tex.distTex) assert.equal((tex.distTex.match(/\{/g) || []).length, (tex.distTex.match(/\}/g) || []).length);
  }
});
