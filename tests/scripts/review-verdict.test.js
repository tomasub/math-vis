// scripts/review-verdict.js: how build-all.sh reads the reviewer's verdict.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { test, assert } = require('../harness.js');
const { parseReview } = require('../../scripts/review-verdict.js');

const fixture = (f) => parseReview(fs.readFileSync(path.join(__dirname, '..', 'fixtures', f), 'utf8'));
const log = (o) => JSON.stringify({ type: 'result', subtype: 'success', is_error: false, ...o });

test('real toolkit-1.3-2.1 review (text "**PASS.**", no structured_output) is PASS', () => {
  const r = fixture('review-pass-text.json');
  assert.equal(r.verdict, 'pass');
  assert.equal(r.source, 'result:legacy-first-line');
  assert.match(r.summary, /^The toolkit additions for 1\.3 and 2\.1/);
  assert.deepEqual(r.fixes, []);
});
test('FAIL fixture: verdict line + numbered fixes, continuation line joined', () => {
  const r = fixture('review-fail-text.json');
  assert.equal(r.verdict, 'fail');
  assert.equal(r.source, 'result:verdict-line');
  assert.equal(r.fixes.length, 2);
  assert.match(r.fixes[0], /^js\/viz\/dimension-split\.js: default z/);
  assert.match(r.fixes[1], /Fixed by system panel\. It is currently computed but not shown\.$/);
});
test('no-verdict fixtures give none with a reason', () => {
  for (const f of ['review-none-text.json', 'review-none-autherror.json']) {
    const r = fixture(f);
    assert.equal(r.verdict, 'none', f);
    assert.match(r.reason, /no VERDICT line/);
  }
});
test('structured_output wins over the text', () => {
  const r = parseReview(log({ structured_output: { verdict: 'fail', summary: 's', fixes: ['a', ' ', 'b'] }, result: 'VERDICT: PASS' }));
  assert.deepEqual([r.verdict, r.source, r.fixes], ['fail', 'structured_output', ['a', 'b']]);
});
test('structured_output without a usable verdict falls back to the text', () => {
  assert.equal(parseReview(log({ structured_output: { summary: 'x' }, result: 'ok\nVERDICT: PASS' })).verdict, 'pass');
});
test('verdict line: case-insensitive, markdown bold/backticks allowed, trailing blanks ok', () => {
  for (const line of ['VERDICT: PASS', 'verdict: pass', '**VERDICT: PASS**', '**VERDICT:** PASS', '`VERDICT: PASS`', '__Verdict: Pass.__'])
    assert.equal(parseReview(log({ result: `Fine.\n${line}\n\n` })).verdict, 'pass', line);
});
test('the last verdict line counts', () => {
  assert.equal(parseReview(log({ result: 'VERDICT: PASS was my first thought\nVERDICT: PASS\nno, wait\nVERDICT: FAIL\n1. x: y' })).verdict, 'fail');
});
test('text after VERDICT: PASS is rejected (none, not a guess)', () => {
  const r = parseReview(log({ result: 'ok\nVERDICT: PASS\nbut also fix the label' }));
  assert.equal(r.verdict, 'none');
  assert.match(r.reason, /last line/);
});
test('stray prose after VERDICT: FAIL is rejected', () => {
  assert.equal(parseReview(log({ result: 'bad\nVERDICT: FAIL\nsee above' })).verdict, 'none');
});
test('FAIL with no numbered fixes → fail with empty fixes (script must not start a fix round)', () => {
  const r = parseReview(log({ result: 'broken\nVERDICT: FAIL' }));
  assert.deepEqual([r.verdict, r.fixes], ['fail', []]);
});
test('fix numbering styles: "1." "2)" "**3.**"', () => {
  const r = parseReview(log({ result: 'x\nVERDICT: FAIL\n1. a\n2) b\n**3.** c' }));
  assert.deepEqual(r.fixes, ['a', 'b', 'c']);
});
test('legacy first line needs upper-case PASS/FAIL as a word', () => {
  assert.equal(parseReview(log({ result: 'Passing thoughts: it looks fine.' })).verdict, 'none');
  assert.equal(parseReview(log({ result: 'PASSABLE work.' })).verdict, 'none');
  const r = parseReview(log({ result: '**FAIL** — two bugs.\n1. a.js: fix x\n2. b.js: fix y' }));
  assert.deepEqual([r.verdict, r.fixes.length], ['fail', 2]);
});
test('broken / empty logs give none', () => {
  assert.equal(parseReview('not json').verdict, 'none');
  assert.equal(parseReview('null').verdict, 'none');
  assert.match(parseReview(log({ result: '' })).reason, /empty \.result/);
  assert.equal(parseReview(log({ subtype: 'error_max_turns' })).verdict, 'none');
});
