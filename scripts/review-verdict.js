#!/usr/bin/env node
// Extract the reviewer's verdict from a `claude -p --output-format json` log.
//
//   node scripts/review-verdict.js logs/1.3-review-1.json
//   → {"verdict":"pass"|"fail"|"none","source":"…","summary":"…","fixes":["…"],"reason":"…"}
//
// Order of trust:
//   1. .structured_output (from --json-schema), when it holds a pass/fail verdict.
//   2. .result text whose final block is a line `VERDICT: PASS` / `VERDICT: FAIL`
//      (case-insensitive, markdown bold/italics/backticks allowed), followed for FAIL only by
//      numbered fixes. This is the format .claude/agents/viz-reviewer.md requires.
//   3. Legacy text: the reply's first line starts with an upper-case PASS or FAIL (the format
//      the reviewer used before the VERDICT line was required, e.g. "**PASS.** …").
// Anything else → verdict "none" with a reason. Never guesses.
'use strict';
const fs = require('node:fs');

const clean = (s) => s.replace(/[*_`]/g, '').trim();
const VERDICT_LINE = /^verdict\s*:\s*(pass|fail)\s*\.?$/i;
const NUMBERED = /^\s*(?:[-*]\s*)?\*{0,2}\(?(\d+)[.)]\*{0,2}\s+(.+)$/;
const LEGACY = /^(PASS|FAIL)(?![A-Za-z])[\s.:—–-]*(.*)$/;

function shorten(s, n = 200) { s = s.replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

/** Numbered fix lines (indented follow-up lines are joined onto the previous fix). */
function numberedFixes(lines) {
  const fixes = [];
  for (const raw of lines) {
    const m = raw.match(NUMBERED);
    if (m) fixes.push(clean(m[2]));
    else if (fixes.length && /^\s+\S/.test(raw) && !/^\s*minor\s*:/i.test(clean(raw))) fixes[fixes.length - 1] += ' ' + clean(raw);
  }
  return fixes.filter(Boolean);
}

/**
 * @param {string} text  the contents of a claude -p JSON log
 * @returns {{verdict:'pass'|'fail'|'none', source:string, summary:string, fixes:string[], reason:string}}
 */
// A fix that only reports a broken environment (a check that could not run), not a code problem.
// The reviewer marks these "SETUP: …"; the pattern is a fallback for unmarked ones.
const SETUP_MARK = /^\s*setup\s*[:—-]\s*/i;
const SETUP_TEXT = new RegExp(
  '(playwright is not installed|cannot find module|module not found|node_modules|command not found|' +
  'executable doesn.t exist|browsers? (?:is |are )?(?:not installed|missing)|sandbox (?:blocked|denied)|' +
  '(?:smoke|npm|python3?|numpy|pdftoppm|chromium|playwright|fixtures)[^.;]{0,60}' +
  '(?:could ?n.t|could not|cannot|can.t|failed to|unable to) (?:run|start|launch|be run|import|load))', 'i');
const isSetup = (f) => SETUP_MARK.test(f) || SETUP_TEXT.test(f);

/**
 * Split a verdict's fixes into code fixes (sent to the builder) and setup items (environment only).
 * setup_only: a FAIL whose only complaints are setup items → a setup error, not a fix round.
 */
function classify(r) {
  const setup = r.fixes.filter(isSetup).map((f) => f.replace(SETUP_MARK, ''));
  const fixes = r.fixes.filter((f) => !isSetup(f));
  const setupOnly = r.verdict === 'fail' && fixes.length === 0 && (setup.length > 0 || SETUP_TEXT.test(r.summary));
  return { ...r, fixes, setup_fixes: setup, setup_only: setupOnly };
}

function parseReview(text) { return classify(parseReviewRaw(text)); }

function parseReviewRaw(text) {
  const none = (reason) => ({ verdict: 'none', source: 'none', summary: '', fixes: [], reason });
  let log;
  try { log = JSON.parse(text); } catch (e) { return none('log is not valid JSON'); }
  if (!log || typeof log !== 'object') return none('log is not a JSON object');
  const status = `subtype ${log.subtype || '?'}${log.is_error ? ', is_error' : ''}`;

  const so = log.structured_output;
  if (so && typeof so.verdict === 'string' && /^(pass|fail)$/i.test(so.verdict.trim())) {
    const fixes = Array.isArray(so.fixes) ? so.fixes.map((f) => String(f).trim()).filter(Boolean) : [];
    return { verdict: so.verdict.trim().toLowerCase(), source: 'structured_output',
      summary: shorten(String(so.summary || '')), fixes, reason: '' };
  }

  const result = typeof log.result === 'string' ? log.result : '';
  if (!result.trim()) return none(`no structured_output and empty .result (${status})`);
  const lines = result.replace(/\r\n?/g, '\n').split('\n');
  const firstText = () => {
    const l = lines.map(clean).find((x) => x && !VERDICT_LINE.test(x) && !/^#/.test(x));
    return shorten((l || '').replace(LEGACY, '$2') || l || '');
  };

  // 2. VERDICT line: the last one in the reply; only blank lines (PASS) or numbered fixes (FAIL) may follow.
  let at = -1;
  for (let i = lines.length - 1; i >= 0; i--) if (VERDICT_LINE.test(clean(lines[i]))) { at = i; break; }
  if (at >= 0) {
    const verdict = clean(lines[at]).match(VERDICT_LINE)[1].toLowerCase();
    const after = lines.slice(at + 1);
    const stray = after.filter((l) => l.trim() && !NUMBERED.test(l) && !/^\s+\S/.test(l));
    if (verdict === 'pass' && after.some((l) => l.trim())) return none('text after "VERDICT: PASS" — it must be the last line');
    if (stray.length) return none(`unexpected text after "VERDICT: FAIL": ${shorten(stray[0], 80)}`);
    return { verdict, source: 'result:verdict-line', summary: firstText(), fixes: verdict === 'fail' ? numberedFixes(after) : [], reason: '' };
  }

  // 3. Legacy: first non-empty line starts with PASS / FAIL.
  const first = lines.map(clean).find(Boolean) || '';
  const m = first.match(LEGACY);
  if (m) {
    const verdict = m[1].toLowerCase();
    return { verdict, source: 'result:legacy-first-line', summary: shorten(m[2] || first),
      fixes: verdict === 'fail' ? numberedFixes(lines) : [], reason: '' };
  }
  return none(`no structured_output and no VERDICT line in .result (${status})`);
}

module.exports = { parseReview, isSetup };

if (require.main === module) {
  const file = process.argv[2];
  if (!file) { console.error('usage: node scripts/review-verdict.js <review-log.json>'); process.exit(2); }
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) { text = ''; }
  const r = text ? parseReview(text) : { verdict: 'none', source: 'none', summary: '', fixes: [], reason: `cannot read ${file}` };
  process.stdout.write(JSON.stringify(r) + '\n');
}
