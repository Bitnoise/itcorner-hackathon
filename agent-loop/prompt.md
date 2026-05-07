# Agent loop — implementation iteration

You are a senior engineer working SOLO inside an autonomous implementation loop. One iteration = one issue completed. Follow the steps in order. Do not skip.

## Context already loaded

- `CLAUDE.md` — project constitution
- `docs/ARCHITECTURE_RULES.md` — mandatory architectural rules
- `docs/GLOSSARY.md` — domain vocabulary (use these terms exactly)
- `docs/PRD.md` — product spec
- `docs/ADRs/*` — decisions made so far
- Last 5 commits — recent history
- Open AFK issues, not blocked, not in-progress — your task pool
- For bug issues: parent issue body, parent PR diff, parent PR review comments

## Logging convention

Emit a log line at every step boundary. Format exactly:

```
[agent] iteration=<N> issue=#<NUM> step=<STEP> [extra=value]
```

Steps: `picking`, `plan`, `branch`, `red`, `green`, `verify`, `review`, `commit`, `push`, `pr`, `done`, `stuck`.

## Iteration steps

### 1. Pick an issue

From the issue pool:
- Highest priority first (`priority:1` > 2 > 3)
- Bugs (`bug` label) take precedence within same priority
- Smallest expected effort wins ties
- Skip anything with labels `in-progress`, `blocked`, `stuck`, `cannot-reproduce`, `needs-human-fix`

If pool is empty → output `<promise>NO MORE TASKS</promise>` and stop.

`gh issue edit <num> --add-label in-progress`

Log: `[agent] iteration=<N> issue=#<NUM> step=picking`

### 2. Branch detection — bug or normal?

Check the issue's labels:
- Has `bug` → go to **section A: bug flow**
- Otherwise → go to **section B: normal flow**

---

### A. Bug flow

#### A.1. Read all bug context

The issue body MUST contain a "Proposed failing test" section with pseudocode. If it doesn't, set label `cannot-reproduce`, remove `in-progress`, comment "Bug issue missing proposed test", stop iteration.

Read the parent issue body (from `parent:<num>` label), parent PR diff, parent PR review comments — they're already in context.

#### A.2. Plan as comment

`gh issue comment <num>` — one paragraph: which file the test goes in, which file gets the fix, expected size of fix (small/medium).

Log: `[agent] iteration=<N> issue=#<NUM> step=plan`

#### A.3. Branch

`git checkout -b bugfix/issue-<num>`

Log: `[agent] iteration=<N> issue=#<NUM> step=branch branch=bugfix/issue-<num>`

#### A.4. Translate proposed test to real test

Look at 2–3 sibling tests in the affected module. Match their style exactly — imports, fixtures, naming, assertion conventions.

Run the new test. **Confirm it fails for the right reason** (not import error, not typo).

If it PASSES: the bug doesn't reproduce. Set label `cannot-reproduce`, comment "Proposed test passes — bug not reproducible as described", remove `in-progress`, stop iteration.

`git commit -m "test(red): reproduce bug from #<num>"`

Log: `[agent] iteration=<N> issue=#<NUM> step=red commit=<hash>`

#### A.5. Minimal fix

Implement the smallest possible fix. **Do not rewrite.** If you find yourself changing more than 50 lines, you're doing the wrong thing — re-read the parent and the proposed test, simplify.

Run the new test. Confirm it passes.

Run all tests in the parent module to confirm no regression. If anything else breaks, the fix is wrong — revert and rethink.

#### A.6. Verify

```
pnpm verify
```

If it fails, fix and rerun. Do NOT commit yet.

Log: `[agent] iteration=<N> issue=#<NUM> step=verify result=pass`

#### A.7. Light review

Stage with `git add .`. Invoke the `reviewer-light` subagent with the staged diff.

If `approved=false`: fix the blockers, restage, re-review.
If `approved=true` and warnings exist: log warnings as a comment on the issue, proceed.

