# Product Requirements — MedBridge Kickoff (jwt-login-rbac)

## Problem Statement

A doctor or patient sitting down to demo MedBridge for the first time has no way to identify themselves to the system. There is no monorepo, no database, no authentication, and no UI; the role-aware features described across Modules 01–05 cannot be reached because nothing knows who is asking. Every downstream module (Patient Profile, Documents, Doctor Profile/Slots, Appointments, Visit Summary) presumes a logged-in user with a known role and a stable user id, and presumes the surrounding plumbing — pnpm workspaces, Hono API, React app, ts-rest contracts, Postgres + Drizzle, the `pnpm dev` / `pnpm verify` command surface — already exists. Until that scaffolding and a working email-and-password login flow are in place, no feature work in this prototype can begin.

## Solution

Ship the **shared kickoff** as a single vertical slice: scaffold the pnpm monorepo, stand up Postgres + Drizzle, publish the empty ts-rest contract package, and deliver email-and-password authentication end-to-end. A user opens the web app, lands on a login page, authenticates with one of the seeded accounts using their email and password, and arrives on a role-appropriate dashboard at `/patient` or `/doctor` showing a placeholder "Upcoming appointments" section. The API issues a 24-hour HS256 JWT that the web app stores in `localStorage` and attaches as `Authorization: Bearer <token>` to every protected request. A pair of reusable middlewares — `requireAuth()` and `requireRole([...])` — guard server routes by role; the same role from `GET /auth/me` drives client-side route guards in TanStack Router. Logging out clears the token and the cached `currentUser` query; the user is sent back to the login page. Downstream feature modules consume this surface without re-building any of it.

## User Stories

1. As a doctor, I want to open the web app and see a login page so that I have a clear entry point to MedBridge.
2. As a patient, I want to log in with my email and password so that I can access my own data.
3. As a doctor, I want to log in with my email and password so that I can access my schedule and patient information.
4. As a returning patient, I want my session to survive a page refresh so that I am not forced to re-authenticate every time I reload the dashboard.
5. As a returning doctor, I want my session to survive a page refresh so that I can keep working through a single demo run without interruption.
6. As a patient who lands on the patient dashboard, I want to see a placeholder "Upcoming appointments" section so that I understand where my appointments will appear once Module 04 is in place.
7. As a doctor who lands on the doctor dashboard, I want to see a placeholder "Upcoming appointments" section so that I understand where my schedule will appear once Module 04 is in place.
8. As a logged-in user, I want a visible logout control so that I can end my session and switch accounts during the demo.
9. As a user who clicks "Log out", I want my token cleared and the app to send me to the login page so that no further authenticated calls succeed from my browser.
10. As a patient who tries to open a doctor-only URL, I want to be denied and informed so that the role boundary is obvious.
11. As a doctor who tries to open a patient-only URL, I want to be denied and informed so that the role boundary is obvious.
12. As an unauthenticated visitor, I want to be redirected to the login page when I hit any protected URL so that I cannot bypass authentication by typing a route directly.
13. As a user submitting wrong credentials, I want to see a single neutral error message so that the system does not leak which field was wrong.
14. As a user submitting a non-existent email, I want to see the same neutral error message as for a wrong password so that account existence is not enumerable.
15. As a user submitting a malformed email or empty password, I want to see a clear validation message so that I can correct my input.
16. As a developer cloning the repo, I want a single `pnpm dev` command to bring up Postgres, the API, and the web app so that onboarding is friction-free.
17. As a developer cloning the repo, I want a `pnpm db:push` command to apply the schema and a `pnpm db:seed` command to populate the seeded accounts so that I have working logins after a fresh clone.
18. As a developer running `pnpm verify`, I want typecheck, tests, and lint to all run so that the agent loop has a single feedback signal before each commit.
19. As a developer running `pnpm dev` for the first time, I want a documented `JWT_SECRET` available via `.env.example` so that the API actually starts on a clean machine.
20. As a developer working on a downstream module, I want to import a typed `currentUser` and a typed login/me contract from `packages/contracts` so that I do not redefine auth types module-by-module.
21. As a developer writing a protected route in `apps/api`, I want a `requireRole(['doctor'])` (or `['patient']`) helper so that role enforcement is one line and consistent.
22. As a developer writing a protected page in `apps/web`, I want a route-guard primitive that reads from the `['auth', 'me']` query so that role enforcement on the client mirrors the server.
23. As a developer reading server logs, I want every authentication outcome (success, invalid credentials, expired token, role denial, DB error) to emit a structured log entry with event name, user id when known, role, and request id so that I can debug auth flows from logs alone.
24. As a developer reading server logs, I want plaintext passwords and full JWTs to never appear in any log entry so that the logs are safe to share.
25. As a security-aware developer, I want the API process to refuse to boot when `JWT_SECRET` is missing or shorter than 32 characters so that we cannot accidentally run with a weak secret.
26. As a security-aware developer, I want stored passwords to be bcrypt hashes with cost factor 12 so that the seed data is not a plaintext credential dump in the database.
27. As a security-aware developer, I want a tampered or expired JWT to be rejected with a clear status code so that the boundary is unambiguous.
28. As a security-aware developer, I want a JWT carrying a role outside `'doctor' | 'patient'` to be rejected by the role guard regardless of route configuration so that bad tokens cannot escalate.
29. As a security-aware developer, I want a JWT whose subject no longer exists in the `users` table to be rejected so that orphaned tokens cannot continue to act on a deleted account.
30. As QA running an end-to-end smoke test, I want a deterministic `pnpm db:seed` to produce the same accounts every run so that Playwright tests can hard-code login credentials.
31. As QA running an end-to-end smoke test, I want a public `/health` endpoint that returns 200 without authentication so that I can sanity-check the API is up before driving the UI.

