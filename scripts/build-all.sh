#!/usr/bin/env bash
# Unattended batch build in three phases:
#   1. toolkit   — one builder adds the shared parts the batch needs (sequential)
#   2. build     — one builder per visualisation, in parallel git worktrees
#   3. merge     — passing branches merged into main one at a time, with checks after each
#
#   scripts/build-all.sh 1.3 2.1 2.2
#   scripts/build-all.sh --parallel 3 1.3 2.1 2.2
#   scripts/build-all.sh --skip-toolkit 1.3          (toolkit already committed)
#   scripts/build-all.sh --continue 1.3 2.1          (reuse branch viz/<id> + worktree; review first)
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
# Worktrees: each gets the main checkout's node_modules linked in and must load Playwright, find
#          Chromium and import numpy before its builder starts; otherwise that id stops as a SETUP
#          ERROR. A reviewer FAIL that only reports a broken environment is a SETUP ERROR too.
# Usage limit: any claude call that stops on a usage/rate limit (scripts/claude-result.js) stops
#          the batch with exit 75 and writes logs/PAUSED.json. Nothing is stashed or BLOCKED and the
#          interrupted step is not counted. Run the same command again later to continue.
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
SIMULATE_LIMIT=""  # hidden test option: --simulate-limit build|review|fix
IDS=()
CONTINUE_IDS=" "   # ids given with --continue, space-padded
EXIT_PAUSED=75
EXIT_SETUP=4

while [ $# -gt 0 ]; do
  case "$1" in
    --parallel) PARALLEL="${2:-2}"; shift 2 ;;
    --parallel=*) PARALLEL="${1#*=}"; shift ;;
    --skip-toolkit) SKIP_TOOLKIT=true; shift ;;
    --fake-review-output) FAKE_REVIEW="${2:-}"; shift 2 ;;
    --fake-review-output=*) FAKE_REVIEW="${1#*=}"; shift ;;
    --simulate-limit) SIMULATE_LIMIT="${2:-}"; shift 2 ;;
    --simulate-limit=*) SIMULATE_LIMIT="${1#*=}"; shift ;;
    --continue) shift; n=0
      while [ $# -gt 0 ] && [ "${1#-}" = "$1" ]; do IDS+=("$1"); CONTINUE_IDS="$CONTINUE_IDS $1 "; n=$((n + 1)); shift; done
      [ "$n" -gt 0 ] || { echo "--continue needs at least one id"; exit 2; } ;;
    -h|--help) sed -n '2,28p' "$0"; exit 0 ;;
    -*) echo "unknown option: $1"; exit 2 ;;
    *) IDS+=("$1"); shift ;;
  esac
done
case "$SIMULATE_LIMIT" in ''|build|review|fix) ;; *) echo "--simulate-limit takes build, review or fix"; exit 2 ;; esac
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
[ -n "$SIMULATE_LIMIT" ] && echo "== --simulate-limit: the first $SIMULATE_LIMIT call returns a fake usage limit"
for cmd in claude git jq node python3; do command -v "$cmd" >/dev/null || { echo "missing: $cmd"; exit 2; }; done
is_continue() { case "$CONTINUE_IDS" in *" $1 "*) return 0 ;; esac; return 1; }

# Playwright browsers: one location for the main checkout, every worktree and every claude call.
if [ -z "${PLAYWRIGHT_BROWSERS_PATH:-}" ]; then
  for d in "$HOME/.cache/ms-playwright" "$HOME/Library/Caches/ms-playwright"; do
    [ -d "$d" ] && { export PLAYWRIGHT_BROWSERS_PATH="$d"; break; }
  done
