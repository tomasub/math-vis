// 2.1 Dimension theorem as a split of the input space: model tests
'use strict';
const { test, near, assert } = require('../harness.js');
const M = require('../../js/viz/dimension-split.js');

const view = (s) => { const d = M.derive(s); return { d, i: M.scene(s, d, 'in'), o: M.scene(s, d, 'out'), tex: M.tex(s, d) }; };
const plain = (tex) => tex.replace(/\\htmlClass\{q\d\}\{(\d)\}/g, '$1');

test('2.1 default (Example 1.1.2): 3×3 rank 2, N(A) = span(−1,−1,1)', () => {
  const { d, i, o } = view(M.initial());
  assert.equal(d.rank, 2); assert.equal(d.nullity, 1); assert.equal(d.theorem, true);
  const v = d.N[0]; near(v[0], v[1], 1e-9); near(v[0], -v[2], 1e-9);
  assert.equal(i.lines.length, 1); assert.equal(o.planes.length, 1);
  assert.equal(i.arrows.length, 3, 'v and two w'); assert.equal(o.arrows.length, 0, 'nothing mapped at t = 0');
});
test('2.1 animation: N(A) shrinks to 0, complement images grow and are independent', () => {
  const { d, i, o } = view({ ...M.initial(), t: 1 });
  assert.equal(i.arrows.length, 2); assert.equal(o.arrows.length, 2);
  assert.ok(d.nullMax < 1e-12); assert.equal(d.injective, true);
  const h = view({ ...M.initial(), t: 0.5 });
  near(Math.hypot(...h.i.arrows[0].to), 0.5, 1e-9);
  near(Math.hypot(...h.o.arrows[0].to), 0.5 * Math.hypot(...d.compImg[0]), 1e-9);
  assert.equal(h.o.extent, 3.5, 'default output fits in the standard box');
});
test('2.1 rank slider gives exact rank and rank + nullity = n for every shape', () => {
  for (let m = 1; m <= 3; m++) for (let n = 1; n <= 3; n++) for (let r = 0; r <= Math.min(m, n); r++) {
    let s = { ...M.initial(), ...M.setShape(M.initial(), m, n) };
    s = { ...s, ...M.setRank(s, r) };
    const d = M.derive(s);
    assert.equal(d.rank, r, `${m}x${n} r=${r}`); assert.equal(d.rank + d.nullity, n); assert.equal(d.theorem, true);
    assert.ok(d.nullMax < 1e-10);
  }
});
test('2.1 rank is clamped', () => {
  const s = { ...M.initial(), ...M.setShape(M.initial(), 2, 3) };
  assert.equal(M.derive({ ...s, ...M.setRank(s, 9) }).rank, 2);
});
test('2.1 zero matrix: all of ℝⁿ is the nullspace', () => {
  const s = { ...M.initial(), ...M.setRank(M.initial(), 0) }, { d, i, o, tex } = view(s);
  assert.equal(d.rank, 0); assert.equal(d.nullity, 3); assert.equal(i.box, 'q1');
  assert.ok(o.dots.length >= 1); assert.ok(plain(tex.dims).includes('= 0 + 3 = 3'));
  assert.ok(!JSON.stringify([i, o]).includes('NaN'));
});
test('2.1 invertible: N(A) = {0}, R(A) = ℝᵐ', () => {
  const s = { ...M.initial(), ...M.setEntry(M.initial(), 2, 2, 5) }, { d, o, tex } = view(s);
  assert.equal(d.rank, 3); assert.equal(d.nullity, 0); assert.equal(o.box, 'accent');
  assert.ok(plain(tex.dims).includes('= 3 + 0 = 3'));
});
test('2.1 wide/tall shapes; 1D spaces draw in a 2D stage', () => {
  let v = view({ ...M.initial(), ...M.setShape(M.initial(), 2, 1) });
  assert.equal(v.d.rank, 1); assert.equal(v.d.nullity, 0); assert.equal(v.i.dim, 2); assert.equal(v.o.dim, 2);
  v = view({ ...M.initial(), ...M.setShape(M.initial(), 1, 3) });
  assert.equal(v.d.rank, 1); assert.equal(v.d.nullity, 2); assert.equal(v.i.planes.length, 1);
});
test('2.1 output extent widens for large images; tex shows tol', () => {
  const { d, tex } = view({ ...M.initial(), ...M.setEntry(M.initial(), 0, 0, 20) });
  assert.ok(d.outExtent > 3.5);
  assert.ok(tex.tol.includes('10^{-10}')); assert.ok(tex.A.includes('3\\times 3'));
});
test('2.1 captions use superscripts: ℝ³ for n = 3', () => {
  const { i, o } = view(M.initial());
  assert.ok(i.aria.includes('ℝ³')); assert.ok(o.aria.includes('ℝ³'));
  const w = view({ ...M.initial(), ...M.setShape(M.initial(), 2, 3) });
  assert.ok(w.o.aria.includes('ℝ²'));
});