## Implementation Decisions

### Modules to build

- **Monorepo scaffolding** — pnpm workspaces with three packages: `apps/api`, `apps/web`, `packages/contracts`. Root scripts (`dev`, `test`, `test:e2e`, `typecheck`, `lint`, `db:push`, `db:studio`, `verify`) fan out to the workspaces.
- **Local infrastructure** — a `docker-compose.yml` at the repo root running Postgres 16 with a stable port, a named volume, and a healthcheck. `pnpm dev` brings the database up before starting the API and web servers.
- **Environment bootstrap** — `.env.example` checked in with a documented dev `JWT_SECRET` (≥ 32 chars), `DATABASE_URL`, and any port/host vars. `.env` is gitignored. README explains the `cp .env.example .env` step.
- **Database — `users` table** — a deep, isolated module owning the `users` table and a `user_role` enum (`'doctor' | 'patient'`). Columns: `id` (UUID PK, generated), `email` (text, unique on lower-case), `password_hash` (text), `role` (enum), `created_at`, `updated_at`. Drizzle schema lives in `apps/api`, applied via `pnpm db:push`.
- **Database — role-specific identity rows** — minimal `patients` and `doctors` tables with only `(user_id PK FK → users.id)` plus `first_name`, `last_name`, and timestamps. Modules 01 and 03 will add their domain columns; this slice creates the rows so seeded accounts have a profile from day one.
- **Seed module** — `apps/api/scripts/seed.ts`, runnable via `pnpm db:seed`, that reads `data/seed-accounts.json`, regenerates emails (one per account in the form `firstname.lastname@medbridge.local`), bcrypts each password with cost factor 12, and upserts a `users` row plus the matching `patients` or `doctors` row. The plaintext JSON stays committed as a human-readable demo cheat sheet.
- **Auth domain** — a deep, framework-agnostic core covering: password verification (bcrypt compare), JWT signing/verification (HS256, 24h `exp`, claims `sub` + `role` + `iat` + `exp`), and a `currentUser` resolver that takes a verified token and returns `{ id, role }` after confirming the user still exists. This is the load-bearing module the rest of the app composes against.
- **Auth infrastructure** — Drizzle-backed user lookup by lower-cased email, used by login and by the `currentUser` resolver. No business logic.
- **Auth use cases** — `login(email, password)` returning a signed JWT or a typed failure; `getCurrentUser(token)` returning `{ id, email, role }` or a typed failure. These use cases compose domain + infrastructure and are the units that route handlers call.
- **Auth HTTP layer** — `POST /auth/login` and `GET /auth/me` route handlers that translate use-case results into HTTP responses per the feature spec, plus `requireAuth()` and `requireRole([...])` middlewares that read the `Authorization` header, attach `{ id, role }` to the request context, and short-circuit with the right status codes on every failure mode.
- **Health endpoint** — public `GET /health` returning 200 with a tiny JSON body, exempt from auth. Used by Playwright and developer smoke checks.
- **Structured logger** — a thin wrapper exposing `info`/`warn`/`error` with a fixed shape (`event`, `request_id`, `user_id?`, `role?`, plus arbitrary context). All auth events use named events: `auth.login.success`, `auth.login.failed`, `auth.token.invalid`, `auth.token.expired`, `auth.rbac.denied`, `auth.login.db_error`. The wrapper redacts any field named `password` or `token`.
- **Boot guard** — process startup reads `JWT_SECRET` from env, validates length ≥ 32, and exits with code 1 on failure with a clear stderr message before any HTTP listener binds.
- **ts-rest contract package** — `packages/contracts` exports the auth contract (`login`, `me`) with Zod schemas for request, response, and error shapes. Empty placeholder routers are exported for the other five modules so feature work can mock against them. Both `apps/api` and `apps/web` import from this package.
- **Web app shell** — Vite + React + Tailwind + TanStack Router (file-based routes) + TanStack Query. Routes: `/login`, `/patient`, `/doctor`, plus a catch-all that redirects unauthenticated traffic to `/login` and authenticated traffic to the role-appropriate dashboard.
- **Login page** — controlled form (email + password), submit calls the typed contract, on 200 stores the JWT in `localStorage`, invalidates the `['auth', 'me']` query, and redirects to `/patient` or `/doctor` based on the freshly-fetched role.
- **Auth token storage** — small wrapper around `localStorage` (`getToken`, `setToken`, `clearToken`). Single source of truth for where the token lives in the browser.
- **TanStack Query auth integration** — global `queryClient` configured so every request reads the current token from the storage wrapper and sets `Authorization: Bearer <token>`; on a 401 from `/auth/me`, the token is cleared and the user is sent to `/login`.
- **`currentUser` query** — the canonical client-side hook (`['auth', 'me']`) that drives every route guard, every header user-name display, and the post-login redirect. There is no separate Zustand/Context store for auth.
- **Client-side route guards** — TanStack Router `beforeLoad` hooks that await the `currentUser` query and either let the route render, redirect to `/login`, or redirect to the user's correct dashboard if the role does not match.
- **Dashboard stubs** — minimal `/patient` and `/doctor` pages rendering "Welcome, {firstName}" + role + a logout button + an empty "Upcoming appointments" placeholder section. Modules 01/03/04 replace these contents later without touching the routing or guard machinery.
- **Logout control** — a button in the dashboard shell that clears the token via the storage wrapper, resets the `queryClient`, and navigates to `/login`. No server endpoint involved.

