# Module 05 — Visit Summary

## Summary

Closes the visit lifecycle. While an appointment is `scheduled`, the doctor can save and edit a structured visit summary — diagnosis (rozpoznanie), recommendations (zalecenia), prescribed medications, and referrals/orders for tests (skierowania na badania). Saving a draft does **not** complete the visit; the doctor must explicitly mark the visit as `completed`. Only once the visit is `completed` does the patient see the summary in their visit history. This realises the "po wizycie" requirements for both personas in `quest.md`.

## Acceptance Criteria

### Doctor
- For an appointment owned by the calling doctor with status `scheduled`, the doctor can open the appointment, fill in / edit the summary form, and save it as a draft any number of times.
- The doctor has a separate, explicit **"Mark visit completed"** action. Triggering it transitions the appointment from `scheduled` to `completed`. This action is idempotent — calling it twice does not error and does not double-create a state.
- After completion, the summary is no longer editable by the doctor (read-only view).
- The doctor cannot mark another doctor's appointment as completed; cross-doctor write → **403**.

### Patient
- Patient sees a "Visit history" page listing only their `completed` appointments.
- For each completed appointment, the patient can open a detail view rendering the full summary (diagnosis, recommendations, list of prescribed medications, list of referrals), the doctor's name and specialization, and the visit date.
- A patient cannot read a summary for an appointment that is still `scheduled` — endpoint returns **404** (do not leak existence) or **403** with no body fields.

### Cross-cutting
- A request to complete an appointment whose status is already `completed` is a no-op (returns `200`, not an error).
- A request to write a summary for a non-existent or not-owned appointment → **404**.

## Functional Requirements

### Database

- `visit_summaries`:
  - `appointment_id` (PK, FK → `appointments.id`, on delete cascade)
  - `diagnosis` (text, default `''`)
  - `recommendations` (text, default `''`)
  - `medications` (jsonb — array of `{ name: string, notes?: string }`)
  - `referrals` (jsonb — array of `{ test: string, notes?: string }`)
  - `updated_at` (timestamptz)

A row is created on first save (upsert pattern) — there is no separate "open summary" call.

The state machine on `appointments.status` (`scheduled` → `completed`) is owned by this module's `complete` endpoint. Module 04 only writes `scheduled` on creation.

### API (`apps/api`)

Doctor (require role `doctor`, must own the appointment):
- `PUT /api/doctor/appointments/:id/summary` — upsert the summary fields (idempotent draft save). Allowed only when status = `scheduled`.
- `POST /api/doctor/appointments/:id/complete` — transitions status to `completed`. Idempotent.

Patient (require role `patient`, must own the appointment):
- `GET /api/patient/appointments/:id/summary` — returns the summary only when status = `completed`. Includes doctor name + specialization + visit date.

### Contracts (`packages/contracts`)

- `visitSummaryContract` — the three endpoints above with shared Zod schemas for the structured medication and referral arrays.

### Frontend (`apps/web`)

Doctor:
- Inside the appointment detail page (owned by Module 04), this module contributes the summary section: form for diagnosis/recommendations, dynamic list editors for medications and referrals (add / remove rows), "Save draft" button, and a distinct "Mark visit completed" button (with a confirmation dialog).
- After completion, the section flips to a read-only summary card.

Patient:
- `/patient/visits` — visit history list (completed appointments, newest first).
- `/patient/visits/:id` — detail view rendering the structured summary as readable sections (medication list, referral list).

## Non-Functional Requirements

- Vitest unit + integration coverage for the state machine: cannot edit after completion; complete is idempotent; patient endpoint returns nothing while `scheduled`.
- Playwright e2e fulfilling the quest's Definition of Done from the visit-summary side: doctor writes summary → marks completed → patient logs in and reads it from history.
- ts-rest contract with shared schema for medication/referral items so both UIs (doctor form, patient detail) render the same shape.
- TDD red→green→refactor; commit format per `CLAUDE.md`.
- ESLint + typecheck pass; `pnpm verify` green before PR.

## Depends On

- **Module 04 — Appointments & Booking** — owns the `appointments` table and the doctor's appointment detail page that this module extends with the summary section. Cannot ship before Module 04, but UI work can begin in parallel against the kickoff contract.
- **Module 03 — Doctor Profile & Availability** (transitive via Module 04) — for doctor display name + specialization rendered on the patient's history view.
- **Shared kickoff** — auth, role middleware, contracts skeleton.
