#!/usr/bin/env bash
# Unattended build loop: a builder model makes each visualisation, a reviewer model checks it,
# the builder fixes what the reviewer lists (same session), and passing work is committed.
#
#   scripts/build-all.sh 1.2 1.3 2.1 2.2 2.3 3.1 3.2 3.3
#   BUILDER_MODEL=sonnet REVIEWER_MODEL=opus MAX_ROUNDS=3 scripts/build-all.sh 1.2
#
# Needs: claude (Claude Code CLI, logged in), git, jq, node, python3 with numpy,
#        npm install && npx playwright install chromium   (once, for the smoke test)
# Logs:  logs/<id>-*.json  ·  progress: docs/progress.md
set -euo pipefail
cd "$(dirname "$0")/.."

BUILDER_MODEL="${BUILDER_MODEL:-sonnet}"
REVIEWER_MODEL="${REVIEWER_MODEL:-opus}"
MAX_ROUNDS="${MAX_ROUNDS:-3}"
IDS=("$@")
[ ${#IDS[@]} -eq 0 ] && { echo "usage: $0 <id> [id …]   e.g. $0 1.2 1.3"; exit 2; }

for cmd in claude git jq node python3; do command -v "$cmd" >/dev/null || { echo "missing: $cmd"; exit 2; }; done
[ -z "$(git status --porcelain)" ] || { echo "Working tree is not clean. Commit or stash first."; exit 2; }
mkdir -p logs docs/reports
[ -f docs/progress.md ] || printf '# Build progress\n\n' > docs/progress.md
grep -q '^logs/' .gitignore 2>/dev/null || echo 'logs/' >> .gitignore

# What each role may do without asking. Builder edits files; reviewer only reads and runs checks.
BUILD_TOOLS='Read,Write,Edit,Glob,Grep,Bash(node *),Bash(npm test*),Bash(npm run *),Bash(python3 *),Bash(git status*),Bash(git diff*),Bash(ls *),Bash(mkdir *)'
REVIEW_TOOLS='Read,Glob,Grep,Bash(node *),Bash(npm test*),Bash(npm run smoke*),Bash(python3 *),Bash(git status*),Bash(git diff*),Bash(ls *)'
VERDICT_SCHEMA='{"type":"object","properties":{"verdict":{"type":"string","enum":["pass","fail"]},"summary":{"type":"string"},"fixes":{"type":"array","items":{"type":"string"}}},"required":["verdict","summary","fixes"]}'

for id in "${IDS[@]}"; do
  if grep -q "^- \[x\] $id " docs/progress.md; then echo "== $id already done, skipping"; continue; fi
  echo "== $id: building with $BUILDER_MODEL"
  claude -p "Build visualisation $id from docs/catalogue.md, following CLAUDE.md and your agent instructions." \
    --agent viz-builder --model "$BUILDER_MODEL" \
    --permission-mode acceptEdits --allowedTools "$BUILD_TOOLS" \
    --output-format json > "logs/$id-build-1.json" || true
  session=$(jq -r '.session_id // empty' "logs/$id-build-1.json")
  [ -n "$session" ] || { echo "builder run failed, see logs/$id-build-1.json"; exit 1; }

  passed=false
  for round in $(seq 1 "$MAX_ROUNDS"); do
    echo "== $id: review round $round with $REVIEWER_MODEL"
    claude -p "Review visualisation $id, which was just built (uncommitted changes in this repo). Follow your agent instructions and return the verdict." \
      --agent viz-reviewer --model "$REVIEWER_MODEL" \
      --permission-mode dontAsk --allowedTools "$REVIEW_TOOLS" \
      --output-format json --json-schema "$VERDICT_SCHEMA" > "logs/$id-review-$round.json" || true
    verdict=$(jq -r '.structured_output.verdict // "fail"' "logs/$id-review-$round.json")
    summary=$(jq -r '.structured_output.summary // "reviewer returned no verdict"' "logs/$id-review-$round.json")
    echo "   verdict: $verdict · $summary"
    if [ "$verdict" = "pass" ]; then passed=true; break; fi
    [ "$round" -lt "$MAX_ROUNDS" ] || break
    fixes=$(jq -r '(.structured_output.fixes // ["The reviewer could not finish. Run npm test and npm run smoke and fix what fails."]) | to_entries | map("\(.key + 1). \(.value)") | join("\n")' "logs/$id-review-$round.json")
    echo "== $id: fixing (round $round)"
    claude -p "The reviewer rejected visualisation $id. Fix every item, re-run npm test and npm run smoke -- $id, update docs/reports/$id.md, then list what you changed per item.

$fixes" \
      --resume "$session" --model "$BUILDER_MODEL" \
      --permission-mode acceptEdits --allowedTools "$BUILD_TOOLS" \
      --output-format json > "logs/$id-build-$((round + 1)).json" || true
  done

  if $passed; then
    echo "- [x] $id (review rounds: $round), $summary" >> docs/progress.md
    git add -A && git commit -q -m "viz $id (built by $BUILDER_MODEL, reviewed by $REVIEWER_MODEL)"
    echo "== $id: committed"
  else
    git stash push -u -q -m "blocked $id"
    echo "- [ ] $id BLOCKED after $MAX_ROUNDS reviews: $summary (work saved in git stash)" >> docs/progress.md
    git add docs/progress.md && git commit -q -m "progress: $id blocked"
    echo "== $id: BLOCKED, work stashed"
  fi
done
echo "Done. See docs/progress.md; costs are in logs/*.json (total_cost_usd)."
