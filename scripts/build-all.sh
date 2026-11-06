#!/usr/bin/env bash
# Unattended batch build in three phases:
#   1. toolkit   — one builder adds the shared parts the batch needs (sequential)
#   2. build     — one builder per visualisation, in parallel git worktrees
#   3. merge     — passing branches merged into main one at a time, with checks after each
#
#   scripts/build-all.sh 1.3 2.1 2.2
#   scripts/build-all.sh --parallel 3 1.3 2.1 2.2
#   scripts/build-all.sh --skip-toolkit 1.3          (toolkit already committed)
#   BUILDER_MODEL=sonnet REVIEWER_MODEL=opus MAX_ROUNDS=2 scripts/build-all.sh 1.3
#   scripts/build-all.sh --fake-review-output tests/fixtures/review-pass-text.json
#        (no ids: parse that saved reviewer log, print the verdict, exit 0 pass / 1 fail / 3 none)
#   scripts/build-all.sh --fake-review-output f.json 1.3
#        (every reviewer call copies f.json instead of calling claude; builders still run)
#
# Needs: claude (Claude Code CLI, logged in), git, jq, node, python3 with numpy,
#        npm install && npx playwright install chromium   (once, for the smoke test)
# Logs:  logs/<id>-*.json  ·  progress: docs/progress.md  ·  costs printed per visualisation
# Verdict: .structured_output if present, else the reply's final `VERDICT: PASS|FAIL` line
#          (scripts/review-verdict.js). No verdict → the review is re-run once; still none →
#          "review inconclusive": work committed on the build branch, log file named, no fix round.
set -euo pipefail
CALLER_PWD="$(pwd)"
cd "$(dirname "$0")/.."
REPO="$(pwd)"
REPO_NAME="$(basename "$REPO")"

BUILDER_MODEL="${BUILDER_MODEL:-sonnet}"
REVIEWER_MODEL="${REVIEWER_MODEL:-opus}"
MAX_ROUNDS="${MAX_ROUNDS:-2}"
PARALLEL=2
SKIP_TOOLKIT=false
FAKE_REVIEW=""
IDS=()

while [ $# -gt 0 ]; do
  case "$1" in
    --parallel) PARALLEL="${2:-2}"; shift 2 ;;
    --parallel=*) PARALLEL="${1#*=}"; shift ;;
    --skip-toolkit) SKIP_TOOLKIT=true; shift ;;
    --fake-review-output) FAKE_REVIEW="${2:-}"; shift 2 ;;
    --fake-review-output=*) FAKE_REVIEW="${1#*=}"; shift ;;
    -h|--help) sed -n '2,21p' "$0"; exit 0 ;;
    -*) echo "unknown option: $1"; exit 2 ;;
    *) IDS+=("$1"); shift ;;
  esac