fi
# check_env <dir> → silent and 0 when npm test / smoke / fixtures can run there; else prints why, 1
check_env() {
  local msg
  msg=$(cd "$1" && node -e '
    let pw;
    try { pw = require("playwright"); } catch (e) { console.log("node_modules/playwright is missing (" + (e.code || e.message) + ")"); process.exit(1); }
    const exe = pw.chromium.executablePath();
    if (!require("fs").existsSync(exe)) {
      console.log("Chromium is not installed at " + exe + " (PLAYWRIGHT_BROWSERS_PATH=" +
        (process.env.PLAYWRIGHT_BROWSERS_PATH || "unset") + "); run: npx playwright install chromium");
      process.exit(1);
    }' 2>&1) || { echo "$msg"; return 1; }
  (cd "$1" && python3 -c "import numpy") >/dev/null 2>&1 || { echo "python3 cannot import numpy (needed by npm run fixtures)"; return 1; }
}
if ! env_err=$(check_env "$PWD"); then
  echo "== setup error in $PWD: $env_err"
  echo "   fix it first (npm install && npx playwright install chromium), then re-run."
  exit "$EXIT_SETUP"
fi
BATCH="$(IFS=-; echo "${IDS[*]}")"
mkdir -p logs

# commit_changes <dir> <message> [path …] → stage everything (or just the paths) and commit only if
# something is staged. An empty commit must never stop a run (set -e).
commit_changes() {
  local d="$1" m="$2"; shift 2
  if [ $# -gt 0 ]; then git -C "$d" add -A -- "$@"; else git -C "$d" add -A; fi
  git -C "$d" diff --cached --quiet || git -C "$d" commit -q -m "$m"
}
# toolkit_missing → ids whose toolkit phase has not happened yet. Done means: the manifest entry has
# a module whose (stub) file exists, and a docs/plans/*.md named after a batch containing the id.
# Local files only — no claude call.
toolkit_missing() {
  node -e '
    const fs = require("fs"), m = require("./content/courses.js");
    const plans = fs.existsSync("docs/plans") ? fs.readdirSync("docs/plans").filter((f) => f.endsWith(".md")) : [];
    const planned = (id) => plans.some((f) => f.replace(/\.md$/, "").split("-").includes(id));
    const entry = {};
    for (const c of m.courses) for (const L of c.lectures) for (const v of L.visualisations) entry[v.id] = v;
    const miss = process.argv.slice(1).filter((id) => { const v = entry[id];
      return !(v && v.module && fs.existsSync(v.module) && planned(id)); });
    console.log(miss.join(" "));' "${IDS[@]}"
}

# ---- resume after a usage limit -------------------------------------------
# logs/PAUSED.json from an earlier run that covers an id asked for now → continue those ids where
# they stopped. The file is moved to logs/RESUMED-<time>.json (kept for reference), so PAUSED.json
# is gone; a new pause writes a new one.
RESUME=""
if [ -f logs/PAUSED.json ]; then
  ids_json=$(printf '%s\n' "${IDS[@]}" | jq -R . | jq -sc .)
  n=$(jq --argjson ids "$ids_json" --arg b "$BATCH" \
        '[.items[]? | select((.id == "toolkit" and .batch == $b) or (.id as $i | $ids | index($i)))] | length' \
        logs/PAUSED.json 2>/dev/null || echo 0)
  if [ "$n" -gt 0 ]; then
    RESUME="$REPO/logs/RESUMED-$(date +%Y%m%d-%H%M%S).json"
    cp logs/PAUSED.json "$RESUME"
    echo "== resuming after usage limit: $(jq -r '[.items[] | "\(.id)/\(.phase)"] | join(", ")' "$RESUME") (saved as ${RESUME#"$REPO"/})"
    if git ls-files --error-unmatch logs/PAUSED.json >/dev/null 2>&1; then # committed by a WIP commit
      git rm -q logs/PAUSED.json
      git diff --cached --quiet || git commit -q -m "resume $BATCH after usage limit"
    else
      rm -f logs/PAUSED.json
    fi
  else
    echo "== logs/PAUSED.json is for other ids ($(jq -r '[.items[]?.id] | join(" ")' logs/PAUSED.json 2>/dev/null)); leaving it"
  fi
fi
resume_get() { # resume_get <id> <field> → value from the saved pause, empty if none
  [ -n "$RESUME" ] || return 0
  jq -r --arg id "$1" --arg b "$BATCH" --arg f "$2" \
    'first(.items[] | select(.id == $id and (.id != "toolkit" or .batch == $b))) | .[$f] // empty' "$RESUME"
}

# A toolkit paused mid-build leaves its partial work uncommitted on purpose: allow that tree.
if [ -n "$(resume_get toolkit phase)" ]; then
  echo "== continuing the paused toolkit: uncommitted partial work is expected"
else
  [ -z "$(git status --porcelain)" ] || { echo "Working tree is not clean. Commit or stash first."; exit 2; }
fi
mkdir -p docs/reports docs/plans
[ -f docs/progress.md ] || printf '# Build progress\n\n' > docs/progress.md
grep -q '^logs/' .gitignore 2>/dev/null || echo 'logs/' >> .gitignore
rm -f logs/PAUSED-*.json
rmdir logs/.simulated-limit 2>/dev/null || true

# What each role may do without asking. Builder edits files; reviewer only reads and runs checks.
BUILD_TOOLS='Read,Write,Edit,Glob,Grep,Bash(node *),Bash(npm test*),Bash(npm run *),Bash(python3 *),Bash(pdftoppm *),Bash(grep *),Bash(sed *),Bash(git status*),Bash(git diff*),Bash(git add*),Bash(git commit*),Bash(git rev-parse*),Bash(git branch*),Bash(ls *),Bash(mkdir *)'
# StructuredOutput is the tool --json-schema adds; dontAsk would otherwise be free to refuse it.
REVIEW_TOOLS='Read,Glob,Grep,StructuredOutput,Bash(node *),Bash(npm test*),Bash(npm run smoke*),Bash(npm run fixtures*),Bash(git show*),Bash(python3 *),Bash(pdftoppm *),Bash(grep *),Bash(sed *),Bash(git status*),Bash(git diff*),Bash(git log*),Bash(ls *)'
CLAUDE=(claude -p --strict-mcp-config) # no MCP servers from user settings in builds
VERDICT_SCHEMA='{"type":"object","properties":{"verdict":{"type":"string","enum":["pass","fail"]},"summary":{"type":"string"},"fixes":{"type":"array","items":{"type":"string"}}},"required":["verdict","summary","fixes"]}'

VERDICT_RULE='End your reply with the verdict block, exactly as .claude/agents/viz-reviewer.md says: a line `VERDICT: PASS` or `VERDICT: FAIL`. Nothing may follow VERDICT: PASS. After VERDICT: FAIL only the numbered fixes, one per line ("1. <file>: <change>"). If a StructuredOutput tool is available, also call it with the same verdict and fixes.'
EXISTING_NOTE='This visualisation was built in an earlier run and its branch already holds that work. Continue the existing work: read what is there first and change only what the fixes below need.'
CONTINUE_NOTE='A usage limit stopped the previous run of this task part-way. Continue the unfinished work; existing files are partial — check them before building on them.'

# ---- per-id state (files, so background jobs and bash 3.2 can share it) -------
# logs/<id>.phase "build|review|fix <round>" · logs/<id>.session builder session · logs/<id>.fixes
st()      { echo "$REPO/logs/$1.$2"; }
st_get()  { cat "$(st "$1" "$2")" 2>/dev/null || true; }
st_set()  { printf '%s\n' "$3" > "$(st "$1" "$2")"; }

# ---- claude calls and the usage-limit check ---------------------------------
# usage_limit <log> → exit 0 when that run stopped on a usage/rate limit; sets L_JSON
usage_limit() {
  L_JSON=$(node "$REPO/scripts/claude-result.js" "$1")
  [ "$(jq -r .limited <<<"$L_JSON")" = true ]
}
fake_limit() { # what --simulate-limit writes instead of calling claude
  jq -n --arg s "${1:-}" '{type:"result", subtype:"success", is_error:true, api_error_status:429,
    total_cost_usd:0, session_id:$s, simulated:"--simulate-limit",
    result:"You have hit your session limit · resets 3:45pm"}'
}
# record_pause <id> <phase> <round> <log> <cause> → logs/PAUSED-<id>.json
record_pause() {
  local id="$1" phase="$2" round="$3" log="$4" cause="$5" limit='{}'
  [ -n "$log" ] && [ -f "$log" ] && limit=$(node "$REPO/scripts/claude-result.js" "$log")
  jq -n --arg id "$id" --arg batch "$BATCH" --arg phase "$phase" --argjson round "${round:-1}" \
        --arg session "$(st_get "$id" session)" --arg fixes "$(st_get "$id" fixes)" \
        --arg log "${log#"$REPO"/}" --arg cause "$cause" --arg wt "$(st_get "$id" wt)" \
        --arg branch "$([ "$id" = toolkit ] && git -C "$REPO" branch --show-current || echo "viz/$id")" \
        --argjson limit "$limit" \
    '{id:$id, batch:$batch, phase:$phase, round:$round, session_id:(if $session == "" then null else $session end),
      resets_at:($limit.resets_at // null), cause:$cause, signal:($limit.signal // null), log:$log,
      branch:$branch, worktree:(if $wt == "" then null else $wt end), fixes:$fixes}' \
    > "$REPO/logs/PAUSED-$id.json"
}
# claude_run <log> <id> <phase> <round> [claude args…]
# One claude -p call. Builder calls update the id's session. On a usage limit the step is recorded
# as paused (not counted) and this stops: a build job exits 75, the main shell pauses the batch.
claude_run() {
  local log="$1" id="$2" phase="$3" round="$4" s; shift 4
  st_set "$id" phase "$phase $round"
  if [ -n "$SIMULATE_LIMIT" ] && [ "$SIMULATE_LIMIT" = "$phase" ] && mkdir "$REPO/logs/.simulated-limit" 2>/dev/null; then
    fake_limit "$( [ "$phase" = review ] || st_get "$id" session)" > "$log"
  elif [ "$phase" = review ] && [ -n "$FAKE_REVIEW" ]; then
    cp "$FAKE_REVIEW" "$log"
  else
    "${CLAUDE[@]}" "$@" > "$log" || true
  fi
  if [ "$phase" != review ]; then
    s=$(jq -r '.session_id // empty' "$log" 2>/dev/null || true)
    [ -n "$s" ] && st_set "$id" session "$s"
  fi
  if usage_limit "$log"; then
    mv "$log" "${log%.json}-limit.json"
    record_pause "$id" "$phase" "$round" "${log%.json}-limit.json" "usage limit"
    echo "== $id: usage limit during $phase $round ($(jq -r .signal <<<"$L_JSON")) — pausing"
    if [ "${IN_JOB:-0}" = 1 ]; then exit "$EXIT_PAUSED"; fi
    finish_pause
  fi
  return 0
}
session_exists() { # a saved Claude Code session for this id still on disk?
  [ -n "${1:-}" ] || return 1
  ls "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/projects/*/"$1".jsonl >/dev/null 2>&1
}
# builder <log> <id> <phase build|fix> <round> <prompt> <mode false|limit|continue>
# Resumes the id's builder session when there is one (always in this run's own fix rounds; after a
# pause or with --continue only if it still exists), otherwise starts a fresh builder. Modes:
#   limit    — continuing a step a usage limit interrupted: files are partial
#   continue — --continue: the branch holds an earlier run's work
builder() {
  local log="$1" id="$2" phase="$3" round="$4" prompt="$5" mode="$6" s
  s=$(st_get "$id" session)
  case "$mode" in
    limit) prompt="$CONTINUE_NOTE Task: continue the unfinished work on $id; existing files are partial.

$prompt" ;;
    continue) prompt="$EXISTING_NOTE Task: continue the existing work on $id.

