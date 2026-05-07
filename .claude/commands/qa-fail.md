---
description: Convert a failed QA observation into a structured bug issue with a proposed failing test. Use when QA finds a defect in a merged PR or in an open qa-ready PR.
---

# /qa-fail

QA found a problem. Don't fix it inline. Create a bug issue with a proposed failing test so the agent loop can pick it up automatically with priority 1.

Argument: parent issue number (the issue whose merge introduced the bug).

## Process

### 1. Read parent context

Run `gh issue view <parent-num>` and read the body, comments, acceptance criteria, and the linked PR diff via `gh pr view --comments`. This is essential for the loop to fix it correctly later.

### 2. Grill the user

Ask ONE question at a time, in this order, until each is concrete:

- "What did you do? (exact reproduction steps)"
- "What did you observe?"
- "What did you expect to see, based on the parent issue's acceptance criteria?"
- "Which layer is the problem in — UI, API, schema, integration, build/CI?"
- "Is this a regression (used to work) or did it never work?"
- "How many distinct problems did you find? If more than one, we'll create separate bug issues."

If the user found multiple problems, repeat the rest of the process per problem.

### 3. Generate proposed failing test

Read existing tests in the affected module to understand the testing convention (file naming, imports, fixtures, assertion style). Look at 2–3 sibling tests.

Then generate a test in the same style as pseudocode. For example:

```ts
// In: apps/api/src/grocery/grocery.controller.test.ts
describe('PATCH /grocery/:id', () => {
  it('returns 404 when item does not exist', async () => {
    const res = await app.request('/grocery/nonexistent-id', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'eggs' }),
    });
    expect(res.status).toBe(404);
  });
});
```

The test should:
- Fail today (the bug exists, so this test will fail)
- Pass after the fix (the test pins the expected behavior)
- Be minimal — one assertion ideally

Show the proposed test to the user. Ask: **"If this test existed and passed, would the bug be fixed?"**

If the user says no — refine the test. Iterate.

### 4. Create the bug issue

```bash
gh issue create \
  --title "Bug: <feature> — <symptom>" \
  --label "afk,bug,priority:1,parent:<parent-num>" \
  --body "$(cat <<'EOF'
## Reproduction steps
<from grilling>

## Expected vs Actual
**Expected:** <from grilling>
**Actual:** <from grilling>

## Suspected layer
<UI / API / schema / integration>

## Regression?
<yes — used to work / no — never worked>

## Proposed failing test
<the pseudocode>

## Parent
Parent issue: #<parent-num>
EOF
)"
```

### 5. Comment on parent issue

```bash
gh issue comment <parent-num> --body "QA failed — bug tracked in #<bug-num>"
gh issue edit <parent-num> --add-label qa-failed
```

The parent stays **closed**. We don't reopen it.

### 6. Tell the user

Confirm the bug issue number and its priority. Tell them the agent loop will pick it up next iteration (it has `priority:1`).

## Escalation

If you discover that the parent issue itself has a `bug` label (this is a bug-of-a-bug):
- Walk the `parent:` chain to find the original parent
- If the chain depth is 3 or more, set `--add-label needs-human-fix` instead of `afk`
- Tell the user: "This is the third level of bug-of-bug. Pattern suggests deep design issue. Recommend human fix or revisit parent design."
