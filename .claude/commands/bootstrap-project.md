---
description: Configure the project's tech stack, conventions, and team-specific rules before phase 1. Run this ONCE per project, immediately after cloning the boilerplate, before /ideation. Use when CLAUDE.md still contains placeholder text like "[Update with concrete versions during /create-prd]".
---

# /bootstrap-project

Phase 0 — project bootstrap. Fill in the toolchain and team conventions in `CLAUDE.md` and `docs/ARCHITECTURE_RULES.md`, then commit. This is **separate from `/ideation`** because tech stack and team conventions are decided by the team, not by the business.

## When to run

- Once per project, immediately after cloning the boilerplate
- Before `/ideation`
- Only if `CLAUDE.md` still contains the placeholder text `[Update with concrete versions during /create-prd]` or similar

If `CLAUDE.md` is already configured (no placeholders), tell the user "Project is already bootstrapped" and exit.

## Process

### 1. Detect placeholders

Read `CLAUDE.md` and `docs/ARCHITECTURE_RULES.md`. Find any text in square brackets like `[Update with...]`, `(to be filled...)`, or sections explicitly marked as placeholder.

### 2. Grill the user — toolchain

Ask ONE question at a time. Provide a recommended answer for each. Cover:

**Backend framework**
- "Backend framework? Recommended: NestJS (mature, opinionated). Alternatives: Hono (lightweight, edge-friendly), Express (familiar, mature), Fastify (performance)."

**Database + ORM**
- "Database? Recommended: PostgreSQL (default). Alternatives: SQLite (simpler), MySQL."
- "ORM / query builder? Recommended: Drizzle (TypeScript-first, lightweight). Alternatives: Prisma (richer, heavier), raw SQL with a thin wrapper."

**Frontend stack**
- "Frontend framework? Recommended: React + Vite. Alternatives: SolidJS, Vue, none (API-only project)."
- "Server state? Recommended: TanStack Query."
- "Routing? Recommended: TanStack Router (typed). Alternatives: React Router (familiar)."
- "Styling? Recommended: Tailwind CSS. Alternatives: vanilla CSS, CSS modules, styled-components."

**Contracts**
- "Shared types and validation between API and web? Recommended: Zod + ts-rest (typed end-to-end). Alternatives: OpenAPI + orval, hand-rolled types."

**Testing**
- "Unit/integration test runner? Recommended: Vitest (fast, modern)."
- "E2E? Recommended: Playwright. Alternatives: Cypress, none for hackathon scope."

**Local dev environment**
- "Database in dev — Docker Compose locally? Recommended: yes. Alternative: external (Supabase, Neon)."

**Versions**
- For each chosen tool, ask "Pin to a specific major version, or just use latest?" Recommendation: pin major versions in package.json (e.g. `^4.0.0`) so the agent loop has stable reference points.

### 3. Grill the user — team conventions

Ask about anything project- or team-specific that's not in the default `ARCHITECTURE_RULES.md`. Examples:

- "Any libraries or patterns the team has banned or strongly prefers? (e.g. 'no class components, only function components')"
- "Branch naming convention different from the default `afk/issue-<num>`?"
- "Any specific layer-naming convention (use case names, repository naming pattern)?"
- "Code style preferences not covered by Prettier defaults?"

Skip these questions if the user has nothing to add — the defaults in `ARCHITECTURE_RULES.md` are already good.

### 4. Update `CLAUDE.md`

Replace the placeholder Stack section with concrete values from the answers. Format:

```markdown
## Stack

- pnpm monorepo (workspaces in `pnpm-workspace.yaml`)
- **Backend:** apps/api — <framework> <version>
- **Database:** <db> with <orm>
- **Frontend:** apps/web — React 18 + Vite, <state>, <routing>, <styling>
- **Contracts:** packages/contracts — <approach>
- **Tests:** <unit-runner> (unit), <e2e-tool> (e2e)
- **Dev environment:** <docker-compose | external>
```

Update `## Critical commands` if any of the chosen tools require different invocations (e.g. Drizzle uses `pnpm db:push` instead of Prisma's `pnpm prisma migrate dev`).

### 5. Update `docs/ARCHITECTURE_RULES.md`

Add any team-specific rules to the appropriate section. Keep additions minimal — the defaults are good for most projects.

If the team chose Hono over NestJS, the Clean Architecture section needs a small adjustment (Hono doesn't have built-in DI like NestJS — note that the team handles DI manually with factory functions).

### 6. Update `apps/README.md`

Replace the generic "applications will appear here" text with the concrete app names that the team will end up creating. Example:

```markdown
# apps/

This directory will hold:
- `apps/api/` — Hono backend with Drizzle and Postgres
- `apps/web/` — React + Vite + TanStack Query frontend

Do NOT scaffold these manually. The agent loop creates them during phase 4 based on the PRD.
```

### 7. Commit

```bash
git add CLAUDE.md docs/ARCHITECTURE_RULES.md apps/README.md
git commit -m "chore: bootstrap project — <brief summary like 'Hono + React + Drizzle stack'>"
```

### 8. Tell the user

Confirm what was set, then say:

> "Bootstrap complete. Stack and conventions are pinned. Next step is `/ideation` to capture the business requirements."

## Rules

- Do NOT ask about domain, entities, or features — those belong to `/ideation` and `/create-prd`.
- Do NOT modify `docs/GLOSSARY.md` — domain vocabulary is filled in by `/create-prd`.
- Do NOT touch `docs/PRD.md`.
- Do NOT install dependencies or run `pnpm install` — that happens after the agent loop creates the apps.
- If the user is uncertain on a choice, give your recommendation and proceed. Don't get stuck on indecision — these can be revisited via `/update-rules` or manually later.