$prompt" ;;
  esac
  if [ -n "$s" ] && { [ "$mode" = false ] || session_exists "$s"; }; then
    claude_run "$log" "$id" "$phase" "$round" "$prompt" --resume "$s" --model "$BUILDER_MODEL" \
      --permission-mode acceptEdits --allowedTools "$BUILD_TOOLS" --output-format json
    # session gone after all ("No conversation found…") → fall back to a fresh builder
    if jq -e '.is_error == true and ((.result // "") | test("no conversation found|failed to resume"; "i"))' "$log" >/dev/null 2>&1; then
      echo "   session $s could not be resumed — starting a fresh builder"
      st_set "$id" session ""
    else
      return 0
    fi
  fi
  claude_run "$log" "$id" "$phase" "$round" "$prompt" \
    --agent viz-builder --model "$BUILDER_MODEL" \
    --permission-mode acceptEdits --allowedTools "$BUILD_TOOLS" --output-format json
}

# ---- reviewer runs and verdicts --------------------------------------------
# parse_review <log>      → sets R_VERDICT (pass|fail|none), R_SUMMARY, R_FIXES (numbered lines), R_LOG
parse_review() {
  local j; j=$(node "$REPO/scripts/review-verdict.js" "$1")
  R_LOG="$1"
  R_VERDICT=$(jq -r .verdict <<<"$j")
  R_SUMMARY=$(jq -r 'if .verdict == "none" then "no verdict: " + .reason else .summary end' <<<"$j")
  R_FIXES=$(jq -r '.fixes | to_entries | map("\(.key + 1). \(.value)") | join("\n")' <<<"$j")
  R_SETUP=$(jq -r '(.setup_fixes // []) | join("; ")' <<<"$j")
  R_SETUP_ONLY=$(jq -r '.setup_only // false' <<<"$j")
}
# run_review <log> <id> <round> <prompt>  → one reviewer call (or --fake-review-output), then parse
run_review() {
  claude_run "$1" "$2" review "$3" "$4

$VERDICT_RULE" \
    --agent viz-reviewer --model "$REVIEWER_MODEL" \
    --permission-mode dontAsk --allowedTools "$REVIEW_TOOLS" \
    --output-format json --json-schema "$VERDICT_SCHEMA"
  parse_review "$1"
}
# review <log-stem> <id> <round> <prompt>  → run_review; no verdict (not a usage limit) → re-run once
review() {
  run_review "$1.json" "$2" "$3" "$4"
  if [ "$R_VERDICT" = none ]; then
    echo "   $R_SUMMARY (${R_LOG#"$REPO"/}) — re-running the review once"
    run_review "$1-retry.json" "$2" "$3" "$4"
  fi
}

