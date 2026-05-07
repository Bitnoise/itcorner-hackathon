# Module 01 — Patient Profile

## Summary

After logging in, a patient can view and edit their health profile: identity (first name, last name, date of birth) and clinical context (allergies, chronic conditions, regular medications). This module owns the canonical patient profile data that downstream modules (Appointments, Visit Summary) will read from. It is a pure vertical slice — DB → API → UI → tests — and is independent of every other feature module.

## Acceptance Criteria

- A logged-in patient can navigate to `/patient/profile` and see their own current profile values.
- The patient can edit and save: first name, last name, date of birth, allergies, chronic conditions, regular medications.
- After saving, the new values persist across sessions (page refresh, re-login).
- A user with role `doctor` accessing `/patient/profile` (UI or API) receives **403 Forbidden**.
- A patient cannot read or write another patient's profile (server checks identity, not just role).
- Form-level validation: required fields rejected with a clear message; date of birth must be a valid date in the past.

## Functional Requirements

### Database

- `patients` table:
  - `user_id` (PK, FK → `users.id`, on delete cascade)
  - `first_name` (text, not null)
  - `last_name` (text, not null)
  - `date_of_birth` (date, nullable until first save)
  - `allergies` (text, default `''`)
  - `chronic_conditions` (text, default `''`)
  - `regular_medications` (text, default `''`)
  - `updated_at` (timestamptz, default now)

The seed user(s) created in the kickoff get a row in `patients` with sensible defaults so the page renders immediately on first login.

### API (`apps/api`)

- `GET /api/patient/profile` — returns the calling patient's profile.
- `PUT /api/patient/profile` — full update of the editable fields.
- Both endpoints require role `patient`; identity is taken from the authenticated session, never from the URL.

### Contracts (`packages/contracts`)

- ts-rest contract `patientProfileContract` exporting both endpoints with Zod schemas. The shared kickoff publishes the empty contract; this module fills it in.

### Frontend (`apps/web`)

- Route `/patient/profile` (TanStack Router), guarded for role `patient`.
- Profile page renders a single form with controlled inputs; multi-line `<textarea>` fields for allergies / chronic conditions / medications.
- Data fetching + mutation via TanStack Query; optimistic update on successful save with toast feedback.
- Disabled save button while in flight; surfaces server-side validation errors next to the offending field.

## Non-Functional Requirements

- Strict TDD red→green→refactor (per `CLAUDE.md`); commit messages must follow the project pattern.
- Vitest unit tests for handlers and the patient repository; integration test against the local Postgres.
- Playwright e2e: login as patient → edit profile → reload → values persist.
- All fields validated on the API side via the same Zod schemas used by the contract; the UI must not be the only line of defense.
- No PII handling beyond what the prototype needs (per quest: prototype is **not** RODO/HIPAA-bound).
- ESLint + typecheck pass; `pnpm verify` is green before opening a PR.

## Depends On

- **Shared kickoff** — auth + role middleware + `users` table + seeded patient user + monorepo scaffolding + ts-rest contract package.
- No dependency on any other feature module. The read endpoint is consumed by Module 04 (doctor's appointment detail panel) but that module mocks it from the kickoff contract until this one ships.