### Architectural decisions

- **Login identifier is email.** `data/seed-accounts.json` is regenerated to use email-format addresses; the API and UI both validate `.email()` via Zod.
- **Auth identity table is `users`** (not `accounts`); modules 01 and 03 already FK against `users.id`. The feature spec is amended on this point.
- **Primary key is UUID**, not a literal short string like `'d-1'`. Acceptance criteria that quote `'d-1'` are interpreted as illustrative; tests assert against real UUIDs returned by the seed.
- **Role lives on `users` as a Postgres enum**, giving DB-level guarantees against junk values (defense-in-depth for EC-003).
- **JWT in `localStorage`**, attached as `Authorization: Bearer <token>`. No httpOnly cookie; no refresh token. The 24-hour expiry is the entire session policy for the prototype.
- **`GET /auth/me` is the single source of truth for `currentUser` on the web side.** The JWT is never decoded in the browser; the server is always asked. Catches expired tokens (EC-002), tampered tokens (EH-002), and orphaned subjects (EC-005) on every app boot.
- **Logout is client-side only.** No `POST /auth/logout`. Stateless JWT plus a 24-hour expiry plus the lack of a token blocklist means a server endpoint would be theatre.
- **`requireAuth()` and `requireRole([...])` are the only auth middlewares.** Every protected route opts in by composing them; no global middleware that "guesses" which routes are protected.
- **Structured logging with redaction by field name.** No `password` or `token` field ever lands in a log line, regardless of context.
- **Drizzle migrations via `pnpm db:push`** (matching the CLAUDE.md command surface). No generated SQL migrations for this slice — the schema is pushed directly.
- **No barrel files; named exports; kebab-case filenames; `PascalCase.tsx` for components** (per `docs/ARCHITECTURE_RULES.md`).