# cycle <id> <log-prefix> <max-rounds> <build-prompt> <review-prompt> <fix-prompt>
# build → review → fix … for one id, continuing a paused step if logs/PAUSED.json had one.
# Sets C_VERDICT (pass|fail|none) and C_SUMMARY.
cycle() {
  local id="$1" lp="$2" max="$3" bprompt="$4" rprompt="$5" fprompt="$6"
  local phase round start=1 s
  phase=$(resume_get "$id" phase); round=$(resume_get "$id" round)
  s=$(resume_get "$id" session_id); [ -n "$s" ] && st_set "$id" session "$s"
  C_VERDICT=fail; C_SUMMARY="builder produced no reviewable result"
  local fixmode=false
  if [ -z "$phase" ] && is_continue "$id"; then phase=continue; fixmode=continue; fi
  case "$phase" in
    "")     builder "$lp-build-1.json" "$id" build 1 "$bprompt" false ;;
    continue) echo "== $id: --continue: reviewing the existing work on its branch first" ;;
    build)  echo "== $id: continuing the paused build"
            builder "$lp-build-1-cont.json" "$id" build 1 "$bprompt" limit ;;
    review) echo "== $id: continuing at review $round (the paused review is not counted)"; start=$round ;;
    fix)    echo "== $id: continuing the paused fix round after review $round"
            R_FIXES=$(resume_get "$id" fixes); st_set "$id" fixes "$R_FIXES"
            builder "$lp-build-$((round + 1))-cont.json" "$id" fix "$round" "$fprompt

