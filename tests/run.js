// Run with:  node tests/run.js        (Node 18+, no dependencies)
// 1. math helpers against NumPy reference results (tests/fixtures.json, see make_fixtures.py)
// 2. hand-written edge cases
// 3. manifest consistency
// 4. every tests/viz/*.test.js (one file per visualisation's model)
'use strict';
const path = require('node:path');
const fs = require('node:fs');
const L = require('../js/math/linalg.js');
const manifest = require('../content/courses.js');
const fx = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures.json'), 'utf8'));

const { test, near, assert, state } = require('./harness.js');
state.file = 'run.js';

/* ---------- 1. against NumPy ---------- */
fx.symEig.forEach((c, i) => test(`symEig #${i} vs numpy.eigvalsh`, () => {
  const ev = L.jacobiEig(c.A).sort((a, b) => a - b);
  const scale = Math.max(...c.eig.map(Math.abs));
  ev.forEach((v, j) => near(v, c.eig[j], 0, 1e-12 * scale + 1e-300));
}));
fx.norm2.forEach((c, i) => test(`norm2 #${i} vs numpy.linalg.norm(·, 2)`, () => near(L.norm2(c.cols), c.norm2, 1e-12)));
fx.rank.forEach((c, i) => test(`rank #${i} (${c.label}) vs numpy.matrix_rank`, () => {
  const a = L.analyse(c.cols);
  near(a.tol, c.tol, 1e-12);
  assert.equal(a.rank, c.rank);
  if (!c.relation) { assert.equal(a.rel, null); return; }
  assert.ok(a.rel, 'relation expected');
  assert.equal(a.rel.j, c.relation.j);
  assert.deepEqual(a.rel.idx, c.relation.idx);
  a.rel.x.forEach((x, t) => near(x, c.relation.x[t], 1e-8, 1e-9));
}));
fx.gaussianSolve.forEach((c, i) => test(`gaussianSolve #${i} vs numpy.linalg.solve`, () => {
  const x = L.gaussianSolve(c.M, c.b);
  assert.ok(x, 'solution expected');
  x.forEach((v, j) => near(v, c.x[j], 1e-8, 1e-8));
}));
fx.projectOntoBasis.forEach((c, i) => test(`projectOntoBasis #${i} vs numpy (QR basis)`, () => {
  const p = L.projectOntoBasis(c.E, c.v);
  p.coeffs.forEach((v, j) => near(v, c.coeffs[j], 1e-9, 1e-9));
  p.proj.forEach((v, j) => near(v, c.proj[j], 1e-9, 1e-9));
  near(p.residual, c.residual, 1e-9, 1e-9);
}));
fx.solvability.forEach((c, i) => test(`solvability #${i} (${c.label}): rank, nullity and minimum-norm x vs numpy SVD`, () => {
  const cols = []; const n = c.rows[0].length;
  for (let j = 0; j < n; j++) cols.push(c.rows.map((r) => r[j]));
  const colAn = L.analyse(cols);
  near(colAn.tol, c.tol, 1e-9);
  assert.equal(colAn.rank, c.rank);
  const rowAn = L.analyse(c.rows);
  assert.equal(rowAn.rank, c.rank, 'rank(A) = rank(Aᵗ)');
  const nullBasis = L.completeOrthonormalBasis(rowAn.E, n, colAn.tol);
  assert.equal(nullBasis.length, c.nullity);
  nullBasis.forEach((v) => near(L.norm(L.applyRows(c.rows, v)), 0, 0, 1e-8));
  const xMin = L.minNormSolve(c.rows, c.b);
  xMin.forEach((v, j) => near(v, c.minNormX[j], 1e-6, 1e-7));
}));

