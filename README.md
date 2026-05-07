# MedBridge

Doctor / patient prototype built on a pnpm monorepo. See `docs/PRD.md` for the
product spec and `docs/ARCHITECTURE_RULES.md` for the architecture rules.

## Stack

- pnpm workspaces
- API: [Hono](https://hono.dev) on Node 22
- Web: React 18 + Vite 5 + TanStack Router/Query + Tailwind 3
- Contracts: [ts-rest](https://ts-rest.com) + Zod (typed end-to-end, no codegen)
- Database: PostgreSQL 16 via `docker-compose`, accessed through Drizzle ORM
- Tests: Vitest (unit/integration) and Playwright (e2e)

## First-run setup

```bash
nvm use                # picks up .nvmrc → Node 22
cp .env.example .env   # database url, jwt secret (≥ 32 chars), ports
pnpm install
pnpm db:push           # applies the Drizzle schema (no-op for the kickoff slice)
pnpm dev               # boots Postgres + API + web in parallel
```

The web app is at <http://localhost:5173> and the API at <http://localhost:3001>.
Visiting `/` should render `API: ok`.

## Useful commands

| Command           | What it does                                                      |
| ----------------- | ----------------------------------------------------------------- |
| `pnpm dev`        | Brings up the full local stack (Postgres + API + web)             |
| `pnpm test`       | Runs Vitest across the API and contracts workspaces               |
| `pnpm test:e2e`   | Runs Playwright; boots dev servers automatically                  |
| `pnpm typecheck`  | `tsc --noEmit` in every workspace                                 |
| `pnpm lint`       | ESLint flat config across the repo                                |
| `pnpm verify`     | typecheck + test + lint (the agent-loop feedback signal)          |
| `pnpm db:push`    | Applies the Drizzle schema to the local database                  |
| `pnpm db:studio`  | Opens Drizzle Studio against the local database                   |

## Layout

```
apps/api          Hono backend, Drizzle ORM, Vitest tests
apps/web          React + Vite frontend, TanStack Router + Query
packages/contracts ts-rest + Zod contracts (single source of truth)
test/e2e          Playwright end-to-end specs
docs              PRD, glossary, architecture rules, ADRs
```
