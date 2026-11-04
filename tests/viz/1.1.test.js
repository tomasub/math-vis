// 1.1 Span and linear independence explorer: model tests (state → derived → scene → TeX)
'use strict';
const { test, near, assert } = require('../harness.js');
const span = require('../../js/viz/span-explorer.js');

const noop = () => {};
const view = (s) => { const d = span.derive(s); return { d, sc: span.scene(s, d, noop), tex: span.tex(s, d) }; };
test('1.1 default: independent, span = ℝ², whole plane tinted', () => {
  const { d, sc } = view(span.initial());
  assert.equal(d.indep, true); assert.equal(d.spanDesc, 'all of ℝ²');
  assert.equal(sc.fillAll, 'accent'); assert.equal(sc.points.length, 2);
  assert.equal(sc.arrows.length, 3, 'q₁, q₂ and Qα');
});
test('1.1 k = 3 in ℝ²: dependent with the right relation', () => {
  const s = { ...span.initial(), k: 3 };
  const { d } = view(s);
  assert.equal(d.indep, false); assert.equal(d.relText, 'q₃ = −0.125q₁ − 1.25q₂');
});
test('1.1 parallel vectors: span is a line along q₁', () => {
  let s = span.initial();
  s = { ...s, ...span.moveVec(s, 1, [1, 0.5]) };
  const { d, sc } = view(s);
  assert.equal(d.rank, 1); assert.equal(sc.lines.length, 1); assert.equal(d.relText, 'q₂ = 0.5q₁');
  const e = sc.lines[0].dir; near(Math.abs(e[0] * 1 - e[1] * 2), 0, 0, 1e-12); // parallel to (2, 1)
});
test('1.1 ℝ³ with a dependent third vector: a plane', () => {
  const s = { ...span.initial(), dim: 3, k: 3 };
  const t = { ...s, ...span.makeDependent(s, () => 0.99) };
  const { d, sc } = view(t);
  assert.equal(d.rank, 2); assert.equal(sc.planes.length, 1); assert.equal(d.spanDesc, 'a plane through 0');
});
test('1.1 makeDependent always produces dependence inside the axes', () => {
  for (const dim of [2, 3]) for (const k of [1, 2, 3, 4]) for (let t = 0; t < 40; t++) {
    const s = { ...span.initial(), dim, k };
    const u = { ...s, ...span.makeDependent(s) };
    assert.ok(span.derive(u).rank < k, `dim ${dim} k ${k}`);
    assert.ok(u.vecs[k - 1].slice(0, dim).every((x) => Math.abs(x) <= 3));
  }
});
test('1.1 snapping and clamping', () => {
  const s = span.initial();
  assert.deepEqual(span.snapVec(s, [1.26, -3.9, 7]), [1.5, -3, 7]);
  assert.deepEqual(span.snapVec({ ...s, snap: false }, [1.264, 0.001]), [1.26, 0, 0]);
});
test('1.1 zero α hides Qα; all-zero vectors give a point span', () => {
  const s = { ...span.initial(), alpha: [0, 0, 0, 0] };
  assert.equal(view(s).sc.arrows.length, 2);
  const z = { ...span.initial(), vecs: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]] };
  const { d, sc } = view(z);
  assert.equal(d.rank, 0); assert.equal(sc.dots.length, 1);
});
test('1.1 TeX output is well-formed', () => {
  const { tex } = view({ ...span.initial(), dim: 3, k: 4 });
  for (const t of [tex.Q, tex.Qa, tex.tol]) {
    assert.equal((t.match(/\{/g) || []).length, (t.match(/\}/g) || []).length, 'balanced braces: ' + t);
  }
  assert.ok(tex.Q.includes('\\htmlClass{q4}'));
});

