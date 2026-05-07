---
description: Break a PRD into independently-grabbable GitHub issues using vertical-slice tracer bullets. Use after /create-prd to generate the implementation backlog.
---

# /prd-to-issues

Break the PRD into independently-grabbable issues using vertical slices (tracer bullets). Each issue is a thin slice that cuts through ALL integration layers end-to-end, NOT a horizontal slice of one layer.

## Process

### 1. Read context

Read `docs/PRD.md`, `docs/ARCHITECTURE_RULES.md`, `docs/GLOSSARY.md`, and any ADRs. Briefly explore the current state of the repo.

### 2. Draft vertical slices

Each slice must:
- Cut through schema → API → UI → tests in one coherent piece of work
- Be demoable or verifiable on its own
- Take 30–90 minutes of agent loop time (rough estimate)
- Have clear acceptance criteria

**Forbidden patterns** (these are horizontal — split them):
- "Set up the database" without an API or UI consuming it
- "Build all API endpoints" without UI integration
- "Implement the UI" without working backend
- "Add authentication" as a single slice (split into login flow, registration flow, password reset, etc.)

Slices are tagged HITL or AFK:
- **HITL** — needs human interaction (architectural decision, design review, security review, anything where wrong autonomy is dangerous)
- **AFK** — can be implemented and merged without human interaction
- **Prefer AFK** wherever safe.

### 3. Self-audit

Before showing the breakdown to the user, audit your own list:
- Are any slices horizontal? Mark them and flag.
- Are dependencies a chain (everything blocks the next) or a graph (parallelizable)? Prefer graphs.
- Is each slice small enough to demo in 5 minutes after completion?

### 4. Quiz the user

Present the proposed breakdown as a numbered list. For each slice show:
- Title
- Type (HITL / AFK)
- Blocked by (dependencies on other slices)
- User stories covered
- One-line reason it's vertical

Ask the user:
- Does the granularity feel right? (too coarse / too fine)
- Are dependencies correct?
- Should any slices be merged or split?
- Are HITL/AFK assignments correct?
- Did I miss any slices the audit caught as suspicious?

Iterate until the user approves.

### 5. Publish to GitHub

For each approved slice, create an issue via `gh issue create`. Use the body template below. Apply labels:
- `afk` or `hitl`
- `priority:1`, `priority:2`, or `priority:3`
- `slice`

Publish issues in dependency order (blockers first) so you can reference real issue numbers in the "Blocked by" section.

## Issue body template

```markdown
## What to build
A concise description of this vertical slice. Describe the end-to-end behavior, not layer-by-layer implementation.

## Acceptance criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## User stories covered
- US #N from PRD: <quote>

## Blocked by
- #<num> or "None — can start immediately"
```

## Hard rule

A slice that touches only one layer (schema, OR API, OR UI) is INVALID. Every slice ships behavior end-to-end, even if minimal. If you cannot find a vertical cut, the PRD is wrong — go back to `/update-prd`.