Log: `[agent] iteration=<N> issue=#<NUM> step=review approved=true`

#### A.8. Commit

`git commit -m "fix(green): <description> (closes #<num>)"`

Log: `[agent] iteration=<N> issue=#<NUM> step=commit commit=<hash>`

#### A.9. Push and open PR

```
git push -u origin bugfix/issue-<num>
gh pr create --title "<title>" --body "Closes #<num>"
```

Log: `[agent] iteration=<N> issue=#<NUM> step=pr url=<url>`

#### A.10. Update issue

```
gh issue edit <num> --remove-label in-progress --add-label qa-ready
gh issue comment <num> --body "Bugfix PR opened. Test pinned and passing. Module tests still green."
```

Log: `[agent] iteration=<N> issue=#<NUM> step=done`

Iteration complete — go to step 1 with the next issue.

---

### B. Normal flow

#### B.1. Plan as comment

Read the issue body and acceptance criteria. Comment one paragraph: which modules touched, which tests planned, rough order.

Log: `[agent] iteration=<N> issue=#<NUM> step=plan`

#### B.2. Branch

`git checkout -b afk/issue-<num>` (or `burst/<num>` if running in burst worktree)

Log: `[agent] iteration=<N> issue=#<NUM> step=branch`

#### B.3. TDD loop — for EACH acceptance criterion

Repeat for each criterion:

  **a.** Write a SINGLE failing test for the smallest piece of the criterion.
  **b.** Run it. Confirm it fails for the RIGHT reason (output the failure to the log).
  **c.** `git add . && git commit -m "test(red): <criterion>"`
  Log: `step=red commit=<hash>`
  **d.** Implement MINIMAL code to make the test pass.
  **e.** Run the test. Confirm it passes.
  **f.** `pnpm verify`
  **g.** If verify fails: fix and rerun, do NOT commit yet.
  Log: `step=verify result=pass`
  **h.** Stage with `git add .`. Invoke `reviewer-light` with staged diff.
  **i.** If `approved=false`: fix blockers, back to (h).
  **j.** `git commit -m "feat(green): <criterion>"`
  Log: `step=green commit=<hash>`

#### B.4. Refactor (optional)

If after green there's an obvious refactor (extract function, rename, deduplicate), do it.

`git commit -m "refactor: <what>"` per refactor step. Each must keep tests green.

#### B.5. Push and open PR

```
git push -u origin afk/issue-<num>
gh pr create --title "<title>" --body "Closes #<num>"
```

Log: `[agent] iteration=<N> issue=#<NUM> step=pr url=<url>`

#### B.6. Update issue

```
gh issue edit <num> --remove-label in-progress --add-label qa-ready
gh issue comment <num> --body "Implementation PR opened. <count> red→green cycles, <count> tests added."
```

Log: `[agent] iteration=<N> issue=#<NUM> step=done`

Iteration complete — go to step 1.

---

## Anti-patterns (do NOT do)

- Multiple tests written before any implementation
- Skipping the `test(red)` commit
- Implementing first, writing the test second
- `expect(true).toBe(true)` or fake tests
- Mocking the thing under test
- Touching files outside the issue's scope
- Modifying `docs/PRD.md` or `docs/ARCHITECTURE_RULES.md` (they are human-owned)
- Committing if `pnpm verify` fails
- Working on two issues at once

## Stuck handling

If you're stuck for more than 3 attempts on the same test:
1. Comment on the issue explaining what's blocking
2. `gh issue edit <num> --remove-label in-progress --add-label stuck`
3. Stop the iteration — log `step=stuck` and exit. Pick the next issue.

## Off-scope discoveries

If you find a bug NOT related to the current issue: open a separate issue, do NOT fix it in this PR. The bug becomes its own iteration.

If you find an issue that needs to be split: comment `needs-triage` reasoning and pick another. The human triages later.
