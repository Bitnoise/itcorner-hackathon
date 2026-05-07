# Domain Glossary

Canonical vocabulary for MedBridge. Use these exact terms in code, comments, contracts, tests, commits, and docs. If a new term is needed, add it here first.

## People

- **Patient** — an end user whose role is `patient`. Owns their health profile, medical documents, appointment bookings, and visit history.
- **Doctor** — an end user whose role is `doctor`. Owns a profile (with specialization), publishes bookable slots, sees their schedule, writes visit summaries.
- **User** — generic term for any authenticated principal. In code, the canonical record is the `users` row. Has exactly one `role`.
- **Seeded account** — a `users` row created by `pnpm db:seed` from `data/seed-accounts.json`. The prototype has no self-service registration; every account is seeded.

## Authentication

- **Login identifier** — the `email` field on `users`. Always lower-cased and trimmed before comparison. Validated with Zod `.email()`.
- **Password** — the user's plaintext secret submitted at login. Never stored, never logged.
- **Password hash** — the bcrypt hash (cost factor 12) stored in `users.password_hash`. The only authentication material the server retains.
- **JWT** — a signed JSON Web Token (HS256) issued by `POST /auth/login`. Carries claims `sub` (user id, UUID), `role` (`'doctor' | 'patient'`), `iat`, `exp` (24 hours from `iat`).
- **JWT_SECRET** — environment variable. Required at startup, must be at least 32 characters; the API process exits with code 1 if missing or too short.
- **Bearer token** — the JWT presented by the web client in the `Authorization: Bearer <token>` header on every protected request.
- **Token storage** — the web client persists the JWT in `localStorage`. The single read/write surface is the `auth-token` storage wrapper.
- **currentUser** — the authenticated principal as the rest of the system sees them: `{ id, email, role }`. Resolved server-side by `GET /auth/me`; consumed client-side via the `['auth', 'me']` TanStack Query key.
- **Login** — the act of exchanging email + password for a JWT. The HTTP surface is `POST /auth/login`.
- **Logout** — the act of clearing the JWT from `localStorage` and resetting the auth query cache. Purely client-side; there is no server endpoint.

## Authorization

- **Role** — one of `'doctor'` or `'patient'`. Stored as a Postgres enum `user_role` on `users.role`. Encoded as the `role` claim on the JWT.
- **`requireAuth()`** — server middleware that verifies the Bearer token, loads `{ id, role }`, and attaches it to the request context. Rejects with 401 on any auth failure.
- **`requireRole([...])`** — server middleware that runs after `requireAuth()` and rejects with 403 unless the request's `role` is in the allow-list.
- **Route guard** — the client-side equivalent: a TanStack Router `beforeLoad` hook that awaits the `['auth', 'me']` query and either lets the route render, redirects to `/login`, or redirects to the user's correct dashboard.
- **Protected route** — any HTTP route that requires `requireAuth()` (and possibly `requireRole`). All routes are protected by default except `POST /auth/login` and `GET /health`.
- **Public route** — `POST /auth/login` and `GET /health`. No other public routes exist.

## Data

- **`users`** — the auth identity table. UUID PK, unique lower-case email, bcrypt password hash, role, timestamps. FK target for every other domain table that needs to reference a person.
- **`patients`** — the patient profile table. PK is `user_id` (FK → `users.id` ON DELETE CASCADE). Owns `first_name`, `last_name`, `updated_at` in this slice; Module 01 will add the clinical fields.
- **`doctors`** — the doctor profile table. PK is `user_id` (FK → `users.id` ON DELETE CASCADE). Owns `first_name`, `last_name`, `updated_at` in this slice; Module 03 will add specialization and slot relations.
- **`user_role`** — Postgres enum with values `'doctor'` and `'patient'`. Used by `users.role`.
- **Seed data** — `data/seed-accounts.json`, the canonical list of seeded accounts. Plaintext passwords are intentionally committed as demo credentials.
- **Seed script** — `pnpm db:seed`. Reads the seed JSON, bcrypts each password (cost factor 12), upserts a `users` row plus the matching `patients` or `doctors` row. Idempotent.

## Surface

- **Dashboard** — the post-login landing page. There are two: `/patient` and `/doctor`. Each shows "Welcome, {firstName}", a logout control, and an empty "Upcoming appointments" placeholder section that Module 04 will fill.
- **Login page** — the unauthenticated landing surface at `/login`. Renders the email + password form.
- **Health endpoint** — public `GET /health`. Returns `{ status: 'ok' }` with HTTP 200. No auth.
- **Contracts package** — `packages/contracts`. ts-rest + Zod definitions of every API contract. The single source of truth for request/response/error types; both `apps/api` and `apps/web` import from here.

## Workflow

- **Slice** — a tracer-bullet vertical: DB schema → API → contract → UI → tests, all delivered together. The agent loop never works horizontally.
- **Kickoff** — this slice. The shared scaffolding + auth + seed groundwork on which Modules 01–05 depend.
- **Module** — one of the five feature blueprints under `docs/modules/`. Each module is itself one or more slices.
- **`pnpm verify`** — the agent-loop feedback signal: typecheck + tests + lint, all clean. Runs before every commit.