### API contract (ts-rest, defined in `packages/contracts`)

- `POST /auth/login` — request `{ email: string, password: string }`; success `{ token: string }`; errors `{ error: 'Invalid credentials' | 'Validation failed' | 'Unsupported Media Type' | 'Service unavailable', issues?: ZodIssue[] }`.
- `GET /auth/me` — no body; success `{ id: string, email: string, role: 'doctor' | 'patient' }`; errors `{ error: 'Authorization header required' | 'Malformed Authorization header' | 'Invalid token' | 'Token expired' | 'Account not found' }`.
- `GET /health` — no auth; success `{ status: 'ok' }`.

Status code mapping is per the feature spec (401 for credential / token failures, 403 for role failures, 415 / 422 for input failures, 503 for DB unavailability, 200 for success).

### Schema changes

- New `user_role` enum (`'doctor' | 'patient'`).
- New `users` table (UUID PK; lower-cased unique email; bcrypt password_hash; role; timestamps).
- New `patients` table (`user_id` PK FK → `users.id` ON DELETE CASCADE; `first_name`; `last_name`; `updated_at`). Modules 01 will extend.
- New `doctors` table (`user_id` PK FK → `users.id` ON DELETE CASCADE; `first_name`; `last_name`; `updated_at`). Module 03 will extend.

### Specific interactions

- A login attempt against a non-existent email and a login attempt with a wrong password produce **byte-identical** 401 responses (no field hint, same body, same headers).
- The API does **not** consult the DB to check existence before checking the password; it loads the row, runs bcrypt.compare regardless, and rejects with the same neutral error if either step fails.
- `GET /auth/me` re-validates the token *and* re-loads the user from the DB on every call — orphaned tokens are caught at request time, not just at app boot.
- The web client treats any 401 from `/auth/me` as a logout signal: clears the token, resets the query cache, redirects to `/login`.
- The web client treats any 401 from a protected non-`/auth/me` request as a token-expiry signal: same logout behavior, with a small toast informing the user their session expired.
- Hitting `/login` while already authenticated redirects to the role-appropriate dashboard, so the back button never strands a logged-in user on the login form.
- Hitting `/patient` as a doctor (or `/doctor` as a patient) redirects to the user's correct dashboard rather than rendering a 403 page — the boundary is enforced, but the UX is gentle.

## Testing Decisions

### What makes a good test for this slice