$R_FIXES" limit
            start=$((round + 1)) ;;
  esac
  # a toolkit builder that changed nothing leaves nothing to review or commit
  if [ "$id" = toolkit ] && [ "$phase" != review ] && [ "$phase" != fix ] && [ -z "$(git status --porcelain)" ]; then
    C_VERDICT=unchanged; C_SUMMARY="the builder changed nothing"
    return 0
  fi
  for round in $(seq "$start" "$max"); do
    review "$lp-review-$round" "$id" "$round" "$rprompt"
    C_VERDICT="$R_VERDICT"; C_SUMMARY="$R_SUMMARY"
    echo "== $id: review $round → $C_VERDICT · $C_SUMMARY"
    [ "$C_VERDICT" = fail ] || break
    if [ "$R_SETUP_ONLY" = true ]; then # the environment is broken, not the code: no fix round
      C_VERDICT=setup; C_SUMMARY="setup error reported by the reviewer: ${R_SETUP:-$R_SUMMARY} (log $(basename "$R_LOG"))"
      break
    fi
    [ -n "$R_SETUP" ] && echo "   not sent to the builder (setup, not code): $R_SETUP"
    if [ -z "$R_FIXES" ]; then C_SUMMARY="$C_SUMMARY (FAIL without concrete fixes; no fix round, log $(basename "$R_LOG"))"; break; fi
    [ "$round" -lt "$max" ] || break
    st_set "$id" fixes "$R_FIXES"
    echo "== $id: fix round $round ($(grep -c . <<<"$R_FIXES") fixes)"
    builder "$lp-build-$((round + 1)).json" "$id" fix "$round" "$fprompt

$R_FIXES" "$fixmode"
  done
  return 0
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

