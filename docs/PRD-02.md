# Product Requirements — Module 02: Patient Documents & Sharing

## Problem Statement

Patients have no way to share medical documents with their doctors in MedBridge. There is no upload mechanism, no document storage, and no access control — doctors are blind to patient history and patients cannot control who sees their files. Every downstream module that references patient documents (Module 04 appointments, Module 05 visit summaries) is blocked until this foundation exists.

## Solution

Ship Module 02 as a vertical slice: patient-controlled document upload, listing, deletion, and fine-grained per-doctor sharing, backed by local filesystem storage and a Drizzle-managed schema. Patients manage their documents at `/patient/documents`. Doctors see all documents shared with them, grouped by patient, and can download any file they have been explicitly granted access to. A self-contained `SharedDocumentsList` component and its companion `useSharedDocuments` hook are exported from this module so Module 04 can embed the doctor view without reimplementing any document logic.

This module is built on top of the completed auth slice (JWT, `requireAuth()`, `requireRole()`, `users`, `patients`, `doctors` tables).

## User Stories

1. As a patient, I want to upload a medical document (PDF, PNG, JPEG, or WebP) so that I can make it available for sharing with my doctors.
2. As a patient, I want to see a list of all my uploaded documents ordered from newest to oldest so that I can review what I have on file.
3. As a patient, I want to delete a document so that it is permanently removed from storage and no doctor can access it any more.
4. As a patient, I want to see which doctors currently have access to a specific document so that I know exactly who can view my files.
5. As a patient, I want to grant a specific doctor access to a specific document so that they can download and review it.
6. As a patient, I want to revoke a specific doctor's access to a specific document so that they can no longer download it.
7. As a patient, I want the grant and revoke actions to be idempotent so that clicking the same button twice does not cause an error.
8. As a patient, I want to upload a file up to 10 MiB in size so that typical medical images and PDFs are accepted.
9. As a patient, I want an oversized upload (> 10 MiB) to be rejected with a clear error before any data is written so that I am not left wondering whether a partial file was saved.
10. As a patient, I want unsupported file types to be rejected immediately so that I understand what formats are allowed.
11. As a patient, I want deleting a shared document to atomically remove all sharing records so that no doctor retains phantom access after deletion.
12. As a patient, I want the system to reject any request that references another patient's documents with a 403 so that my files are private by default.
13. As a doctor, I want to see all documents that patients have shared with me, grouped by patient, so that I can review relevant history in one place.
14. As a doctor who has no documents shared with me, I want the "Shared with me" list to return an empty array rather than an error so that the UI renders cleanly.
15. As a doctor, I want to download a document that has been explicitly shared with me so that I can open the file locally.
16. As a doctor, I want every download request to be authorization-checked at the server before any file byte is sent so that no document is accessible via a guessable URL.
17. As a doctor, I want to receive an explicit 403 when I attempt to download a document that has not been shared with me so that the access boundary is unambiguous.
18. As a developer building Module 04, I want to import a ready-made `SharedDocumentsList` component and `useSharedDocuments` hook from Module 02 so that I do not reimplement any document-fetching or rendering logic in the appointments view.
19. As a developer, I want `pnpm verify` to pass at every commit so that the agent loop has a reliable feedback signal.
20. As a developer, I want the document storage directory to be created automatically at API startup so that a fresh clone requires no manual setup steps beyond the existing `cp .env.example .env`.
21. As a developer, I want the storage path to be configurable via an environment variable so that integration tests can write to a temp directory without touching production storage.
22. As an operator, I want a partial-delete failure (file could not be removed from disk after the database row was already deleted) to return a 500 with a descriptive body so that I can manually clean up orphan files.

## Implementation Decisions

### Modules to build

**Document storage service (deep module)**
Encapsulates all filesystem interaction: write an uploaded stream to a UUID-named file, read a file back as a stream, delete a file by UUID. Accepts the storage path at construction time (sourced from `DOCUMENT_STORAGE_PATH`). Auto-creates the storage directory on startup. Has no knowledge of the database. Tested in isolation against a real temp directory.

**Document repository (infrastructure)**
Drizzle-backed persistence for the `documents` and `document_shares` tables. Exposes typed methods: insert document, list by patient, delete by id (within a transaction), upsert share, delete share, fetch sharing state (all doctors with `hasAccess` flag), fetch shared-with-me (grouped by patient). No business logic — pure data access.

