// Shared test helpers. Each test file does:  const { test, near, assert } = require('../harness.js');
'use strict';
const assert = require('node:assert/strict');
const state = { passed: 0, failed: 0, file: '' };
function test(name, fn) {
  try { fn(); state.passed++; } catch (e) { state.failed++; console.error(`FAIL [${state.file}] ${name}\n  ${e.message}`); }
}
/** |a − b| ≤ max(abs, rel·max(|a|, |b|)) */
const near = (a, b, rel = 1e-10, abs = 1e-12) =>
  assert.ok(Math.abs(a - b) <= Math.max(abs, rel * Math.max(Math.abs(a), Math.abs(b))), `${a} ≉ ${b}`);
module.exports = { test, near, assert, state };
