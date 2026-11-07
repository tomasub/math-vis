// 1.3 One subspace, two bases: model tests
'use strict';
const { test, near, assert } = require('../harness.js');
const tb = require('../../js/viz/two-bases.js');
const noop = () => {};
const view = (s) => { const d = tb.derive(s); return { d, sc: tb.scene(s, d, noop), tex: tb.tex(s, d) }; };

test('1.3 default: y in the plane, inside the axes, x = Mz from the notes', () => {
  const s = tb.initial(); const { d, sc, tex } = view(s);
  assert.deepEqual(d.y, [1, -0.5, 2]);
  assert.ok(d.y.every((v) => Math.abs(v) <= 3));
  assert.equal(d.valid, true); assert.equal(d.isDefault, true);
  near(d.x[0], s.z[0] + s.z[1], 0, 1e-12); near(d.x[1], -s.z[1], 0, 1e-12);
  assert.equal(sc.planes.length, 2); assert.equal(sc.points.length, 1);
  assert.equal(tex.convEq, 'x_1 = z_1 + z_2,\\quad x_2 = -z_2');
});
test('1.3 moveY projects a point off the plane back onto R(A)', () => {
  const s = tb.initial(); const { z } = tb.moveY(s, [1, 1, 3]);
  const y = tb.derive({ ...s, z }).y;
  near(y[2], 2 * y[0], 0, 0.05);
});
test('1.3 setZ clamps y into [−3, 3]³', () => {
  const { z } = tb.setZ(tb.initial(), [2, 2]);
  assert.ok(tb.derive({ ...tb.initial(), z }).y.every((v) => Math.abs(v) <= 3 + 1e-9));
});
test('1.3 grid toggles', () => {
  const s = { ...tb.initial(), showA: false, showW: false };
  const { sc } = view(s);
  assert.ok(!sc.planes[0].grid && !sc.planes[1].grid);
  const on = view(tb.initial()).sc;
  assert.ok(on.planes[0].grid && on.planes[1].grid);
});
test('1.3 dependent w: warning, x undefined, no W plane', () => {
  const s = { ...tb.initial(), W: [[1, 2], [0, 0], [2, 4]] };
  const { d, sc, tex } = view(s);
  assert.equal(d.valid, false); assert.equal(d.x, null);
  assert.ok(d.warnings[0].includes('dependent')); assert.ok(d.undef.startsWith('undefined'));
  assert.equal(sc.planes.length, 1); assert.equal(tex.x, '');
});
test('1.3 w leaving the plane: warning', () => {
  const s = { ...tb.initial(), W: [[1, 0], [0, 1], [0, 0]] };
  const { d } = view(s);
  assert.equal(d.valid, false); assert.deepEqual(d.inPlane, [false, true]);
  assert.ok(d.warnings.some((w) => w.includes('w₁ is not in R(A)')));
});
test('1.3 another valid basis: W = A gives x = z', () => {
  const s = { ...tb.initial(), W: [[1, 1], [0, -1], [2, 2]] };
  const { d } = view(s);
  assert.equal(d.valid, true); assert.equal(d.same, true); assert.equal(d.isDefault, false);
});
test('1.3 setW clamps entries', () => {
  assert.equal(tb.setW(tb.initial(), 0, 0, 9).W[0][0], 3);
});
