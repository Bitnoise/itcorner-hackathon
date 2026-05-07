---
description: Turn the current conversation context into a PRD and write it to docs/PRD.md. Use after /ideation when shared understanding has been reached.
---

# /create-prd

Take the current conversation context and codebase understanding and produce a PRD. Do NOT interview the user — synthesize what you already know.

## Process

1. **Explore the repo** to understand the current state of the codebase (if not already done in this session). Use the project's domain glossary (`docs/GLOSSARY.md`) consistently throughout the PRD. Respect any ADRs in `docs/ADRs/`.

2. **Sketch out the major modules** you will need to build or modify to complete the implementation. Actively look for opportunities to extract deep modules that can be tested in isolation.
   > A deep module (vs a shallow module) is one which encapsulates a lot of functionality in a simple, testable interface which rarely changes.

3. **Write the PRD** using the template below to `docs/PRD.md`. Overwrite the placeholder content that's there.

4. **Update `docs/GLOSSARY.md`** with the canonical domain terms used in the PRD. This is the vocabulary the agent loop will use throughout implementation.

5. **Commit** the result with `docs: add PRD and glossary`.

6. **Tell the user** the next step is `/prd-to-issues`.

## PRD template

```markdown
# Product Requirements

## Problem Statement
The problem the user is facing, from the user's perspective.

## Solution
The solution to the problem, from the user's perspective.

## User Stories
A long, numbered list of user stories. Each in the format:
"As a <role>, I want <capability>, so that <outcome>"

1. As a <role>, I want <capability>, so that <outcome>
2. ...

This list should be extensive and cover all aspects of the feature.

## Implementation Decisions
- Modules to be built/modified
- Module interfaces (high-level, not file paths)
- Technical clarifications from the user
- Architectural decisions
- Schema changes
- API contracts
- Specific interactions

Do NOT include specific file paths or code snippets — they go stale fast.

## Testing Decisions
- What makes a good test (test external behavior, not implementation)
- Which modules will have tests
- Prior art in the codebase (similar test types)

## Out of Scope
What we explicitly are not doing.

## Further Notes
Anything else worth recording.
```

## Rules

- Do NOT ask the user questions. The job of asking was done in `/ideation`.
- Use vocabulary from `docs/GLOSSARY.md` consistently. If a term needs to be added, add it.
- Do NOT include code snippets or specific file paths.
- Keep user stories concrete and testable.
