---
description: Build a batch of visualisations in three phases: plan, shared toolkit, then parallel builds in git worktrees.
argument-hint: <catalogue ids, e.g. 1.3 2.1 2.2> [--parallel N]
---

You are the **supervisor** for this batch:
$ARGUMENTS

`--parallel N` sets how many builders run at once in phase 3 (default **2**). Everything else in
the arguments is a catalogue id.

## Your job, and the context rule

You **plan, brief, decide and commit**. You do not read diffs, test output, screenshots or the
course notes — the subagents do that and hand you short summaries. This matters: a batch must not
make your own context grow.

- Never re-read earlier tool output. After each visualisation is committed, write a 3–5 line entry
  to `docs/progress.md` and carry on **from that entry**, not from anything earlier in the session.
- Never paste a diff, a test log or a file into your own notes.
- The detailed review is `viz-reviewer`'s job (Opus — it catches the numerics). It returns
  pass/fail plus at most 8 one-line fixes. Act on that; don't re-derive it.
- Fix anything the reviewer marks `minor:` yourself, in one edit. That is not a round.

Before starting: run `git status` (must be clean, else stop and say so), read `CLAUDE.md` and
`docs/progress.md` (create it if missing), and skip ids already marked `- [x]` there.

---

## Phase 1 — plan (you, cheap)

Read the catalogue entries for the batch in `docs/catalogue.md`. Then list **every toolkit
component, scene element and maths helper the batch needs that does not exist yet.** Check, don't
guess: look at `js/toolkit/ui.js` (the `SV.ui` export list), the scene-format comment at the top of
`js/toolkit/stage2d.js`, the exports at the bottom of `js/math/linalg.js`, and `dev/gallery.html`.

Write `docs/plans/<batch>.md` (batch = the ids joined by `-`, e.g. `1.3-2.1-2.2.md`) containing:

- one section per visualisation: its catalogue entry, the note items it cites (with page and line
  from `docs/la_notes_index.md`), the toolkit parts it will use, and 2–4 risks you foresee;
- a **shared parts** table: each missing part → which visualisations need it;
- each visualisation's manifest entry: `id`, `module` path, `needs`, `source`, `purpose_html`.

Commit it: `git add -A && git commit -m "plan: <batch>"`.

## Phase 2 — toolkit (sequential, one builder)

Delegate to **one** `viz-builder` in **toolkit mode**. Give it the plan file path and the shared
parts table. It builds every missing part in general form — both stages for scene elements, the
scene-format docs, gallery demos, maths in `js/math/` with NumPy cases in `tests/make_fixtures.py`
— plus each visualisation's manifest entry with `status: "placeholder"` and an empty stub file at
each `module` path.

It must finish green on `npm test`, `npm run fixtures` and
`npm run smoke -- 1.1 <other ready ids>`. Then have `viz-reviewer` check it. On pass:
`git add -A && git commit -m "toolkit for <batch>"`. On fail, send the fixes back once; a second
failure stops the batch — say so and stop.

**Never run a toolkit builder and a visualisation builder at the same time.**

## Phase 3 — visualisations (parallel, in worktrees)

Launch `viz-builder` subagents with `isolation: worktree`, **at most N at a time**. One
visualisation each.

Each builder's brief contains everything it needs so it never explores the repo: the catalogue
entry verbatim, the note items with their page and line numbers, the exact toolkit parts to compose
(named), the manifest entry from the plan, and the risks. Tell it which files to read — nothing
else.

Each builder may only create or edit `js/viz/<file>.js`, `tests/viz/<id>.test.js`,
`docs/reports/<id>.md` and the `"status"` field of its own manifest entry. Everything else is
off-limits.

- Claude Code names the worktree branch itself and you cannot look it up, so each builder reports
  `WORKTREE:` and `BRANCH:` as its first two lines and commits on that branch. Record both.
- A builder that needs a toolkit or maths change writes `TOOLKIT REQUEST: …` at the top of its
  report and finishes the rest. Make that change yourself on main (or with a short toolkit-mode
  builder), commit it, then send that builder back to finish.
- Review each finished visualisation with `viz-reviewer` **in its worktree** (tell it the path).
- **Max 2 fix rounds** per visualisation. Still failing after the second: leave it on its branch.

## Merging (you, one at a time)

For each passing branch, in the order they finished:

1. `git merge --no-ff <branch>`.
2. Conflicts in `content/courses.js` are expected — resolve by **keeping both entries**.
3. `npm test` and `npm run smoke -- <every ready id> --no-shots`.
4. If either fails, `git merge --abort` (or reset), mark that visualisation blocked, and move on.
5. Append to `docs/progress.md`: `- [x] <id> <title> (rounds: n), <one-line note>` and commit.
6. Remove the worktree: `git worktree remove <path>`.

Blocked ones: keep the worktree and the branch, append
`- [ ] <id> BLOCKED: <reason> (branch <branch>, worktree <path>)` to `docs/progress.md`, commit
that file, and move on.

## At the end

A table: id · result · rounds · notable decisions · anything I should check myself. Then the
toolkit components the batch added, so I know what is now available, and the branch and worktree of
anything blocked.
