#!/usr/bin/env node
// Did a `claude -p --output-format json` run stop because of a usage or rate limit?
//
//   node scripts/claude-result.js logs/1.3-build-1.json
//   → {"limited":true|false,"resets_at":"…"|null,"signal":"…","session_id":"…"|null}
//
// Structured signals first (the Claude Code / Agent SDK docs name these):
//   - api_error_status 429                      (HTTP status of the API error that ended the run)
//   - an `error` / `error_type` of "rate_limit"  (SDKAssistantMessageError, api_retry categories)
//   - rate_limit_info.status "rejected"          (SDKRateLimitEvent; resetsAt gives the reset time)
// Text is only a fallback, and only when the run itself failed (is_error true or a non-success
// subtype): "You've hit your session/weekly/Opus limit · resets 3:45pm", "usage limit reached",
// "Request rejected (429)", "rate limit". A reviewer that merely *writes* "rate limit" in a
// successful reply is never a usage limit.
// An unreadable or empty log is not a usage limit either (the caller handles it as before).
'use strict';
const fs = require('node:fs');

const LIMIT_TEXT = /(hit your (?:session|weekly|daily|usage|opus|sonnet|[a-z]+ )?limit|usage limit|rate[ _-]?limit|request rejected \(429\)|\b429\b|limiting requests|out of (?:extra )?usage)/i;

/** Seconds or milliseconds since the epoch → ISO string (anything else → null). */
function epochToIso(n) {
  if (typeof n === 'string' && /^\d+$/.test(n)) n = Number(n);
  if (typeof n !== 'number' || !isFinite(n) || n <= 0) return null;
  const ms = n < 1e12 ? n * 1000 : n; // the docs don't state the unit of resetsAt
  return new Date(ms).toISOString();
}

/** Walk every object in the log (a result object, or an array of stream messages). */
function* walk(v, depth = 0) {
  if (!v || typeof v !== 'object' || depth > 8) return;
  yield v;
  for (const k of Object.keys(v)) yield* walk(v[k], depth + 1);
}

/**
 * @param {string} text  contents of a claude -p JSON (or stream-json / JSON-array) log
 * @returns {{limited:boolean, resets_at:string|null, signal:string, session_id:string|null}}
 */
function usageLimit(text) {
  const out = (limited, signal, resets_at = null, session_id = null) => ({ limited, resets_at, signal, session_id });
  let log;
  try { log = JSON.parse(text); } catch (e) {
    // stream-json: one JSON object per line
    const lines = String(text).split('\n').filter((l) => l.trim().startsWith('{'));
    try { log = lines.map((l) => JSON.parse(l)); } catch (e2) { return out(false, 'unreadable log'); }
    if (!lines.length) return out(false, 'unreadable log');
  }
  if (!log || typeof log !== 'object') return out(false, 'not a JSON object');

  const all = [...walk(log)];
  const result = all.find((o) => o.type === 'result') || (Array.isArray(log) ? {} : log);
  const session = all.map((o) => o.session_id).find((s) => typeof s === 'string' && s) || null;
  const failed = result.is_error === true || (typeof result.subtype === 'string' && result.subtype !== 'success');
  const resultText = typeof result.result === 'string' ? result.result : '';
  const errorsText = Array.isArray(result.errors) ? result.errors.join('\n') : '';

  // reset time, from whatever the output gives
  let resets = null;
  for (const o of all) {
    const info = o.rate_limit_info;
    if (info && (resets = epochToIso(info.resetsAt ?? info.resets_at))) break;
    if (o.resetsAt != null && (resets = epochToIso(o.resetsAt))) break;
  }
  if (!resets) {
    const legacy = (resultText + '\n' + errorsText).match(/usage limit reached\|(\d{9,13})/i);
    if (legacy) resets = epochToIso(legacy[1]);
  }
  if (!resets) {
    const m = (resultText + '\n' + errorsText).match(/resets?\s+(?:at\s+)?([^\n.·|]{1,60}?)\s*(?:[.·|\n]|$)/i);
    if (m) resets = m[1].trim();
  }

  if (result.api_error_status === 429) return out(true, 'api_error_status 429', resets, session);
  for (const o of all) {
    const info = o.rate_limit_info;
    if (info && info.status === 'rejected') return out(true, 'rate_limit_info.status rejected', resets, session);
    for (const k of ['error', 'error_type', 'category']) {
      if (o[k] === 'rate_limit') return out(true, `${k} rate_limit`, resets, session);
    }
    if (o.type === 'system' && o.subtype === 'api_retry' && o.error === 'rate_limit') return out(true, 'api_retry rate_limit', resets, session);
  }
  if (failed && LIMIT_TEXT.test(resultText + '\n' + errorsText)) return out(true, 'result text (run failed)', resets, session);
  return out(false, failed ? 'run failed, not a usage limit' : 'no usage limit', null, session);
}

module.exports = { usageLimit, epochToIso };

if (require.main === module) {
  const file = process.argv[2];
  if (!file) { console.error('usage: node scripts/claude-result.js <claude-log.json>'); process.exit(2); }
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) { /* missing log → not a limit */ }
  const r = text ? usageLimit(text) : { limited: false, resets_at: null, signal: `cannot read ${file}`, session_id: null };
  process.stdout.write(JSON.stringify(r) + '\n');
}
