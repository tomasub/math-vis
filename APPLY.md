# Applying these files

Copy everything into the project root, keeping the folder structure. Nothing here touches the site's
visuals (css/, js/, index.html, content/, vendor/), so your visual changes are safe.

## New files (just copy)

CLAUDE.md, .gitignore, .claude/ (2 agents + 1 command), scripts/smoke.cjs, scripts/build-all.sh,
tests/harness.js, tests/viz/1.1.test.js, docs/ (catalogue, notes PDF, Sonnet prompt, progress, reports, reference)

If you already have a .gitignore, merge it instead. It lists node_modules/, tests/shots/, logs/ and .DS_Store.

## Changed files (3)

1. **tests/run.js: replace it.** The 1.1 tests moved to tests/viz/1.1.test.js. run.js now also runs every
   tests/viz/*.test.js file through tests/harness.js. If you kept the old run.js, the 1.1 tests would run twice.

2. **package.json: merge by hand.** Add these scripts and the dev dependency:

   ```json
   "scripts": {
     "test": "node tests/run.js",
     "smoke": "node scripts/smoke.cjs",
     "fixtures": "python3 tests/make_fixtures.py",
     "serve": "python3 -m http.server 8000"
   },
   "devDependencies": {
     "playwright": "1.48.2"
   }
   ```

3. **README.md: append** the contents of README-section-to-append.md at the end. Then delete that file.

## Then, in the VS Code terminal

```sh
chmod +x scripts/build-all.sh scripts/smoke.cjs
npm install && npx playwright install chromium
npm test                  # expect: 187 passed, 0 failed
npm run smoke -- 1.1      # expect: all 1 passed; screenshots in tests/shots/
git add -A && git commit -m "Add Claude Code build kit"
```

Delete APPLY.md when you're done.
