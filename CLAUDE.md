# Project — Agentic SDLC

> This file is the project's constitution. It is read by Claude Code at the start of every session and by the agent loop on every iteration. Keep it under 500 lines.

## Stack

- pnpm monorepo (workspaces in `pnpm-workspace.yaml`)
- **Backend:** `apps/api` — Hono `^4` on Node.js
- **Database:** PostgreSQL `16` (docker-compose) with Drizzle ORM `^0.36`
- **Frontend:** `apps/web` — React `^18` + Vite `^5`, TanStack Query `^5`, TanStack Router `^1`, Tailwind CSS `^3`
- **Contracts:** `packages/contracts` — Zod `^3` + ts-rest `^3` (typed end-to-end, no codegen)
- **Tests:** Vitest `^2` (unit/integration, co-located `src/**/*.test.ts`), Playwright `^1.48` (e2e, `test/e2e/`)
- **Dev environment:** docker-compose for local Postgres; `pnpm dev` brings everything up

Major versions are pinned in `package.json` (e.g. `^4.0.0`) so the agent loop has stable reference points while still receiving minor/patch updates.

## Critical commands

- `pnpm dev` — start everything locally (docker-compose Postgres + api + web)
- `pnpm test` — run all tests (Vitest)
- `pnpm test:e2e` — run Playwright e2e suite
- `pnpm typecheck` — types across the monorepo
- `pnpm lint` — eslint
- `pnpm db:push` — apply Drizzle schema to the local database
- `pnpm db:studio` — open Drizzle Studio against the local database
- `pnpm verify` — typecheck + test + lint (the full feedback loop run by the agent before every commit)

## Workflow constitution

- We work in TDD red→green→refactor. Always.
- We work in vertical slices (tracer bullets). NEVER horizontal.
- Branch per issue: `afk/issue-<num>` or `burst/<num>` or `bugfix/issue-<num>`.
- Commit format: `test(red): ...`, `feat(green): ...`, `fix(green): ...`, `refactor: ...`, `docs: ...`, `chore(manual): ...`.
- One PR per issue. PR links the issue with "Closes #<num>".
- The `tdd-pattern-check` hook will block commits that violate the red→green pattern.

## Where the rules live

- Architecture rules → `docs/ARCHITECTURE_RULES.md`
- Domain glossary → `docs/GLOSSARY.md`
- Decisions → `docs/ADRs/`
- Product spec → `docs/PRD.md`

## Boundaries (hard rules for the agent)

- NEVER modify `docs/PRD.md` without an explicit `/update-prd` command from a human.
- NEVER modify `docs/ARCHITECTURE_RULES.md` without an explicit human request.
- NEVER modify anything under `agent-loop/` — that directory is the loop's own scaffolding (scripts, state, logs, prompt). Touching it from inside an iteration risks corrupting the running loop. If a change is needed, surface it to the human and stop.
- NEVER skip TDD steps — the `tdd-pattern-check` hook will block you.
- Tests live in `src/**/*.test.ts` (co-located) for unit tests; `test/e2e/` for e2e.
- If you find a bug not related to your current issue, open a new issue with `/qa-fail`. Do NOT fix it inline.
- If you're stuck for more than 3 attempts on the same test, set the issue to label `stuck` and stop the iteration.

## Phase awareness

The agent loop operates in **phase 4** (implementation). Phases 1–3 (ideation, PRD, issues) are human-driven. Phase 5 (QA + close) is human-driven. The agent does not run skills like `/ideation` or `/create-prd` autonomously.
