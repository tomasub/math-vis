#!/usr/bin/env bash
# One build batch: the next 2 unfinished visualisations on a new branch, then a pull request.
# Run by a Hermes script-only cron job; whatever this prints is the message you receive.
# The live copy is on the Hermes host; this file in the repo is a reference copy — keep them in sync.
#
# Usage limit: build-all.sh exits 75 when Claude usage runs out mid-run. Then this commits
# everything as "WIP <ids>: paused at usage limit" on the build branch and pushes it (no pull
# request). The next run continues that branch with the same ids before picking new ones, and
# opens the pull request when it finishes. Helpers: scripts/hermes/paused-run.sh in the repo.
set -euo pipefail
export HOME=/home/hermes
export PATH="$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
export PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/ms-playwright"
REPO=/home/hermes/claude-projects/math-vis
PER_BATCH=2
cd "$REPO"

# Never build on top of leftovers from a failed run.
if [ -n "$(git status --porcelain)" ]; then
  echo "viz-batch: stopped, the repo has uncommitted changes in $REPO. Clean up, then resume the job."
  exit 1
fi
git checkout -q main && git pull -q --ff-only
. scripts/hermes/paused-run.sh   # paused_branch, paused_ids, save_paused

if BRANCH=$(paused_branch); then
  # A run paused at the usage limit: continue it (same branch, same ids) instead of picking new ones.
  git checkout -q "$BRANCH"
  NEXT=$(paused_ids)
  CONTINUING="continuing $BRANCH after usage limit"
else
  # Next ids: not "ready" in the manifest and not mentioned in docs/progress.md (done or BLOCKED).
  NEXT=$(node -e '
    const fs = require("fs"), m = require("./content/courses.js");
    const prog = fs.existsSync("docs/progress.md") ? fs.readFileSync("docs/progress.md", "utf8") : "";
    const ids = m.courses.flatMap(c => c.lectures.flatMap(l => l.visualisations))
      .filter(v => v.status !== "ready" && !prog.includes("] " + v.id + " ")).map(v => v.id);
    console.log(ids.slice(0, '"$PER_BATCH"').join(" "));')
  if [ -z "$NEXT" ]; then echo "viz-batch: nothing left to build."; exit 0; fi
  BRANCH="build/$(date +%F-%H%M)-${NEXT// /-}"
  git checkout -q -b "$BRANCH"
  CONTINUING=""
fi
mkdir -p logs
LOG="logs/batch-$(date +%F-%H%M).log"

set +e
scripts/build-all.sh $NEXT > "$LOG" 2>&1
STATUS=$?
set -e

if [ "$STATUS" -eq 75 ]; then
  echo "viz-batch: $NEXT${CONTINUING:+ ($CONTINUING)}"
  grep -h '^PAUSED (usage limit)' "$LOG" | tail -1 || true
  save_paused "$BRANCH" "$NEXT"   # prints "Paused at usage limit, partial work on <branch>, continues next run"
  git checkout -q main
  grep -iE "total|cost" "$LOG" | tail -3 || true
  exit 0
fi

if [ -z "$(git log main..HEAD --oneline)" ]; then
  echo "viz-batch: built nothing for $NEXT (exit $STATUS). Last lines of $LOG:"
  tail -15 "$LOG"
  git checkout -q main && git branch -q -D "$BRANCH"
  exit 1
fi

git push -q -u origin "$BRANCH"
PR=$(gh pr create --base main --head "$BRANCH" --title "Visualisations $NEXT" --body "$(cat docs/progress.md)")
# read the per-id results now: main does not have this branch's docs/progress.md yet
RESULTS=$(for id in $NEXT; do grep -h "] $id " docs/progress.md 2>/dev/null | tail -1 || true; done)
git checkout -q main

echo "viz-batch: $NEXT${CONTINUING:+ ($CONTINUING)}"
[ -n "$RESULTS" ] && echo "$RESULTS"
echo "PR: $PR"
grep -iE "total|cost" "$LOG" | tail -3 || true
