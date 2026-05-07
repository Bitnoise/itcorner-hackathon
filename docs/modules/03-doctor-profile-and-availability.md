# Module 03 — Doctor Profile & Availability

## Summary

A doctor manages their public profile (name, specialization) and publishes individual bookable time slots that patients can later book through Module 04. Each slot is a discrete `(starts_at, ends_at)` row — there is no recurring weekly schedule. This module also exposes the public read endpoints (list of doctors, list of a doctor's free slots) consumed by the booking flow.

## Acceptance Criteria

- Doctor can view and edit their profile fields: first name, last name, specialization (free text).
- Doctor can publish a new slot by entering a start datetime and a duration (or end datetime); the slot appears as `free` in their availability list and in the patient-facing slot view.
- Doctor can see all of their slots (free and booked) on a single availability page.
- Doctor can delete a `free` slot; deletion is rejected for a `booked` slot.
- Patient (via the read endpoints) can list doctors and, for a chosen doctor, see only `free` upcoming slots.
- A user without role `doctor` hitting management endpoints → **403**.
- Slot creation rejects: `ends_at <= starts_at`; overlap with the doctor's existing slot.

## Functional Requirements

### Database

- `doctors`:
  - `user_id` (PK, FK → `users.id`, on delete cascade)
  - `first_name` (text, not null)
  - `last_name` (text, not null)
  - `specialization` (text, not null) — free text, no controlled vocabulary
  - `updated_at` (timestamptz)
- `doctor_slots`:
  - `id` (uuid, PK)
  - `doctor_id` (FK → `users.id`, not null)
  - `starts_at` (timestamptz, not null)
  - `ends_at` (timestamptz, not null, check `ends_at > starts_at`)
  - `status` (enum `free` | `booked`, default `free`)
  - Index on (`doctor_id`, `starts_at`)

The seed script (kickoff) creates at least two doctors with distinct specializations; this module's tests should not rely on Module 03 itself for seed data.

### API (`apps/api`)

Doctor (require role `doctor`):
- `GET /api/doctor/profile`
- `PUT /api/doctor/profile`
- `POST /api/doctor/slots` — body `{ starts_at, ends_at }`; rejects overlaps and inverted ranges.
- `GET /api/doctor/slots` — own slots, free + booked, sorted by `starts_at`.
- `DELETE /api/doctor/slots/:id` — only if status = `free`; otherwise **409**.

Public read (any authenticated role; needed by Module 04):
- `GET /api/doctors` — list of doctors with `id`, display name, specialization. Optional `?q=` for case-insensitive specialization/name match.
- `GET /api/doctors/:id/slots?status=free` — upcoming free slots only (filtered server-side; `starts_at >= now`).

### Contracts (`packages/contracts`)

- `doctorProfileContract`, `doctorSlotsContract` (private), `doctorsDirectoryContract` (public read consumed by Module 04).

### Frontend (`apps/web`)

- `/doctor/profile` — profile form (first name, last name, specialization).
- `/doctor/availability` — list / calendar view of own slots; "Add slot" form (start datetime + duration picker); per-row delete on free slots.
- Doctor-side guard: `doctor` role only. Patient role accessing these routes → redirect to their home.

## Non-Functional Requirements

- All datetimes stored in UTC; UI displays in a single configured timezone (per quest's "Jedna strefa czasowa"). The chosen tz lives in a single config constant on the web side.
- Overlap and ordering checks enforced on the API in a single transaction (`SELECT ... FOR UPDATE` over the doctor's slots).
- ts-rest contracts; Vitest unit + integration; Playwright e2e: doctor logs in → publishes a slot → slot appears in their availability list and in the public read endpoint.
- TDD red→green→refactor; commit format per `CLAUDE.md`.
- ESLint + typecheck pass; `pnpm verify` green before PR.

## Depends On

- **Shared kickoff** — auth, role middleware, seed doctor users, contracts skeleton.
- No dependency on other feature modules. **Module 04 depends on the public read endpoints** (`GET /api/doctors`, `GET /api/doctors/:id/slots`) and on the booking flow's ability to flip a slot's status to `booked` — the booking transaction is owned by Module 04 but acts on this module's `doctor_slots` table.
