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
