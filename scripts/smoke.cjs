#!/usr/bin/env node
// Browser smoke test for one or more visualisations.
//   npm run smoke -- 1.2 1.3        (default course: la; use la/1.2 or <course>/<id> to choose)
//   npm run smoke                    (every visualisation marked "ready" in the manifest)
//   npm run smoke -- 1.2 --no-shots  (checks only, no screenshots: fast, no tokens spent looking)
//
// For each page it opens index.html from disk (file://, like a user double-clicking it) and checks:
//   - the visualisation mounts (.viz appears) and no page errors / console errors occur
//   - keyboard: the first draggable point moves with ArrowRight (its aria-label changes)
//   - 3D: if the toolbar has a "Space R3" button, the 3D view mounts too
// Screenshots are of the .viz element only (not the whole page) in a 1200×900 viewport, so they
// stay small and cheap to look at: tests/shots/<id>-light.png, -dark.png (and -3d.png).
// LOOK AT THEM ONCE, at the end of a build — not after every edit.
// Needs Playwright once:  npm install && npx playwright install chromium
'use strict';
const path = require('node:path');
const fs = require('node:fs');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  console.error('Playwright is not installed. Run:  npm install && npx playwright install chromium');
  process.exit(2);
}
const root = path.join(__dirname, '..');
const manifest = require(path.join(root, 'content', 'courses.js'));
const shots = path.join(root, 'tests', 'shots');

const args = process.argv.slice(2);
const noShots = args.includes('--no-shots');
let targets = args.filter((a) => !a.startsWith('--')).map((a) => (a.includes('/') ? a : 'la/' + a));
if (!targets.length) {
  for (const c of manifest.courses) for (const L of c.lectures) for (const v of L.visualisations) {
    if (v.status === 'ready') targets.push(c.id + '/' + v.id);
  }
}
if (!noShots) fs.mkdirSync(shots, { recursive: true });
const IGNORE = [/build\/three\.min\.js.*deprecated/i]; // known, harmless warning text

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  let failures = 0;
  for (const t of targets) {
    const [course, id] = t.split('/');
    const res = { id: t, ok: true, problems: [], keyboard: null, shots: [] };
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.some((r) => r.test(m.text()))) errors.push('console: ' + m.text()); });
    try {
      await page.goto('file://' + path.join(root, 'index.html') + '#/' + course + '/' + id);
      await page.waitForSelector('.viz', { timeout: 8000 });
      await page.waitForTimeout(500);
      // Screenshot the visualisation itself, not the whole page: no nav, no footer, no dead space.
      const viz = page.locator('.viz').first();
      const shot = async (suffix) => {
        if (noShots) return;
        const p = path.join(shots, `${id}-${suffix}.png`);
        await viz.screenshot({ path: p });
        res.shots.push(path.relative(root, p));
      };
      await shot('light');

      const handle = page.locator('[aria-roledescription="draggable point"]').first();
      if (await handle.count()) {
        const before = await handle.getAttribute('aria-label');
        await handle.focus();
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(100);
        const after = await handle.getAttribute('aria-label');
        res.keyboard = before !== after ? 'moves with arrow keys' : 'DID NOT MOVE (aria-label unchanged)';
        if (before === after) res.problems.push('keyboard nudge had no visible effect on the first draggable point');
      } else res.keyboard = 'no draggable points';

      const r3 = page.locator('button[aria-label="Space R3"]');
      if (await r3.count()) {
        await r3.click();
        await page.waitForSelector('.stage3d canvas, .stage-fallback', { timeout: 8000 });
        await page.waitForTimeout(700);
        await shot('3d');
      }
      await page.click('#theme-toggle');
      await page.waitForTimeout(300);
      await shot('dark');
    } catch (e) {
      res.problems.push('did not mount or interaction failed: ' + e.message.split('\n')[0]);
    }
    res.problems.push(...errors);
    res.ok = res.problems.length === 0;
    if (!res.ok) failures++;
    // One compact line per visualisation when everything is fine; full JSON only on failure,
    // so a green run costs almost nothing to read.
    if (res.ok) console.log(`ok   ${res.id}  ·  ${res.keyboard}${res.shots.length ? '  ·  ' + res.shots.join(' ') : ''}`);
    else console.log(JSON.stringify(res, null, 2));
    await page.close();
  }
  await browser.close();
  console.log(failures ? `\n${failures} of ${targets.length} failed` : `\nall ${targets.length} passed`);
  process.exitCode = failures ? 1 : 0;
})();