fx.coordsInBasis.forEach((c, i) => test(`coordsInBasis #${i} vs numpy lstsq`, () => {
  const r = L.coordsInBasis(c.cols, c.y);
  assert.ok(r.independent && r.inSpan);
  r.z.forEach((v, j) => near(v, c.z[j], 1e-8, 1e-8));
}));
fx.splitInput.forEach((c, i) => test(`splitInputSpace #${i}: rank + nullity = n, vs numpy rank`, () => {
  const s = L.splitInputSpace(c.rows);
  assert.equal(s.rank, c.rank); assert.equal(s.nullity, c.nullity);
  assert.equal(s.C.length + s.N.length, c.rows[0].length);
  s.N.forEach((v) => near(L.norm(L.applyRows(c.rows, v)), 0, 0, 1e-8));
}));
test('coordsInBasis: dependent basis / off-plane point', () => {
  assert.equal(L.coordsInBasis([[1, 0], [2, 0]], [1, 0]).independent, false);
  const r = L.coordsInBasis([[1, 0, 0], [0, 1, 0]], [0, 0, 1]);
  assert.equal(r.inSpan, false); near(r.residual, 1, 1e-12);
});
test('randomRankMatrix has the requested rank', () => {
  for (const r of [0, 1, 2]) { const A = L.randomRankMatrix(3, 2, r); assert.equal(L.splitInputSpace(A).rank, r); }
});

/* ---------- 2. edge cases and formatting ---------- */
test('k > n forces dependence', () => assert.equal(L.relationText(L.analyse([[1, 0], [0, 1], [2, -1]]).rel), 'q₃ = 2q₁ − q₂'));
test('zero vector', () => assert.equal(L.relationText(L.analyse([[0, 0]]).rel), 'q₁ = 0'));
test('relation TeX', () => assert.equal(L.relationTex(L.analyse([[1, 0], [0, 1], [2, -1]]).rel), '\\mathbf{q}_{3} = 2\\mathbf{q}_{1} - \\mathbf{q}_{2}'));
test('tol threshold: 1e-9 independent, 1e-11 dependent', () => {
  assert.equal(L.analyse([[1, 0], [1, 1e-9]]).rank, 2);
  assert.equal(L.analyse([[1, 0], [1, 1e-11]]).rank, 1);
});
test('fmt', () => { assert.equal(L.fmt(-1.5), '−1.5'); assert.equal(L.fmt(-0.0001), '0'); assert.equal(L.fmt(NaN), '—'); });
test('fmtE / fmtETex', () => { assert.equal(L.fmtE(9.999e-11), '1·10⁻¹⁰'); assert.equal(L.fmtETex(2.27e-10), '2.27 \\cdot 10^{-10}'); });