done
if [ -n "$FAKE_REVIEW" ]; then
  case "$FAKE_REVIEW" in /*) ;; *) FAKE_REVIEW="$CALLER_PWD/$FAKE_REVIEW" ;; esac
  [ -f "$FAKE_REVIEW" ] || { echo "--fake-review-output: no such file: $FAKE_REVIEW"; exit 2; }
  FAKE_REVIEW="$(cd "$(dirname "$FAKE_REVIEW")" && pwd)/$(basename "$FAKE_REVIEW")"
fi
if [ -n "$FAKE_REVIEW" ] && [ ${#IDS[@]} -eq 0 ]; then # parse-only mode: no claude, no git
  j=$(node scripts/review-verdict.js "$FAKE_REVIEW")
  v=$(jq -r .verdict <<<"$j")
  echo "verdict: $v · source: $(jq -r .source <<<"$j")"
  echo "summary: $(jq -r '.summary' <<<"$j")"
  [ "$v" = none ] && echo "reason:  $(jq -r .reason <<<"$j")"
  jq -r '.fixes | to_entries[] | "  \(.key + 1). \(.value)"' <<<"$j"
  case "$v" in pass) exit 0 ;; fail) exit 1 ;; *) exit 3 ;; esac
fi
[ ${#IDS[@]} -eq 0 ] && { echo "usage: $0 [--parallel N] [--skip-toolkit] [--fake-review-output file.json] <id> [id …]   e.g. $0 --parallel 2 1.3 2.1"; exit 2; }
case "$PARALLEL" in ''|*[!0-9]*) echo "--parallel needs a number"; exit 2 ;; esac
[ "$PARALLEL" -ge 1 ] || { echo "--parallel must be at least 1"; exit 2; }

[ -n "$FAKE_REVIEW" ] && echo "== --fake-review-output: every review is $FAKE_REVIEW (builders still call claude)"
for cmd in claude git jq node python3; do command -v "$cmd" >/dev/null || { echo "missing: $cmd"; exit 2; }; done
[ -z "$(git status --porcelain)" ] || { echo "Working tree is not clean. Commit or stash first."; exit 2; }
mkdir -p logs docs/reports docs/plans
[ -f docs/progress.md ] || printf '# Build progress\n\n' > docs/progress.md
grep -q '^logs/' .gitignore 2>/dev/null || echo 'logs/' >> .gitignore

BATCH="$(IFS=-; echo "${IDS[*]}")"

# What each role may do without asking. Builder edits files; reviewer only reads and runs checks.
BUILD_TOOLS='Read,Write,Edit,Glob,Grep,Bash(node *),Bash(npm test*),Bash(npm run *),Bash(python3 *),Bash(pdftoppm *),Bash(grep *),Bash(sed *),Bash(git status*),Bash(git diff*),Bash(git add*),Bash(git commit*),Bash(git rev-parse*),Bash(git branch*),Bash(ls *),Bash(mkdir *)'
# StructuredOutput is the tool --json-schema adds; dontAsk would otherwise be free to refuse it.
REVIEW_TOOLS='Read,Glob,Grep,StructuredOutput,Bash(node *),Bash(npm test*),Bash(npm run smoke*),Bash(npm run fixtures*),Bash(git show*),Bash(python3 *),Bash(pdftoppm *),Bash(grep *),Bash(sed *),Bash(git status*),Bash(git diff*),Bash(git log*),Bash(ls *)'
CLAUDE=(claude -p --strict-mcp-config) # no MCP servers from user settings in builds
VERDICT_SCHEMA='{"type":"object","properties":{"verdict":{"type":"string","enum":["pass","fail"]},"summary":{"type":"string"},"fixes":{"type":"array","items":{"type":"string"}}},"required":["verdict","summary","fixes"]}'

VERDICT_RULE='End your reply with the verdict block, exactly as .claude/agents/viz-reviewer.md says: a line `VERDICT: PASS` or `VERDICT: FAIL`. Nothing may follow VERDICT: PASS. After VERDICT: FAIL only the numbered fixes, one per line ("1. <file>: <change>"). If a StructuredOutput tool is available, also call it with the same verdict and fixes.'

# ---- reviewer runs and verdicts --------------------------------------------
# parse_review <log>      → sets R_VERDICT (pass|fail|none), R_SUMMARY, R_FIXES (numbered lines), R_LOG
parse_review() {
  local j; j=$(node "$REPO/scripts/review-verdict.js" "$1")
  R_LOG="$1"
  R_VERDICT=$(jq -r .verdict <<<"$j")
  R_SUMMARY=$(jq -r 'if .verdict == "none" then "no verdict: " + .reason else .summary end' <<<"$j")
  R_FIXES=$(jq -r '.fixes | to_entries | map("\(.key + 1). \(.value)") | join("\n")' <<<"$j")
}
# run_review <log> <prompt>  → one reviewer call (or a copy of --fake-review-output), then parse_review
run_review() {
  local log="$1" prompt="$2"
  if [ -n "$FAKE_REVIEW" ]; then
    cp "$FAKE_REVIEW" "$log"
  else
    "${CLAUDE[@]}" "$prompt

$VERDICT_RULE" \
      --agent viz-reviewer --model "$REVIEWER_MODEL" \
      --permission-mode dontAsk --allowedTools "$REVIEW_TOOLS" \
      --output-format json --json-schema "$VERDICT_SCHEMA" > "$log" || true
  fi
  parse_review "$log"
}
# review <log-stem> <prompt>  → run_review; if it gave no verdict, re-run the review once (no fix round)
review() {
  run_review "$1.json" "$2"
  if [ "$R_VERDICT" = none ]; then
    echo "   $R_SUMMARY ($R_LOG) — re-running the review once"
    run_review "$1-retry.json" "$2"
  fi
}

# ---- cost accounting -------------------------------------------------------
cost_of() { jq -r '.total_cost_usd // 0' "$1" 2>/dev/null || echo 0; }
sum_costs() { # sum total_cost_usd over the given log files
  local t=0 f
  for f in "$@"; do [ -f "$f" ] && t=$(echo "$t $(cost_of "$f")" | awk '{printf "%.4f", $1 + $2}'); done
  echo "$t"
}
ready_ids() { # every visualisation currently marked ready in the manifest
  node -e 'const m=require("./content/courses.js");const o=[];for(const c of m.courses)for(const L of c.lectures)for(const v of L.visualisations)if(v.status==="ready")o.push(v.id);console.log(o.join(" "))'
}

echo "== batch $BATCH · builder $BUILDER_MODEL · reviewer $REVIEWER_MODEL · parallel $PARALLEL · max rounds $MAX_ROUNDS"

# ---- phase 1+2: shared toolkit, sequential ---------------------------------
if $SKIP_TOOLKIT; then
  echo "== toolkit: skipped (--skip-toolkit)"
else
  echo "== toolkit for $BATCH: building with $BUILDER_MODEL"
  "${CLAUDE[@]}" "Toolkit mode. Plan and build the shared toolkit, maths and manifest stubs for visualisations: ${IDS[*]}.
Read their entries in docs/catalogue.md, check what already exists in js/toolkit, js/math and dev/gallery.html, then build only what is missing, in general form. Write the plan to docs/plans/$BATCH.md first. Add each visualisation's manifest entry with status \"placeholder\" and an empty stub file at its module path. Finish green on npm test, npm run fixtures and npm run smoke -- $(ready_ids) --no-shots. Do not build any visualisation logic." \
    --agent viz-builder --model "$BUILDER_MODEL" \
    --permission-mode acceptEdits --allowedTools "$BUILD_TOOLS" \
    --output-format json > "logs/toolkit-$BATCH-1.json" || true

  tk_inconclusive() { # no verdict even after a re-run: keep the work, committed on a build branch
    local br="build/toolkit-$BATCH"
    git rev-parse -q --verify "refs/heads/$br" >/dev/null && br="$br-$(date +%Y%m%d-%H%M%S)"
    git checkout -q -b "$br"
    git add -A && git commit -q -m "toolkit for $BATCH (review inconclusive, see $R_LOG)" || true
    echo "== toolkit for $BATCH: review inconclusive — $R_SUMMARY"
    echo "   log: $R_LOG"
    echo "   work committed on branch $br (you are on it). Read the log, then merge it or delete the branch."
    echo "   cost so far: \$$(sum_costs logs/toolkit-"$BATCH"-*.json)"
    exit 3
  }

  echo "== toolkit for $BATCH: review with $REVIEWER_MODEL"
  review "logs/toolkit-$BATCH-review-1" "Review the uncommitted toolkit work for the batch: ${IDS[*]}. This is a toolkit-phase review: check that every addition is general (not shaped around one visualisation), documented in the scene-format comment, demoed in dev/gallery.html, that new maths has NumPy fixture cases, and that nothing already ready has regressed."
  echo "   verdict: $R_VERDICT · $R_SUMMARY"
  [ "$R_VERDICT" = none ] && tk_inconclusive

  if [ "$R_VERDICT" = fail ]; then
    tk_session=$(jq -r '.session_id // empty' "logs/toolkit-$BATCH-1.json")
    if [ -z "$R_FIXES" ]; then
      echo "== toolkit FAILED, but the reviewer gave no concrete fixes — no fix round. Log: $R_LOG"
      echo "   cost so far: \$$(sum_costs logs/toolkit-"$BATCH"-*.json) — tree left dirty for you to inspect."
      exit 1
    fi
    if [ -z "$tk_session" ]; then
      echo "== toolkit FAILED and the builder left no session to resume. Fixes ($R_LOG):"; echo "$R_FIXES"
      exit 1
    fi
    echo "== toolkit for $BATCH: one fix round ($(grep -c . <<<"$R_FIXES") fixes)"
    "${CLAUDE[@]}" "The reviewer rejected the toolkit. Fix every item, re-run npm test, npm run fixtures and npm run smoke -- $(ready_ids) --no-shots, then list what you changed per item.

$R_FIXES" --resume "$tk_session" --model "$BUILDER_MODEL" \
      --permission-mode acceptEdits --allowedTools "$BUILD_TOOLS" \
      --output-format json > "logs/toolkit-$BATCH-2.json" || true
    review "logs/toolkit-$BATCH-review-2" "Re-review the uncommitted toolkit work for: ${IDS[*]}."
    echo "   verdict: $R_VERDICT · $R_SUMMARY"
    [ "$R_VERDICT" = none ] && tk_inconclusive
  fi

  tk_cost=$(sum_costs logs/toolkit-"$BATCH"-*.json)
  if [ "$R_VERDICT" != "pass" ]; then
    echo "== toolkit FAILED after 2 reviews: $R_SUMMARY (log: $R_LOG)"
    [ -n "$R_FIXES" ] && echo "$R_FIXES"
    echo "   cost so far: \$$tk_cost — tree left dirty for you to inspect."
    exit 1
  fi
  git add -A && git commit -q -m "toolkit for $BATCH (built by $BUILDER_MODEL, reviewed by $REVIEWER_MODEL)"
  echo "== toolkit committed · cost \$$tk_cost"
fi

# ---- phase 3: one worktree per visualisation, N at a time ------------------
build_one() { # runs in a background job: build + review + fix rounds, inside the worktree
  local id="$1" wt="$2" branch="viz/$id" round verdict summary session
  {
    echo "== $id: building in $wt"
    "${CLAUDE[@]}" "Build visualisation $id from docs/catalogue.md, following CLAUDE.md and your agent instructions. You are in a git worktree on branch $branch: commit your work here when it is green; do not touch the toolkit, js/math, fixtures, the gallery or any other visualisation. If you need a toolkit change, write TOOLKIT REQUEST at the top of docs/reports/$id.md and finish the rest." \
      --agent viz-builder --model "$BUILDER_MODEL" \
      --permission-mode acceptEdits --allowedTools "$BUILD_TOOLS" \
      --output-format json > "$REPO/logs/$id-build-1.json" || true
    session=$(jq -r '.session_id // empty' "$REPO/logs/$id-build-1.json")

    verdict=fail; summary="builder produced no reviewable result"; R_LOG=""
    for round in $(seq 1 "$MAX_ROUNDS"); do
      review "$REPO/logs/$id-review-$round" "Review visualisation $id, just built in this worktree (branch $branch). Follow your agent instructions."
      verdict="$R_VERDICT"; summary="$R_SUMMARY"
      echo "== $id: review $round → $verdict · $summary"
      if [ "$verdict" = none ]; then
        # keep the work: commit whatever the builder left uncommitted on its own branch
        git add -A && git commit -q -m "viz $id: work in progress (review inconclusive, see $(basename "$R_LOG"))" || true
        verdict=inconclusive; summary="review inconclusive, log $(basename "$R_LOG")"
        break
      fi
      [ "$verdict" = "pass" ] && break
      if [ -z "$R_FIXES" ]; then summary="$summary (FAIL without concrete fixes; no fix round, log $(basename "$R_LOG"))"; break; fi
      [ "$round" -lt "$MAX_ROUNDS" ] || break
      [ -n "$session" ] || { summary="$summary (no builder session to resume)"; break; }
      "${CLAUDE[@]}" "The reviewer rejected visualisation $id. Fix every item, re-run npm test and npm run smoke -- $id, update docs/reports/$id.md, commit on $branch, then list what you changed per item.

$R_FIXES" --resume "$session" --model "$BUILDER_MODEL" \
        --permission-mode acceptEdits --allowedTools "$BUILD_TOOLS" \
        --output-format json > "$REPO/logs/$id-build-$((round + 1)).json" || true
    done
    # a passing review must never be lost: commit anything the builder left uncommitted
    [ "$verdict" = pass ] && { git add -A && git commit -q -m "viz $id: builder changes left uncommitted (review passed)" || true; }
    echo "$verdict" > "$REPO/logs/$id.verdict"
    echo "$summary" > "$REPO/logs/$id.summary"
    echo "${R_LOG#"$REPO"/}" > "$REPO/logs/$id.reviewlog"
  } > "$REPO/logs/$id.console" 2>&1
}

started=()
for id in "${IDS[@]}"; do
  if grep -q "^- \[x\] $id " docs/progress.md; then echo "== $id already done, skipping"; continue; fi
  wt="$REPO/../$REPO_NAME-wt-$id"
  git worktree add -q "$wt" -b "viz/$id" 2>/dev/null || { echo "== $id: could not create worktree (branch viz/$id may exist)"; continue; }
  ( cd "$wt" && build_one "$id" "$wt" ) &
  started+=("$id")
  # simple concurrency gate: wait for a slot before launching the next one
  while [ "$(jobs -rp | wc -l | tr -d ' ')" -ge "$PARALLEL" ]; do wait -n 2>/dev/null || sleep 5; done
done
wait
echo "== all builders finished"

# ---- merge passing branches, one at a time ---------------------------------
TOTAL=0
for id in "${started[@]}"; do
  wt="$REPO/../$REPO_NAME-wt-$id"
  branch="viz/$id"
  verdict=$(cat "logs/$id.verdict" 2>/dev/null || echo fail)
  summary=$(cat "logs/$id.summary" 2>/dev/null || echo "no verdict")
  cost=$(sum_costs logs/"$id"-build-*.json logs/"$id"-review-*.json)
  TOTAL=$(echo "$TOTAL $cost" | awk '{printf "%.4f", $1 + $2}')

  if [ "$verdict" = "inconclusive" ]; then
    rlog=$(cat "logs/$id.reviewlog" 2>/dev/null || echo "logs/$id-review-*.json")
    echo "- [ ] $id review inconclusive: work committed on $branch (worktree $wt), log $rlog" >> docs/progress.md
    git add docs/progress.md && git commit -q -m "progress: $id review inconclusive"
    echo "== $id: review inconclusive · log $rlog · work committed on $branch · \$$cost"
    continue
  fi

  if [ "$verdict" != "pass" ]; then
    echo "- [ ] $id BLOCKED after $MAX_ROUNDS reviews: $summary (branch $branch, worktree $wt)" >> docs/progress.md
    git add docs/progress.md && git commit -q -m "progress: $id blocked"
    echo "== $id: BLOCKED · \$$cost · branch and worktree kept"
    continue
  fi

  echo "== $id: merging $branch"
  if ! git merge --no-ff -q "$branch" -m "viz $id (built by $BUILDER_MODEL, reviewed by $REVIEWER_MODEL)" 2>/dev/null; then
    # content/courses.js is the expected conflict: keep both entries (union of the two sides)
    if git diff --name-only --diff-filter=U | grep -qx 'content/courses.js'; then
      git checkout --theirs content/courses.js 2>/dev/null || true
      echo "== $id: content/courses.js conflicted — resolve by keeping BOTH entries, then: git commit"
    fi
    if git diff --name-only --diff-filter=U | grep -q .; then
      git merge --abort || true
      echo "- [ ] $id BLOCKED: merge conflict (branch $branch, worktree $wt)" >> docs/progress.md
      git add docs/progress.md && git commit -q -m "progress: $id blocked (merge conflict)"
      echo "== $id: BLOCKED on merge conflict · \$$cost"
      continue
    fi
    git commit -q --no-edit
  fi

  if npm test >/dev/null 2>&1 && npm run smoke -- $(ready_ids) --no-shots >/dev/null 2>&1; then
    echo "- [x] $id (review rounds: $MAX_ROUNDS max), $summary" >> docs/progress.md
    git add -A && git commit -q -m "progress: $id" || true
    git worktree remove --force "$wt" 2>/dev/null || true
    echo "== $id: merged and verified · \$$cost"
  else
    git reset --hard -q HEAD~1
    echo "- [ ] $id BLOCKED: merged but npm test / smoke failed (branch $branch, worktree $wt)" >> docs/progress.md
    git add docs/progress.md && git commit -q -m "progress: $id blocked (checks failed after merge)"
    echo "== $id: BLOCKED — checks failed after merge, reverted · \$$cost"
  fi
done

echo
echo "== batch $BATCH done · total \$$TOTAL"
echo "   per-visualisation costs above; raw logs in logs/*.json (total_cost_usd); progress in docs/progress.md"
