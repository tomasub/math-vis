// 2.2 Shape vs solvability: model tests
'use strict';
const { test, assert } = require('../harness.js');
const M = require('../../js/viz/shape-solvability.js');

test('2.2 default: tall 3×2, rank 2, almost every b unsolvable', () => {
  const s = M.initial(), d = M.derive(s);
  assert.equal(d.shape, 'tall'); assert.equal(d.rank, 2);
  assert.equal(d.counts.none, 14); assert.equal(d.allSolvable, false);
  assert.equal(d.tallNote, true); assert.equal(d.correct, 'none');
  const sc = M.scene(s, d);
  assert.equal(sc.dim, 3); assert.equal(sc.planes.length, 1); assert.equal(sc.dots.length, 14);
});
test('2.2 samples lie in the ball', () => {
  M.initial().bs.forEach((b) => assert.ok(Math.hypot(...b) <= 3 + 1e-12));
});
test('2.2 R(A)-only samples are all solvable (unique for tall full-rank)', () => {
  let s = M.initial(); s = Object.assign({}, s, M.setMode(s, 'range', M.seeded(3)));
  const d = M.derive(s);
  assert.equal(d.counts.unique, 14); assert.equal(d.tallNote, false);
});
test('2.2 wide 2×3 full rank: all solvable, many solutions', () => {
  let s = M.initial();
  s = Object.assign({}, s, { A: [[1, 0, 1], [0, 1, 1], [0, 0, 0]] }, M.setShape(s, 2, 3, M.seeded(5)));
  const d = M.derive(s);
  assert.equal(d.shape, 'wide'); assert.equal(d.nullDim, 1); assert.equal(d.counts.many, 14);
  assert.equal(d.correct, 'all'); assert.equal(d.uniqueAll, false);
  const sc = M.scene(s, d);
  assert.equal(sc.dim, 2); assert.ok(sc.fillAll);
});
test('2.2 square invertible: unique for all; singular: both failures', () => {
  let s = M.initial();
  s = Object.assign({}, s, { A: [[1, 0, 0], [0, 2, 0], [0, 0, 1]] }, M.setShape(s, 3, 3, M.seeded(2)));
  let d = M.derive(s);
  assert.equal(d.uniqueAll, true); assert.equal(d.counts.unique, 14);
  s = Object.assign({}, s, M.setEntry(s, 2, 2, 0));
  d = M.derive(s);
  assert.equal(d.rank, 2); assert.equal(d.uniqueAll, false); assert.ok(/singular/.test(d.verdict));
});
test('2.2 zero matrix and m = n = 1', () => {
  let s = M.initial();
  s = Object.assign({}, s, { A: [[0, 0, 0], [0, 0, 0], [0, 0, 0]] }, M.setShape(s, 1, 1, M.seeded(4)));
  let d = M.derive(s);
  assert.equal(d.rank, 0); assert.equal(M.scene(s, d).dim, 2);
  s = Object.assign({}, s, M.setEntry(s, 0, 0, 2));
  d = M.derive(s); assert.equal(d.uniqueAll, true);
});
test('2.2 entries clamp and tex', () => {
  const s = M.initial();
  assert.equal(M.setEntry(s, 0, 0, 9).A[0][0], 3);
  const t = M.tex(s, M.derive(s));
  assert.ok(t.A.includes('3\\times 2')); assert.ok(t.rank.includes('= n')); assert.ok(t.tol.includes('tol'));
});