# ---- pausing the batch -------------------------------------------------------
started=()
kill_tree() { local c; for c in $(pgrep -P "$1" 2>/dev/null); do kill_tree "$c"; done; kill "$1" 2>/dev/null || true; }
stop_jobs() { # a limit hit one builder: stop the others now, recording where each one was
  local p id ph
  for p in $(jobs -p); do kill_tree "$p"; done
  wait 2>/dev/null || true
  for id in ${started[@]+"${started[@]}"}; do
    [ -f "logs/$id.verdict" ] || [ -f "logs/PAUSED-$id.json" ] && continue
    ph=$(st_get "$id" phase); [ -n "$ph" ] || ph="build 1"
    record_pause "$id" "${ph%% *}" "${ph##* }" "" "stopped with the batch"
  done
}
finish_pause() { # write logs/PAUSED.json, commit partial worktree work (never stash), exit 75
  local f wt id where resets
  for f in logs/PAUSED-*.json; do
    id=$(jq -r .id "$f"); wt=$(jq -r '.worktree // empty' "$f")
    if [ -n "$wt" ] && [ -d "$wt" ]; then
      commit_changes "$wt" "WIP $id: paused at usage limit" || true
    fi
  done
  jq -s --arg batch "$BATCH" --argjson ids "$(printf '%s\n' "${IDS[@]}" | jq -R . | jq -sc .)" \
     --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    'sort_by(if .cause == "usage limit" then 0 else 1 end) as $it
     | {batch:$batch, ids:$ids, paused_at:$at, id:$it[0].id, phase:$it[0].phase, session_id:$it[0].session_id,
        resets_at:([$it[].resets_at | select(. != null)][0] // null), items:$it}' \
     logs/PAUSED-*.json > logs/PAUSED.json
  rm -f logs/PAUSED-*.json
  where=$(jq -r '[.items[] | "\(.id)/\(.phase)"] | join(", ")' logs/PAUSED.json)
  resets=$(jq -r '.resets_at // "unknown"' logs/PAUSED.json)
  echo "PAUSED (usage limit) at $where, resets $resets"
  exit "$EXIT_PAUSED"
}

echo "== batch $BATCH · builder $BUILDER_MODEL · reviewer $REVIEWER_MODEL · parallel $PARALLEL · max rounds $MAX_ROUNDS"

# ---- phase 1+2: shared toolkit, sequential ---------------------------------
if $SKIP_TOOLKIT && [ -z "$(resume_get toolkit phase)" ]; then
  echo "== toolkit: skipped (--skip-toolkit)"
elif [ -n "$RESUME" ] && [ -z "$(resume_get toolkit phase)" ]; then
  echo "== toolkit: done before the pause"
elif [ -z "$(resume_get toolkit phase)" ] && [ -z "$(toolkit_missing)" ]; then
  echo "== toolkit for $BATCH: nothing new needed, skipping"
else
  st_set toolkit wt ""
  st_set toolkit session ""
  tk_inconclusive() { # no verdict even after a re-run: keep the work, committed on a build branch
    local br="build/toolkit-$BATCH"
    git rev-parse -q --verify "refs/heads/$br" >/dev/null && br="$br-$(date +%Y%m%d-%H%M%S)"
    git checkout -q -b "$br"
    commit_changes . "toolkit for $BATCH (review inconclusive, see $R_LOG)" || true
    echo "== toolkit for $BATCH: review inconclusive — $R_SUMMARY"
    echo "   log: $R_LOG"
    echo "   work committed on branch $br (you are on it). Read the log, then merge it or delete the branch."
    echo "   cost so far: \$$(sum_costs logs/toolkit-"$BATCH"-*.json)"
    exit 3
  }
  echo "== toolkit for $BATCH: builder $BUILDER_MODEL, reviewer $REVIEWER_MODEL (not prepared yet: $(toolkit_missing))"
  cycle toolkit "logs/toolkit-$BATCH" 2 \
    "Toolkit mode. Plan and build the shared toolkit, maths and manifest stubs for visualisations: ${IDS[*]}.
Read their entries in docs/catalogue.md, check what already exists in js/toolkit, js/math and dev/gallery.html, then build only what is missing, in general form. Write the plan to docs/plans/$BATCH.md first. Add each visualisation's manifest entry with status \"placeholder\" and an empty stub file at its module path. Finish green on npm test, npm run fixtures and npm run smoke -- $(ready_ids) --no-shots. Do not build any visualisation logic." \
    "Review the uncommitted toolkit work for the batch: ${IDS[*]}. This is a toolkit-phase review: check that every addition is general (not shaped around one visualisation), documented in the scene-format comment, demoed in dev/gallery.html, that new maths has NumPy fixture cases, and that nothing already ready has regressed." \
    "The reviewer rejected the toolkit. Fix every item, re-run npm test, npm run fixtures and npm run smoke -- $(ready_ids) --no-shots, then list what you changed per item."
  [ "$C_VERDICT" = none ] && tk_inconclusive
  if [ "$C_VERDICT" = setup ]; then
    echo "== toolkit for $BATCH: SETUP ERROR — $C_SUMMARY"
    echo "   no fix round was spent. Fix the environment, then re-run. Work left uncommitted for you to inspect."
    exit "$EXIT_SETUP"
  fi

  tk_cost=$(sum_costs logs/toolkit-"$BATCH"-*.json)
  if [ "$C_VERDICT" = unchanged ]; then
    echo "== toolkit for $BATCH: the builder changed nothing — no review, no commit · cost \$$tk_cost"
  elif [ "$C_VERDICT" != "pass" ]; then
    echo "== toolkit FAILED: $C_SUMMARY (log: $R_LOG)"
    [ -n "$R_FIXES" ] && echo "$R_FIXES"
    echo "   cost so far: \$$tk_cost — tree left dirty for you to inspect."
    exit 1
  else
    git add -A
    if git diff --cached --quiet; then # e.g. already in a "WIP … paused at usage limit" commit
      echo "== toolkit passed; nothing left to commit · cost \$$tk_cost"
    else
      git commit -q -m "toolkit for $BATCH (built by $BUILDER_MODEL, reviewed by $REVIEWER_MODEL)"
      echo "== toolkit committed · cost \$$tk_cost"
    fi
  fi
fi

# ---- phase 3: one worktree per visualisation, N at a time ------------------
build_one() { # runs in a background job: build + review + fix rounds, inside the worktree
  local id="$1" wt="$2" branch="viz/$id" verdict summary
  IN_JOB=1
  {
    echo "== $id: building in $wt"
    cycle "$id" "$REPO/logs/$id" "$MAX_ROUNDS" \
      "Build visualisation $id from docs/catalogue.md, following CLAUDE.md and your agent instructions. You are in a git worktree on branch $branch: commit your work here when it is green; do not touch the toolkit, js/math, fixtures, the gallery or any other visualisation. If you need a toolkit change, write TOOLKIT REQUEST at the top of docs/reports/$id.md and finish the rest." \
      "Review visualisation $id, just built in this worktree (branch $branch). Follow your agent instructions." \
      "The reviewer rejected visualisation $id. Fix every item, re-run npm test and npm run smoke -- $id, update docs/reports/$id.md, commit on $branch, then list what you changed per item."
    verdict="$C_VERDICT"; summary="$C_SUMMARY"
    if [ "$verdict" = setup ]; then
      commit_changes . "viz $id: work in progress (setup error, see $(basename "$R_LOG"))" || true
    fi
    if [ "$verdict" = none ]; then
      # keep the work: commit whatever the builder left uncommitted on its own branch
      commit_changes . "viz $id: work in progress (review inconclusive, see $(basename "$R_LOG"))" || true
      verdict=inconclusive; summary="review inconclusive, log $(basename "$R_LOG")"
    fi
    # a passing review must never be lost: commit anything the builder left uncommitted
    if [ "$verdict" = pass ]; then commit_changes . "viz $id: builder changes left uncommitted (review passed)" || true; fi
    echo "${R_LOG#"$REPO"/}" > "$REPO/logs/$id.reviewlog"
    echo "$summary" > "$REPO/logs/$id.summary"
    echo "$verdict" > "$REPO/logs/$id.verdict"   # written last: its presence means "finished"
  } >> "$REPO/logs/$id.console" 2>&1
}
paused() { ls logs/PAUSED-*.json >/dev/null 2>&1; }
# prepare_worktree <wt> → link the main checkout's node_modules in (git-ignored) and check that the
# checks can run there. Prints the problem and returns 1 if not.
prepare_worktree() {
  local wt="$1" ex
  ex="$(git rev-parse --git-common-dir)/info/exclude"   # shared by every worktree
  mkdir -p "$(dirname "$ex")"
  grep -qx '/node_modules' "$ex" 2>/dev/null || echo '/node_modules' >> "$ex"
  # a real node_modules directory already in the worktree is left alone; check_env judges it
  if [ -L "$wt/node_modules" ] || [ ! -e "$wt/node_modules" ]; then ln -sfn "$REPO/node_modules" "$wt/node_modules"; fi
  git -C "$wt" check-ignore -q node_modules || { echo "node_modules link in $wt is not git-ignored"; return 1; }
  check_env "$wt"
}
# setup_error <id> <message> → this id stops before any claude call
setup_error() {
  echo "$2" > "logs/$1.summary"; echo setup > "logs/$1.verdict"
  echo "== $1: SETUP ERROR — $2"
}
# drop_progress_line <dir> <id> → remove that id's BLOCKED / SETUP ERROR / inconclusive line there
drop_progress_line() {
  local f="$1/docs/progress.md" re
  [ -f "$f" ] || return 0
  re="^- \[ \] $2 (BLOCKED|SETUP ERROR|review inconclusive)"
  grep -Eq "$re" "$f" || return 0
  grep -Ev "$re" "$f" > "$f.tmp" && mv "$f.tmp" "$f"
  commit_changes "$1" "progress: continue $2" docs/progress.md
}

for id in "${IDS[@]}"; do
  paused && break
  if grep -q "^- \[x\] $id " docs/progress.md; then echo "== $id already done, skipping"; continue; fi
  wt="$REPO/../$REPO_NAME-wt-$id"
  rm -f "logs/$id.verdict" "logs/$id.summary" "logs/$id.reviewlog"
  if is_continue "$id" && [ -z "$(resume_get "$id" phase)" ]; then
    if ! git rev-parse -q --verify "refs/heads/viz/$id" >/dev/null; then
      echo "== $id: --continue needs an existing branch viz/$id — skipping"; continue
    fi
    [ -d "$wt" ] || git worktree add -q "$wt" "viz/$id"
    drop_progress_line "$REPO" "$id"
    drop_progress_line "$wt" "$id"
    echo "== $id: --continue on viz/$id in $wt (review first)"
  elif [ -n "$(resume_get "$id" phase)" ]; then
    if [ -d "$wt" ]; then :
    elif git rev-parse -q --verify "refs/heads/viz/$id" >/dev/null; then git worktree add -q "$wt" "viz/$id"
    else git worktree add -q "$wt" -b "viz/$id"
    fi
    echo "== $id: continuing in $wt ($(resume_get "$id" phase), round $(resume_get "$id" round))"
  else
    rm -f "logs/$id.session" "logs/$id.fixes" "logs/$id.phase"
    git worktree add -q "$wt" -b "viz/$id" 2>/dev/null || { echo "== $id: could not create worktree (branch viz/$id may exist)"; continue; }
  fi
  st_set "$id" wt "$wt"
  started+=("$id")
  if ! env_err=$(prepare_worktree "$wt"); then setup_error "$id" "$env_err (worktree $wt)"; continue; fi
  ( cd "$wt" && build_one "$id" "$wt" ) &
  # simple concurrency gate: wait for a slot before launching the next one (or stop on a pause)
  while [ "$(jobs -rp | wc -l | tr -d ' ')" -ge "$PARALLEL" ] && ! paused; do sleep 2; done
done
while [ -n "$(jobs -rp)" ] && ! paused; do sleep 2; done
if paused; then stop_jobs; echo "== usage limit: builders stopped; merging what already finished"
else wait; echo "== all builders finished"; fi

# ---- merge passing branches, one at a time ---------------------------------
TOTAL=0
SETUP_ERRORS=""
for id in ${started[@]+"${started[@]}"}; do
  [ -f "logs/PAUSED-$id.json" ] && { echo "== $id: paused, continues next run"; continue; }
  wt="$REPO/../$REPO_NAME-wt-$id"
  branch="viz/$id"
  verdict=$(cat "logs/$id.verdict" 2>/dev/null || echo fail)
  summary=$(cat "logs/$id.summary" 2>/dev/null || echo "no verdict")
  cost=$(sum_costs logs/"$id"-build-*.json logs/"$id"-review-*.json)
  TOTAL=$(echo "$TOTAL $cost" | awk '{printf "%.4f", $1 + $2}')

  if [ "$verdict" = "setup" ]; then
    echo "- [ ] $id SETUP ERROR: $summary (branch $branch, worktree $wt). Fix the environment, then: scripts/build-all.sh --continue $id" >> docs/progress.md
    commit_changes . "progress: $id setup error" docs/progress.md
    echo "== $id: SETUP ERROR — $summary · no fix round spent · \$$cost"
    SETUP_ERRORS="$SETUP_ERRORS $id"
    continue
  fi

  if [ "$verdict" = "inconclusive" ]; then
    rlog=$(cat "logs/$id.reviewlog" 2>/dev/null || echo "logs/$id-review-*.json")
    echo "- [ ] $id review inconclusive: work committed on $branch (worktree $wt), log $rlog" >> docs/progress.md
    commit_changes . "progress: $id review inconclusive" docs/progress.md
    echo "== $id: review inconclusive · log $rlog · work committed on $branch · \$$cost"
    continue
  fi

  if [ "$verdict" != "pass" ]; then
    echo "- [ ] $id BLOCKED after $MAX_ROUNDS reviews: $summary (branch $branch, worktree $wt)" >> docs/progress.md
    commit_changes . "progress: $id blocked" docs/progress.md
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
      commit_changes . "progress: $id blocked (merge conflict)" docs/progress.md
      echo "== $id: BLOCKED on merge conflict · \$$cost"
      continue
    fi
    git commit -q --no-edit
  fi

  if npm test >/dev/null 2>&1 && npm run smoke -- $(ready_ids) --no-shots >/dev/null 2>&1; then
    echo "- [x] $id (review rounds: $MAX_ROUNDS max), $summary" >> docs/progress.md
    commit_changes . "progress: $id"
    git worktree remove --force "$wt" 2>/dev/null || true
    echo "== $id: merged and verified · \$$cost"
  else
    git reset --hard -q HEAD~1
    echo "- [ ] $id BLOCKED: merged but npm test / smoke failed (branch $branch, worktree $wt)" >> docs/progress.md
    commit_changes . "progress: $id blocked (checks failed after merge)" docs/progress.md
    echo "== $id: BLOCKED — checks failed after merge, reverted · \$$cost"
  fi
done

paused && finish_pause
echo
echo "== batch $BATCH done · total \$$TOTAL"
if [ -n "$SETUP_ERRORS" ]; then
  echo "== SETUP ERRORS:$SETUP_ERRORS — see docs/progress.md; fix the environment, then --continue them"
fi
echo "   per-visualisation costs above; raw logs in logs/*.json (total_cost_usd); progress in docs/progress.md"
