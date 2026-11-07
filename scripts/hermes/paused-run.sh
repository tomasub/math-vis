# Sourced by scripts/hermes/viz-batch.sh: carry a batch across a usage-limit pause (exit code 75).
#
#   source "$(dirname "$0")/paused-run.sh"
#   if b=$(paused_branch); then git checkout -q "$b"; IDS=$(paused_ids); fi    # continue, don't pick new ids
#   scripts/build-all.sh $IDS; rc=$?
#   [ "$rc" -eq 75 ] && { save_paused "$(git branch --show-current)" "$IDS"; exit 0; }
#
# Needs: git with an `origin` remote, jq. Run from the repository root.

PAUSED_REMOTE="${PAUSED_REMOTE:-origin}"

# paused_branch → print the first pushed build/* branch whose tip is a WIP commit and which carries
# logs/PAUSED.json; status 1 if there is none.
paused_branch() {
  local ref b
  git fetch -q "$PAUSED_REMOTE" '+refs/heads/build/*:refs/remotes/'"$PAUSED_REMOTE"'/build/*' 2>/dev/null || true
  for ref in $(git for-each-ref --format='%(refname)' "refs/remotes/$PAUSED_REMOTE/build/"); do
    git log -1 --format=%s "$ref" | grep -q '^WIP .*: paused at usage limit$' || continue
    git cat-file -e "$ref:logs/PAUSED.json" 2>/dev/null || continue
    b="${ref#refs/remotes/$PAUSED_REMOTE/}"
    # local branch that tracks it (create it, or fast-forward an existing one)
    if git rev-parse -q --verify "refs/heads/$b" >/dev/null; then
      git branch -q -f "$b" "$ref" 2>/dev/null || true
    else
      git branch -q --track "$b" "$ref"
    fi
    echo "$b"; return 0
  done
  return 1
}

# paused_ids → the ids the paused run was asked for (space-separated), from logs/PAUSED.json on the
# checked-out branch. Also fetches the viz/<id> branches it pushed, so build-all.sh can recreate the
# worktrees on another machine.
paused_ids() {
  local id
  for id in $(jq -r '[.items[] | select(.id != "toolkit") | .id] | join(" ")' logs/PAUSED.json); do
    git rev-parse -q --verify "refs/heads/viz/$id" >/dev/null ||
      git fetch -q "$PAUSED_REMOTE" "viz/$id:viz/$id" 2>/dev/null || true
  done
  jq -r '.ids | join(" ")' logs/PAUSED.json
}

# save_paused <branch> <ids> → commit everything (logs/PAUSED.json included, although logs/ is
# ignored) as "WIP <ids>: paused at usage limit", push the branch and the paused viz/<id> branches.
# No pull request.
save_paused() {
  local branch="$1" ids="$2" id
  git add -A
  git add -f logs/PAUSED.json
  git commit -q -m "WIP $ids: paused at usage limit"
  git push -q -u "$PAUSED_REMOTE" "$branch"
  for id in $(jq -r '[.items[] | select(.id != "toolkit") | .id] | join(" ")' logs/PAUSED.json); do
    git rev-parse -q --verify "refs/heads/viz/$id" >/dev/null && git push -q -f "$PAUSED_REMOTE" "viz/$id" || true
  done
  echo "Paused at usage limit, partial work on $branch, continues next run"
}
