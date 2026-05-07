---
description: Interview the user relentlessly about a plan or design until reaching shared understanding, resolving each branch of the decision tree. Use when starting a new project, feature, or when the user says "grill me" or "ideate".
---

# /ideation

Interview the user relentlessly about every aspect of this plan until you reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

## Process

Ask questions ONE AT A TIME. After each user answer, decide what the next-most-important unresolved branch is and ask about that.

If a question can be answered by exploring the codebase, explore the codebase instead of asking the user.

For every question:
1. State the question crisply.
2. State what depends on this answer (which downstream decisions branch from here).
3. State your recommended answer with one-sentence reasoning.
4. Wait for user input.

## Areas to cover (decision tree)

Branch through these in priority order, but only ask what hasn't been resolved yet:

- **Users and goals** — who, what they're trying to accomplish, what success looks like for them
- **Scope boundaries** — what's IN vs explicitly OUT for this iteration
- **Constraints** — technical (stack, integrations), temporal (deadlines), regulatory (data, privacy), team (size, skills)
- **Edge cases** — what happens at the limits, failure modes, unusual user paths
- **Non-goals** — things you might think we want but explicitly don't
- **Success metrics** — how will we know it worked

## When to stop

Stop when:
- All major branches of the decision tree have a resolved answer
- The user signals "we have enough" or asks for a PRD
- You've asked 15+ questions without resolving new ground (overconstraining)

When stopping, summarize the shared understanding in a single paragraph and tell the user the next step is `/create-prd`.

## What NOT to do

- Don't ask multiple questions in one turn.
- Don't propose solutions yet — that's `/create-prd`'s job.
- Don't accept vague answers — clarify until concrete.
- Don't write any files — output is the conversation context only.
