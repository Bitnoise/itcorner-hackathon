# Architecture Rules

## Clean Architecture (Layered)

```
apps/api/src/
  routes/        — Hono route handlers (HTTP in/out only)
  use-cases/     — business logic, orchestrate domain + infrastructure
  domain/        — pure domain models and interfaces
  infrastructure/ — DB (Drizzle), external APIs, adapters
```

- Routes call use cases. Use cases call domain + infrastructure. Nothing skips a layer.
- Hono has no built-in DI — use factory functions to wire dependencies manually.
- No circular imports between layers. Domain has zero infrastructure dependencies.

## Frontend (apps/web)

```
apps/web/src/
  routes/        — TanStack Router file-based route definitions
  features/      — co-located feature folders (components, hooks, queries)
  components/    — shared, reusable UI components
  lib/           — utilities, helpers, shared logic
```

- Feature folders own their queries (TanStack Query), components, and local state.
- Shared components in `components/` must be domain-agnostic.

## Contracts (packages/contracts)

- All API contracts are defined as Zod schemas + ts-rest router in `packages/contracts`.
- Both `apps/api` and `apps/web` import from contracts — never define types inline.
- No codegen. The contract is the source of truth.

## Code style conventions

- **No class components** — React function components only.
- **async/await** over `.then()/.catch()` chains everywhere.
- **No barrel files** (`index.ts` re-exporting everything) — import directly from source.
- Prefer named exports over default exports.
- File names: `kebab-case.ts`, React components: `PascalCase.tsx`.
- Co-locate tests with source: `foo.ts` → `foo.test.ts` in the same directory.

## Testing rules

- Unit/integration tests: Vitest, co-located at `src/**/*.test.ts`.
- E2E tests: Playwright, in `test/e2e/`.
- No mocking the database in integration tests — use a real test database.
- TDD red→green→refactor. Commits must follow the pattern enforced by `tdd-pattern-check`.

## Banned patterns

- No class-based React components.
- No `any` type — use `unknown` and narrow, or define a proper type.
- No `console.log` in committed code — use a structured logger.
- No synchronous file I/O in request handlers.
- No direct `fetch` calls in components — go through TanStack Query + contracts.
