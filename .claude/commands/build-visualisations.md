---
description: Supervise building visualisations one at a time. The viz-builder subagent builds each one; you review, send fixes back and commit.
argument-hint: <catalogue ids in order, e.g. 1.2 1.3 2.1 2.2 2.3 3.1 3.2 3.3>
---

You are the **supervisor**. The `viz-builder` subagent (Sonnet) does the building. You plan, review,
send fixes back and commit. Work through these visualisations **one at a time, in this order**:
$ARGUMENTS

Before starting:

- Run `git status`. The tree must be clean; if it isn't, stop and tell me.
- Read `CLAUDE.md`, `docs/progress.md` (create it if it's missing) and the catalogue entries for
  all the ids.
- Skip ids that `docs/progress.md` already marks as done.

## For each id

1. **Brief.**
   - Delegate to the `viz-builder` subagent with a short brief: the id, its catalogue entry
     verbatim, and the 2–4 risks you foresee for this one. Examples of risks: a toolkit element
     it will need, a numerical edge case, an ambiguity in the catalogue.
   - Never run two builders at once. They share the toolkit.
2. **Review independently when it returns. Don't trust its summary.**
   - Run `npm test` and `npm run smoke -- <id>`. Open every screenshot listed and look at it.
   - Read the full diff (`git diff`, `git status` for new files).
   - Check the catalogue entry bullet by bullet and CLAUDE.md's definition of done item by item.
   - Spot-check the numbers. Pick 2–3 states (including one edge case), compute the expected
     values with `python3 -c` and NumPy, and compare them with the model's output by running it
     in `node -e`.
   - Check the explanation text, notation and numbering against the notes PDF pages.
   - Check that toolkit changes are general, documented and shown in the gallery, and that 1.1
     and earlier visualisations still pass `npm run smoke`.
3. **Send fixes back if anything is wrong.**
   - Use SendMessage to the **same** builder (its agent ID), with a numbered list of concrete
     fixes.
   - Repeat the review after each round, up to **3 rounds**.
   - Fix trivial things yourself (a typo, a label) rather than spending a round on them.
4. **Pass.**
   - Append to `docs/progress.md`: `- [x] <id> <title> (rounds: n), <one-line note>`.
   - Commit with `git add -A && git commit -m "viz <id>: <title>"`.
5. **Fail after 3 rounds.**
   - Run `git stash push -u -m "blocked <id>"`.
   - Append `- [ ] <id> BLOCKED: <reason>` to `docs/progress.md` and commit that file.
   - Move on.

## At the end

Give me a table: id · result · rounds · notable decisions · anything I should check myself.
Also list toolkit components that were added, so I know what's now available.
