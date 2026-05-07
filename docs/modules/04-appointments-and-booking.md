# Module 04 — Appointments & Booking

## Summary

The end-to-end appointment lifecycle up to (but not including) the visit summary. A patient browses doctors, picks a free slot, and books it — booking transactionally flips the slot to `booked` and creates an `appointment`. Each side of the relationship gets a list view: the patient sees their upcoming and past appointments; the doctor sees the same schedule from their perspective with a per-appointment detail panel that embeds the patient's profile (Module 01) and the documents the patient has shared with them (Module 02). The doctor's panel is the "before-visit" deliverable from `quest.md`.

## Acceptance Criteria

### Patient
- Patient can list doctors and filter by specialization keyword (server-side filter).
- Patient can open a doctor and see only that doctor's **upcoming free** slots.
- Patient can book a free slot; on success, the slot becomes `booked` and an `appointment` row is created.
- Booking the same slot twice (concurrent or sequential) — exactly one wins; the loser receives **409** with a clear message.
- Patient sees a "My appointments" page listing upcoming and past appointments with doctor name, specialization, and slot datetime.

### Doctor
- Doctor sees a schedule view listing their upcoming and past appointments grouped by date.
- Opening an appointment shows a panel containing:
  - The patient's profile (read from Module 01's API) — name, DOB, allergies, chronic conditions, regular medications.
  - The list of documents the patient has shared with **this** doctor (read from Module 02's API), with download links.
- Doctor cannot see appointments that aren't theirs; patient cannot see another patient's appointments.

### Cross-cutting
- Booking must be atomic — slot row is locked (`SELECT ... FOR UPDATE`) and the appointment insert + slot update happen in the same transaction.
- A user with the wrong role hitting an opposite-side endpoint → **403**.

## Functional Requirements

### Database

- `appointments`:
  - `id` (uuid, PK)
  - `slot_id` (FK → `doctor_slots.id`, **unique** — 1:1 with slot)
  - `patient_id` (FK → `users.id`)
  - `doctor_id` (FK → `users.id`)
  - `status` (enum `scheduled` | `completed`, default `scheduled`)
  - `created_at` (timestamptz)

The `status` field is consumed by Module 05 (which transitions it to `completed`); this module only writes `scheduled`.

### API (`apps/api`)

Patient (require role `patient`):
- `GET /api/doctors` — owned by Module 03; this module consumes it.
- `GET /api/doctors/:id/slots` — owned by Module 03; this module consumes it.
- `POST /api/appointments` — body `{ slotId }`. Transaction: lock slot, fail with **409** if not `free`, insert appointment, update slot status to `booked`.
- `GET /api/patient/appointments` — own list with doctor info embedded.

Doctor (require role `doctor`):
- `GET /api/doctor/appointments` — own list (upcoming + past).
- `GET /api/doctor/appointments/:id` — own appointment + embedded patient profile (Module 01) + shared docs metadata (Module 02). Server composes the response by calling the internal read functions of those modules; cross-module reads must respect their authorization rules.

### Contracts (`packages/contracts`)

- `appointmentsContract` — patient + doctor endpoints (excluding the read endpoints owned by Modules 01/02/03 which are imported and reused).

### Frontend (`apps/web`)

Patient:
- `/patient/doctors` — list / filter doctors.
- `/patient/doctors/:id` — slot picker + "Book" CTA with confirmation.
- `/patient/appointments` — own list (upcoming + past).

Doctor:
- `/doctor/schedule` — list of appointments grouped by date.
- `/doctor/appointments/:id` — detail page embedding:
  - Patient profile section (component / hook reused from Module 01)
  - Shared documents section (component / hook reused from Module 02)

The reused components are imported from Modules 01 / 02 — no duplicated rendering or fetching code.

## Non-Functional Requirements

- ts-rest contract; integration tests around the booking race (two concurrent `POST /api/appointments` for the same slot — exactly one wins).
- Playwright e2e: patient books a slot → patient sees it in "My appointments" → doctor sees it in schedule with patient's profile + shared documents visible in the panel.
- Strict TDD red→green→refactor; commit format per `CLAUDE.md`.
- No notifications/emails (per quest constraints — `Brak wysyłki wiadomości e-mail`).
- ESLint + typecheck pass; `pnpm verify` green before PR.

## Depends On

- **Module 01 — Patient Profile** — read endpoint consumed in the doctor's appointment detail panel. Mock from kickoff contract while 01 is in flight.
- **Module 02 — Patient Documents & Sharing** — doctor-side read endpoint (`GET /api/doctor/shared-documents` and the file-download endpoint) consumed in the same panel. Mock similarly during parallel development.
- **Module 03 — Doctor Profile & Availability** — owns `doctors`, `doctor_slots` tables and the public read endpoints; this module's booking transaction operates on `doctor_slots`.
- **Shared kickoff** — auth, role middleware, contracts skeleton, seed users and (preferably) a couple of seed slots so the booking flow can be exercised end-to-end before Module 03 ships its UI.