/* ---------- 3. 1.2's new math: edge cases numpy fixtures don't naturally cover ---------- */
test('applyRows: identity and zero matrix', () => {
  assert.deepEqual(L.applyRows([[1, 0], [0, 1]], [3, -2]), [3, -2]);
  assert.deepEqual(L.applyRows([[0, 0], [0, 0], [0, 0]], [1, 1]), [0, 0, 0]);
});
test('projectOntoBasis: empty basis (rank-0 R(A)) projects everything to 0', () => {
  const p = L.projectOntoBasis([], [3, -4]);
  assert.deepEqual(p.coeffs, []); assert.deepEqual(p.proj, [0, 0]); near(p.residual, 5, 0, 1e-12);
});
test('projectOntoBasis: v already in the basis has 0 residual', () => {
  const p = L.projectOntoBasis([[1, 0], [0, 1]], [2, -3]);
  near(p.residual, 0, 0, 1e-12);
});
test('completeOrthonormalBasis: empty input completes to the full standard-ish orthonormal basis', () => {
  const added = L.completeOrthonormalBasis([], 3, 1e-10);
  assert.equal(added.length, 3);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) near(L.dot(added[i], added[j]), i === j ? 1 : 0, 0, 1e-9);
});
test('completeOrthonormalBasis: already-full basis adds nothing', () => {
  const added = L.completeOrthonormalBasis([[1, 0], [0, 1]], 2, 1e-10);
  assert.equal(added.length, 0);
});
test('gaussianSolve: singular matrix returns null (used as a safety net, not expected in the 1.2 pipeline)', () => {
  assert.equal(L.gaussianSolve([[1, 2], [2, 4]], [1, 2]), null);
});
test('gaussianSolve: 1×1 and partial-pivoting 2×2', () => {
  assert.deepEqual(L.gaussianSolve([[2]], [6]), [3]);
  const x = L.gaussianSolve([[0, 1], [1, 1]], [2, 3]);
  near(x[0], 1, 0, 1e-12); near(x[1], 2, 0, 1e-12);
});
test('minNormSolve: zero matrix gives x = 0 (N(A) = ℝⁿ, the minimum-norm point of any solution set here is 0)', () => {
  assert.deepEqual(L.minNormSolve([[0, 0], [0, 0]], [0, 0]), [0, 0]);
});
test('minNormSolve: rank-deficient A, x_p is orthogonal to N(A) (true minimum-norm solution)', () => {
  const rows = [[1, 0, 1], [0, 2, 2], [-1, 1, 0]]; // Example 1.1.2, N(A) = span[-1,-1,1]
  const b = L.applyRows(rows, [1, 1, 1]);
  const xp = L.minNormSolve(rows, b);
  near(L.norm(L.applyRows(rows, xp).map((v, i) => v - b[i])), 0, 0, 1e-9); // A xp = b
  near(L.dot(xp, [-1, -1, 1]), 0, 0, 1e-9); // xp ⟂ N(A)
});
test('niceBasis: Example 1.1.2 unit vector rescales to the notes\' [-1,-1,1] line (up to sign)', () => {
  const u = 1 / Math.sqrt(3);
  const r = L.niceBasis([u, u, -u]);
  assert.equal(r.exact, true);
  assert.deepEqual(r.v, [1, 1, -1]); // sign normalised: first non-zero entry positive
});
test('niceBasis: sign normalisation also fires on the opposite unit vector', () => {
  const u = 1 / Math.sqrt(3);
  const r = L.niceBasis([-u, -u, u]);
  assert.equal(r.exact, true);
  assert.deepEqual(r.v, [1, 1, -1]);
});
test('niceBasis: already-integer vector is left as-is (up to the gcd reduction)', () => {
  const r = L.niceBasis([2, 4, -2]);
  assert.equal(r.exact, true);
  assert.deepEqual(r.v, [1, 2, -1]);
});
test('niceBasis: a 3-4-5-style unit vector rescales to a small integer vector', () => {
  const r = L.niceBasis([0.6, 0.8, 0]);
  assert.equal(r.exact, true);
  assert.deepEqual(r.v, [3, 4, 0]);
});
test('niceBasis: a fractional unit vector (quarters) rescales exactly', () => {
  const v = [0.25, 0.75, -0.5];
  const n = L.norm(v);
  const r = L.niceBasis(v.map((x) => x / n));
  assert.equal(r.exact, true);
  assert.deepEqual(r.v, [1, 3, -2]);
});
test('niceBasis: an irrational-looking direction falls back to the input unchanged', () => {
  const v = [1, Math.SQRT2 - 1, Math.PI / 10];
  const n = L.norm(v);
  const u = v.map((x) => x / n);
  const r = L.niceBasis(u);
  assert.equal(r.exact, false);
  assert.deepEqual(r.v, u);
});
test('niceBasis: the zero vector is returned unchanged and flagged exact', () => {
  const r = L.niceBasis([0, 0, 0]);
  assert.equal(r.exact, true);
  assert.deepEqual(r.v, [0, 0, 0]);
});
test('niceBasis: the rescaled vector always spans the same line as the input (within tol)', () => {
  const cases = [[1 / Math.sqrt(3), 1 / Math.sqrt(3), -1 / Math.sqrt(3)], [0.6, 0.8, 0], [1, 0, 0], [0, 1, 0]];
  for (const v of cases) {
    const r = L.niceBasis(v);
    const nOut = L.norm(r.v), nV = L.norm(v);
    near(Math.abs(L.dot(r.v, v) / (nOut * nV)), 1, 0, 1e-6);
  }
});

/* ---------- 4. manifest ---------- */
test('manifest is consistent', () => {
  const ids = new Set();
  for (const c of manifest.courses) {
    assert.ok(manifest.groups.includes(c.group), `group of ${c.id}`);
    for (const lec of c.lectures) for (const v of lec.visualisations) {
      assert.ok(!ids.has(v.id), 'duplicate ' + v.id); ids.add(v.id);
      assert.ok(['ready', 'placeholder'].includes(v.status));
      if (v.status === 'ready') {
        assert.ok(v.module, v.id + ' needs a module');
        assert.ok(fs.existsSync(path.join(__dirname, '..', v.module)), v.module + ' exists');
      }
    }
  }
});

/* ---------- 4. per-visualisation tests ---------- */
for (const f of fs.readdirSync(path.join(__dirname, 'viz')).filter((x) => x.endsWith('.test.js')).sort()) {
  state.file = 'viz/' + f;
  require(path.join(__dirname, 'viz', f));
}

console.log(`${state.passed} passed, ${state.failed} failed`);
if (state.failed) process.exitCode = 1;
