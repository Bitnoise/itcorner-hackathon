# Module 02 — Patient Documents & Sharing

## Summary

A patient can upload medical-document files, list and delete them, and grant or revoke per-doctor access to each document independently of any visit. A doctor can list patients who have shared documents with them and download those documents. Sharing is **per-doctor and standalone** — it is not coupled to having an appointment with that doctor. This module exposes the doctor-side read endpoint that Module 04 (Appointments) embeds in its patient-detail panel.

## Acceptance Criteria

### Patient
- Patient can upload a document via a file picker; the file appears in their document list immediately.
- Patient can see the list of all their documents (filename, mime type, size, uploaded-at).
- Patient can delete a document; the file disappears from disk and any sharing records are removed atomically.
- For each document, patient can open a sharing dialog listing **all** doctors in the system, see which ones currently have access, and toggle access on/off.
- Granting access to doctor X exposes that document to doctor X immediately. Revoking removes access immediately.

### Doctor
- Doctor can view a "Shared with me" view grouped by patient — for each patient who shared at least one document, the doctor sees the patient's display name and the list of shared documents (metadata only).
- Doctor can download / open any document shared with them.
- Doctor cannot see a document that has not been shared with them — direct download URL → **403**.

### Cross-cutting
- Patient cannot see another patient's documents — list and detail endpoints scope to the authenticated user.
- A user without `patient` role hitting patient endpoints → **403**; a user without `doctor` role hitting doctor endpoints → **403**.

## Functional Requirements

### Database

- `documents`:
  - `id` (uuid, PK)
  - `patient_id` (FK → `users.id`, not null)
  - `filename` (text, original name)
  - `mime_type` (text)
  - `size_bytes` (bigint)
  - `storage_path` (text — non-guessable, stored as relative path from the storage root)
  - `uploaded_at` (timestamptz)
- `document_shares`:
  - `document_id` (FK → `documents.id`, on delete cascade)
  - `doctor_id` (FK → `users.id`)
  - `granted_at` (timestamptz)
  - PK = (`document_id`, `doctor_id`)

### File storage

- Local filesystem under `apps/api/storage/documents/` (volume-mounted in `docker-compose` for dev).
- File names on disk are random UUIDs (or content-hash derivatives) — never the original filename — to prevent path enumeration.
- Deleting a document deletes both the row and the file from disk inside a single transaction (best-effort cleanup; orphan-file recovery script is out of scope for the prototype).

### API (`apps/api`)

Patient endpoints (require role `patient`):
- `POST /api/documents` — multipart upload; returns the created document record.
- `GET /api/documents` — patient's own list.
- `DELETE /api/documents/:id` — own only.
- `GET /api/documents/:id/shares` — list of doctor IDs the document is shared with.
- `POST /api/documents/:id/shares` — body `{ doctorId }` — idempotent grant.
- `DELETE /api/documents/:id/shares/:doctorId` — idempotent revoke.

Doctor endpoints (require role `doctor`):
- `GET /api/doctor/shared-documents` — grouped-by-patient list of documents shared with the calling doctor.
- `GET /api/documents/:id/file` — auth-checked binary stream. Allowed if the caller is the owning patient OR a doctor with an active share.

### Contracts (`packages/contracts`)

- `documentsContract` — patient-facing endpoints (file upload uses the contract's binary handling or escapes to raw Hono — pick whichever ts-rest supports cleanly; document the choice in an ADR if a workaround is needed).
- `doctorSharedDocumentsContract` — doctor-facing read endpoint, also consumed by Module 04.

### Frontend (`apps/web`)

Patient (`/patient/documents`):
- Document list with upload button, per-row delete, per-row "Manage sharing" action.
- Sharing modal: lists all doctors (name + specialization), with a toggle per doctor that calls grant/revoke and reflects the current state.

Doctor (component reused by Module 04):
- "Shared with me" panel — grouped by patient, each document with download link.
- Module 04 embeds this panel inside its appointment detail view; this module exports the React component & query hook so Module 04 doesn't reimplement it.

## Non-Functional Requirements

- Server-side allowlist of mime types (PDF + common images: `image/png`, `image/jpeg`, `image/webp`) and a max size (e.g. 10 MB). Reject other uploads with **415** / **413**.
- Authorization checked on **every** download request — never serve files via a public static path.
- File streaming on download (no buffering whole files in memory).
- TDD red→green→refactor, Vitest covering: upload, listing, sharing toggle, doctor-side read access (positive + negative), unauthorized download attempt.
- Playwright e2e: patient uploads → grants doctor → doctor opens the file successfully.
- ESLint + typecheck pass; `pnpm verify` green before PR.

## Depends On

- **Shared kickoff** — auth, role middleware, seed users (at least one patient + two doctors), contracts skeleton.
- No dependency on other feature modules. **Module 04 depends on this module's doctor-side endpoint** (`GET /api/doctor/shared-documents`); during parallel development Module 04 mocks it from the kickoff contract.