- Test external behavior, not internal call shape. For login, the test asserts on HTTP status, response body, and side effects (a structured log line written, a row read from a real Postgres). It does not assert on which internal function was called.
- Use a real database for integration tests (per `docs/ARCHITECTURE_RULES.md`'s "no mocking the database"). Seed it with the same fixtures the dev environment uses; truncate-and-reseed between test files.
- Co-locate unit tests with their source (`foo.ts` ↔ `foo.test.ts`). Vitest is the runner everywhere on the server and client side except for browser-driven flows.
- Drive the full kickoff with at least one Playwright e2e: open `/`, get redirected to `/login`, log in as a seeded patient, land on `/patient`, see the welcome message, log out, land on `/login`. Repeat as a seeded doctor for `/doctor`.

### Modules that get tests in this slice

- **Auth domain (deep module).** Exhaustive unit tests on JWT sign/verify (valid, expired, tampered signature, wrong secret, missing claims, junk role), bcrypt verification (match, mismatch, malformed hash), and the `currentUser` resolver (happy, expired, orphaned subject).
- **Auth use cases.** Integration tests against a real Postgres: login success returns a JWT, login with wrong password returns the neutral 401, login against missing email returns the same neutral 401, `getCurrentUser` returns the right shape, `getCurrentUser` for a deleted seeded user returns the orphaned-subject failure.
- **Auth HTTP layer.** Integration tests at the Hono request level: status codes, body shapes, headers — one test per acceptance criterion (AC-001 through AC-012). Includes the malformed-`Authorization` cases, the missing-header case, and the role-denial cases.
- **Boot guard.** Unit test that constructing the app config with a missing or short `JWT_SECRET` throws / exits, and constructing with a valid secret succeeds.
- **Logger redaction.** Unit test that any object with a `password` or `token` field is redacted before being emitted, including nested fields.
- **Seed script.** Integration test that running the seed twice is idempotent (upsert, not duplicate-insert), and that every seeded account can log in with the documented plaintext password.
- **Web auth flow.** Playwright e2e covering the full login → dashboard → logout cycle for both roles, plus an "expired-token" flow that mutates `localStorage` to a known-bad token and asserts the redirect to `/login`.
- **Web auth hooks.** Vitest component tests on the login form (validation messages, submit happy path against a mocked contract) and the route-guard wrappers (renders children when authorized, redirects when not).

### Prior art

There is no prior art in this repo — this is the kickoff slice. Future modules should follow the patterns this slice establishes:
- Hono integration tests using a real Postgres + a per-suite reset.
- ts-rest + Zod contracts as the boundary types.
- Playwright e2e covering login → action → assert.

## Out of Scope

- Self-service registration. The seeded accounts are the entire user base for the prototype.
- Password reset, password change, "forgot password" email flow. No email infrastructure exists per the quest constraints.
- Refresh tokens, sliding sessions, "remember me", session revocation, token blocklists.
- A `POST /auth/logout` endpoint. Logout is client-side.
- Multi-factor authentication, social login (Google / GitHub OAuth), magic links.
- Rate limiting on `/auth/login`, account lockout, IP allow-listing, captchas.
- Email change, email verification.
- Audit log persistence beyond structured logging to stdout.
- RODO / HIPAA / GDPR compliance plumbing — explicitly excluded by the quest.
- Multi-tenancy, organisations, teams.
- Internationalisation of error messages — single language per the quest constraint.
- Light/dark theming, accessibility audit (beyond ESLint defaults), responsive layout polish — the kickoff dashboards are intentionally minimal stubs.
- Real "Upcoming appointments" content on the dashboards. The empty placeholder is the deliverable; Module 04 fills it in.
- Drizzle generated SQL migrations and a versioned migration history. `pnpm db:push` is the contract for this prototype.

## Further Notes

- The original feature spec at `.relay/runs/90a822/artifacts/feature-spec.md` says "accounts table" and uses the literal example id `'d-1'`. This PRD intentionally diverges: the table is `users` (matching Modules 01–05) and ids are real UUIDs. Acceptance criteria that quote `'d-1'` are read as illustrative, not literal.
- `data/seed-accounts.json` is currently committed with username-style logins (`dr.kowalski`, `p.zielinski`). It will be regenerated to email format (`firstname.lastname@medbridge.local`) as part of this slice. The plaintext passwords stay committed — they are demo credentials, intentionally visible.
- The feature spec mentions "session/cookie auth" in `docs/modules/README.md`'s shared-kickoff line. This PRD overrides that wording: the kickoff ships JWT-based auth with `Authorization: Bearer`. The modules README is a pre-existing artifact that does not need to be edited for this slice; downstream modules should rely on this PRD as the canonical statement.
- The boot guard, the logger redaction rule, and the neutral-401 enumeration defense are the three places where a regression would silently degrade security without breaking any happy-path test. They each get an explicit unit test.
- `pnpm db:push` plus `pnpm db:seed` are the only commands a fresh agent loop iteration needs to know to bring the database to a known state. Both run in CI and locally.
- Modules 01–05 should rely on this PRD's contract surface — they should never re-define `currentUser`, JWT shape, or role values. If they need a new role-specific column, they extend `patients` / `doctors` rather than adding columns to `users`.