**Document use cases (application layer)**
Eight use cases that compose the storage service and repository:
- `uploadDocument` — MIME check, size already enforced by HTTP middleware, write file, insert row, return metadata.
- `listDocuments` — fetch patient's documents ordered by `uploadedAt` descending.
- `deleteDocument` — open a transaction, delete `document_shares` rows, delete `documents` row, commit, then delete the file from disk. If the file delete fails, return a partial-failure error (database is already committed per EH-002).
- `getSharingState` — return all doctors with a `hasAccess` boolean for the given document.
- `grantAccess` — upsert into `document_shares`; no-op if the share already exists.
- `revokeAccess` — delete from `document_shares`; no-op if the share does not exist.
- `getSharedWithMe` — return documents shared with the authenticated doctor, grouped by owning patient.
- `downloadDocument` — verify a `document_shares` row exists for (documentId, doctorId), then return a readable stream of the file.

**Document HTTP routes**
Eight Hono route handlers wiring use cases to HTTP. Every route applies `requireAuth()`. Patient-only routes additionally apply `requireRole(['patient'])`; doctor-only routes apply `requireRole(['doctor'])`. Ownership is enforced inside the use case (patient's `currentUser.id` must match `documents.patient_id`).

**Documents contract**
Fills in the existing placeholder in the contracts package. Defines Zod schemas for all eight request/response/error shapes. Both `apps/api` and `apps/web` import from this package.

**Patient documents page**
A new `/patient/documents` route in the web app. Renders a file input for upload, a list of the patient's documents (each with delete and share-management controls), and a per-document sharing panel listing every doctor with a toggle.

**SharedDocumentsList component and useSharedDocuments hook**
A self-contained React component that fetches and renders the doctor's "Shared with me" list grouped by patient. The TanStack Query hook calls `GET /documents/shared-with-me`. Both are named exports from the documents feature module so Module 04 can import them directly.

### Schema changes

New `documents` table:
- `id` — UUID primary key, generated
- `patient_id` — FK → `users.id` ON DELETE CASCADE
- `filename` — text, the original filename as submitted by the patient
- `mime_type` — text (one of the four allowed types)
- `size` — integer, byte count
- `storage_path` — text, the UUID-only filename on disk (no directory, no extension)
- `uploaded_at` — timestamp with time zone, defaulting to now

New `document_shares` table:
- `document_id` — FK → `documents.id` ON DELETE CASCADE
- `doctor_id` — FK → `users.id` ON DELETE CASCADE
- `granted_at` — timestamp with time zone, defaulting to now
- Composite primary key: (`document_id`, `doctor_id`)

Indexes:
- `documents(patient_id, uploaded_at DESC)` — serves the patient list query (FR-002)
- `document_shares(doctor_id)` — serves the shared-with-me query (FR-007)

No changes to `users`, `patients`, or `doctors` tables.

### API contract

All endpoints require `requireAuth()`.

Patient-only (`requireRole(['patient'])`):
- `POST /documents` — multipart/form-data; body: file part; success: 201 + `{ id, filename, mimeType, size, uploadedAt }`; errors: 413 FILE_TOO_LARGE, 415 UNSUPPORTED_MEDIA_TYPE, 422 MISSING_FILE, 500 STORAGE_ERROR
- `GET /documents` — success: 200 + `Array<{ id, filename, mimeType, size, uploadedAt }>`
- `DELETE /documents/:id` — success: 204; errors: 404 DOCUMENT_NOT_FOUND, 403 FORBIDDEN, 500 DELETE_FAILED
- `GET /documents/:id/shares` — success: 200 + `Array<{ doctorId, displayName, hasAccess }>`; errors: 404 DOCUMENT_NOT_FOUND, 403 FORBIDDEN
- `PUT /documents/:id/shares/:doctorId` — success: 200; errors: 404 DOCUMENT_NOT_FOUND, 404 DOCTOR_NOT_FOUND, 403 FORBIDDEN
- `DELETE /documents/:id/shares/:doctorId` — success: 200; errors: 404 DOCUMENT_NOT_FOUND, 404 DOCTOR_NOT_FOUND, 403 FORBIDDEN

Doctor-only (`requireRole(['doctor'])`):
- `GET /documents/shared-with-me` — success: 200 + `Array<{ patientId, patientDisplayName, documents: Array<{ id, filename, mimeType, size, uploadedAt }> }>`
- `GET /documents/:id/file` — success: 200 + binary stream (Content-Type: stored mimeType, Content-Disposition: attachment with original filename); errors: 403 ACCESS_DENIED, 404 DOCUMENT_NOT_FOUND

All errors follow the shape `{ error: string, message: string }`. Unauthenticated requests return 401 `{ error: 'UNAUTHORIZED', message: 'Authentication required' }` before any business logic runs.

### Multipart handling

Hono's built-in `bodyLimit` middleware is applied to the upload route, set to 10 MiB + 1 byte. Requests exceeding the limit are rejected with 413 before `parseBody()` runs — no partial file ever touches disk. MIME type validation runs after parsing, comparing the file part's content type against the allowlist `[application/pdf, image/png, image/jpeg, image/webp]`.

### Storage

`DOCUMENT_STORAGE_PATH` is added to the env config (Zod schema), defaulting to `apps/api/storage/documents/`. The API creates this directory recursively at startup. `apps/api/storage/` is added to `.gitignore`. Tests override `DOCUMENT_STORAGE_PATH` to a per-suite temp directory and clean up in `afterAll`.

### Specific interactions

**Upload flow:** `bodyLimit` check → `parseBody()` → MIME allowlist check → generate UUID filename → write stream to disk → insert `documents` row → return 201 with metadata.

**Delete flow:** Begin transaction → delete matching `document_shares` rows → delete `documents` row → commit → delete file from disk. If disk delete fails after commit: return 500 with EH-002 body indicating partial state; the committed DB state is the source of truth.

**Grant flow:** `INSERT INTO document_shares ... ON CONFLICT DO NOTHING` → return 200 regardless.

**Revoke flow:** `DELETE FROM document_shares WHERE document_id = ? AND doctor_id = ?` → return 200 regardless of whether a row was deleted.

**Download flow:** Query `document_shares` for (documentId, doctorId) → 403 if absent → open `createReadStream` on the UUID file → pipe to response with `Content-Type` and `Content-Disposition` headers set (chunked transfer, no full-file buffering).

## Testing Decisions

**What makes a good test:** Assert on HTTP status codes, response body shapes, and observable side effects (database rows, files on disk). Do not assert on internal call order or mock the database or filesystem — use real Postgres and real temp directories.

**Document storage service:** Unit tests against a real temp directory. Cover: write creates a file with UUID name; read returns correct content; delete removes the file; delete of a non-existent file throws. Clean up in `afterAll`.

**Document repository:** Integration tests against real Postgres. Cover: insert + list ordering; upsert share (no duplicate); delete share (idempotent); sharing state returns all doctors with correct `hasAccess`; shared-with-me groups by patient correctly. Truncate `documents` and `document_shares` between test files.

**Document use cases:** Integration tests against real Postgres + real temp dir. Cover: upload happy path; delete atomicity (shares and row gone, file removed); grant idempotency; revoke idempotency; download auth check; partial-delete failure path (EH-002).

**Document HTTP routes:** Hono request-level integration tests. One test per acceptance criterion (AC-001 through AC-016). Cover all auth and role boundaries, error responses, and the binary download path (verify Content-Type and Content-Disposition headers).

**Frontend — documents page:** Vitest component tests on the upload form (validation messages, submit happy path against a mocked contract). No Playwright for this module; Module 04's e2e will cover the doctor view when it embeds `SharedDocumentsList`.

**Coverage target:** 100% branch coverage on the document service layer (per NFR-005).

**Prior art:** Follow the Hono integration test pattern established by `apps/api/src/routes/health.test.ts`.

## Out of Scope

- Virus scanning or malware detection of uploaded files.
- In-browser document preview (PDF rendering, image thumbnails).
- Document versioning — replacing an existing file keeps the same id.
- Bulk upload or bulk delete.
- Time-limited or expiring document shares.
- Pagination on any endpoint — the prototype has ≤ 10 seeded accounts; all lists are returned in full.
- Cloud object storage (S3, GCS, Azure Blob) — local filesystem only.
- CDN delivery or pre-signed download URLs.
- Audit log persistence beyond structured logging to stdout.
- The wiring of `SharedDocumentsList` into Module 04 — Module 02 only exports the component; Module 04 does the import.
- Patient-to-patient document sharing or doctor-to-doctor forwarding.

## Further Notes

- The `apps/api/storage/` directory is gitignored to prevent accidental commits of patient files. No `.gitkeep` is needed because the directory is auto-created at startup.
- FR-004's sharing-state endpoint returns all doctors in the system (not paginated). This is intentional for a prototype with 5 seeded doctors. If the doctor population grows, this endpoint will need pagination.
- EC-002 (cascade delete of shares on document delete) is doubly guaranteed: the `document_shares.document_id` FK has `ON DELETE CASCADE`, and the use case explicitly deletes shares within the transaction before deleting the document row. The explicit deletion is intentional — it keeps the audit trail clear and avoids relying silently on FK cascade behavior in test assertions.
- The documents contract fills in the existing placeholder at `packages/contracts/src/documents.ts` (empty router committed in the kickoff slice). No new file is needed.
- `GET /documents/shared-with-me` is a doctor route. The path fragment `shared-with-me` must be registered before `GET /documents/:id/file` in the Hono router to avoid `:id` matching the literal string `shared-with-me`.
- The `displayName` field in sharing-state and shared-with-me responses is `patients.first_name || ' ' || patients.last_name` (for patients) and `doctors.first_name || ' ' || doctors.last_name` (for doctors). Constructed at the query layer, not in application code.
