// scripts/claude-result.js: did a claude -p run stop on a usage / rate limit?
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { test, assert } = require('../harness.js');
const { usageLimit, epochToIso } = require('../../scripts/claude-result.js');

const fixture = (f) => usageLimit(fs.readFileSync(path.join(__dirname, '..', 'fixtures', f), 'utf8'));
const log = (o) => JSON.stringify({ type: 'result', subtype: 'success', is_error: false, session_id: 's1', ...o });

test('api_error_status 429 is a limit', () => {
  const r = usageLimit(log({ is_error: true, api_error_status: 429, result: 'API Error: 429' }));
  assert.deepEqual([r.limited, r.signal, r.session_id], [true, 'api_error_status 429', 's1']);
});
test('session-limit text on a failed run is a limit, with the reset time from the text', () => {
  const r = usageLimit(log({ is_error: true, result: "You've hit your session limit · resets 3:45pm" }));
  assert.deepEqual([r.limited, r.resets_at], [true, '3:45pm']);
  assert.equal(usageLimit(log({ is_error: true, result: "You've hit your weekly limit · resets Mon 12:00am" })).resets_at, 'Mon 12:00am');
});
test('legacy "usage limit reached|<epoch>" gives an ISO reset time', () => {
  const r = usageLimit(log({ is_error: true, result: 'Claude AI usage limit reached|1762527600' }));
  assert.deepEqual([r.limited, r.resets_at], [true, '2025-11-07T15:00:00.000Z']);
});
test('rate_limit_info rejected (stream-json lines) is a limit; resetsAt in s or ms', () => {
  const lines = [
    JSON.stringify({ type: 'rate_limit_event', session_id: 's2', rate_limit_info: { status: 'rejected', resetsAt: 1762527600 } }),
    JSON.stringify({ type: 'result', subtype: 'success', is_error: true, result: 'stopped', session_id: 's2' }),
  ].join('\n');
  const r = usageLimit(lines);
  assert.deepEqual([r.limited, r.resets_at, r.session_id], [true, '2025-11-07T15:00:00.000Z', 's2']);
  assert.equal(epochToIso(1762527600000), '2025-11-07T15:00:00.000Z');
});
test('assistant error category rate_limit is a limit', () => {
  assert.equal(usageLimit(JSON.stringify([{ type: 'assistant', error: 'rate_limit' }, { type: 'result', is_error: true }])).limited, true);
});
test('rate_limit_info allowed_warning is not a limit', () => {
  assert.equal(usageLimit(log({ rate_limit_info: { status: 'allowed_warning', resetsAt: 1 }, result: 'done' })).limited, false);
});
test('a successful reply that talks about rate limits is not a limit', () => {
  assert.equal(usageLimit(log({ result: 'PASS. The retry handles a rate limit (429) correctly.' })).limited, false);
});
test('other failures are not limits: auth error, max turns, overloaded', () => {
  assert.equal(fixture('review-none-autherror.json').limited, false);
  assert.equal(usageLimit(log({ subtype: 'error_max_turns', is_error: true, result: '' })).limited, false);
  assert.equal(usageLimit(log({ is_error: true, api_error_status: 529, result: 'Overloaded' })).limited, false);
});
test('unreadable or empty logs are not limits', () => {
  assert.equal(usageLimit('').limited, false);
  assert.equal(usageLimit('not json').limited, false);
});
test('the simulated limit fixture is a limit', () => {
  const r = fixture('limit-session.json');
  assert.deepEqual([r.limited, r.resets_at], [true, '3:45pm']);
});
