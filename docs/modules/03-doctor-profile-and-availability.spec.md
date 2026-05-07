# doctor-profile-and-availability Feature Specification

## Summary
This module enables doctors to manage their public profile and publish discrete bookable time slots, while exposing public read endpoints for patient-facing doctor and slot discovery consumed by the booking flow (Module 04). It enforces role-based access control, rejects invalid or overlapping slot creation within a single transaction, and prevents deletion of already-booked slots. The feature provides the foundational availability data layer that Module 04 depends on to complete the appointment booking lifecycle.

## Functional Requirements
1. FR-001: A doctor can retrieve their own profile and receive a JSON response containing their user ID, first name, last name, and specialization fields with HTTP 200.
2. FR-002: A doctor can update their profile by submitting a PATCH request with any combination of first_name, last_name, and specialization; the API persists the changes and returns the updated profile with HTTP 200.
3. FR-003: A doctor can create a new availability slot by submitting a POST request with starts_at and ends_at ISO-8601 UTC datetimes; on success the API returns the created slot with HTTP 201 and the slot appears in the doctor's availability list with status 'free'.
4. FR-004: A doctor can retrieve all of their own slots (both 'free' and 'booked') via GET /doctors/me/slots; the response is an array sorted ascending by starts_at with HTTP 200.
5. FR-005: A doctor can delete a slot that has status 'free' via DELETE /doctors/{doctorId}/slots/{slotId}; on success the API returns HTTP 204 and the slot no longer appears in any availability list.
6. FR-006: Any authenticated user can list all doctors via GET /doctors with HTTP 200; the endpoint accepts an optional case-insensitive query parameter 'search' that filters results by matching against first_name, last_name, or specialization using a substring match.
7. FR-007: Any authenticated user can retrieve upcoming free slots for a specific doctor via GET /doctors/{doctorId}/slots?upcoming=true; the API returns only slots with status 'free' and starts_at >= current UTC time, sorted ascending by starts_at, with HTTP 200.
8. FR-008: Overlap detection for new slot creation is enforced within a single database transaction using SELECT FOR UPDATE; a new slot (s, e) overlaps an existing slot if s < existing.ends_at AND e > existing.starts_at, and the transaction is rolled back on detection.

## Non-Functional Requirements
- NFR-001: All read endpoints (GET /doctors, GET /doctors/{id}/slots) must respond in under 200 ms at p95 under a load of 50 concurrent requests against a dataset of 1,000 doctors each with up to 200 slots.
- NFR-002: Slot creation and deletion endpoints must complete their database transaction and return a response in under 300 ms at p95 under normal load conditions.
- NFR-003: The API must emit a structured log entry (JSON, severity INFO or ERROR) for every slot creation, slot deletion, and profile update, including the acting user's ID and the affected resource ID, enabling audit trail reconstruction.
- NFR-004: The overlap-check transaction must use SELECT FOR UPDATE to prevent phantom reads; under concurrent creation of two overlapping slots the system must commit exactly one and reject the other with HTTP 409, with no data corruption.

## Edge Cases
- EC-001: Slot with ends_at exactly equal to starts_at of an existing slot (adjacent, not overlapping): the API must accept the new slot with HTTP 201, because the condition s < existing.ends_at AND e > existing.starts_at is not satisfied when e == existing.starts_at.
- EC-002: GET /doctors/{doctorId}/slots?upcoming=true called at the exact UTC second that a slot's starts_at equals the current time: that slot must be included in the response (filter is starts_at >= now, inclusive).
- EC-003: Doctor submits a PATCH profile update with an empty object body (no fields): the API must return HTTP 200 with the current profile unchanged; no database write is required.
- EC-004: GET /doctors?search= (empty string search parameter): the API must return all doctors without filtering, identical to omitting the search parameter, with HTTP 200.
- EC-005: Two concurrent POST requests from the same doctor for identical starts_at/ends_at values arrive simultaneously: exactly one must succeed with HTTP 201 and the other must fail with HTTP 409 due to the SELECT FOR UPDATE transaction serialization.

## Validation Rules
- VR-001: Slot creation rejects any request where ends_at <= starts_at; the API returns HTTP 422 with error code 'INVALID_SLOT_RANGE' and message 'ends_at must be strictly after starts_at'.
- VR-002: Slot creation rejects any request where starts_at or ends_at is not a valid ISO-8601 UTC datetime string; the API returns HTTP 422 with error code 'INVALID_DATETIME_FORMAT' and message 'starts_at and ends_at must be valid ISO-8601 UTC datetime strings'.
- VR-003: Profile update rejects any request where first_name or last_name is present but is an empty string or exceeds 100 characters; the API returns HTTP 422 with error code 'INVALID_FIELD_LENGTH' and message identifying the offending field.
- VR-004: Profile update rejects any request where specialization is present but exceeds 200 characters; the API returns HTTP 422 with error code 'INVALID_FIELD_LENGTH' and message 'specialization must not exceed 200 characters'.

## Error Handling
- EH-001: A doctor attempts to delete a slot whose status is 'booked' (i.e., the slot has been reserved by a patient via Module 04): HTTP 409 with error code 'SLOT_ALREADY_BOOKED' and message 'Cannot delete a slot that has already been booked.'. No database mutation occurs; the slot remains in 'booked' status.
- EH-002: A doctor attempts to create a new slot that overlaps with one or more of their existing slots, detected during the SELECT FOR UPDATE transaction: HTTP 409 with error code 'SLOT_OVERLAP' and message 'The requested slot overlaps with an existing slot.'. The transaction is rolled back; no slot is persisted.
- EH-003: An authenticated user requests GET /doctors/{doctorId}/slots for a doctorId that does not exist in the database: HTTP 404 with error code 'DOCTOR_NOT_FOUND' and message 'No doctor found with the specified ID.'. No side effects.
- EH-004: A doctor attempts to update or delete a slot that belongs to a different doctor (doctorId in path does not match the authenticated user's doctor record): HTTP 403 with error code 'FORBIDDEN' and message 'You do not have permission to modify this resource.'. No database mutation occurs.
- EH-005: The database connection is unavailable or times out during any slot or profile write operation: HTTP 503 with error code 'SERVICE_UNAVAILABLE' and message 'A database error occurred; please retry.'. The transaction is rolled back if partially begun; no partial state is persisted.

## Authorization
- AUTH-001: A user with role 'doctor' is permitted to call POST /doctors/me/slots, PATCH /doctors/me/profile, GET /doctors/me/slots, and DELETE /doctors/{doctorId}/slots/{slotId} (for their own slots). Requests from users with any other role to these management endpoints return HTTP 403 with error code 'FORBIDDEN'.
- AUTH-002: A user with role 'patient' or 'doctor' (any authenticated user) is permitted to call GET /doctors and GET /doctors/{doctorId}/slots?upcoming=true. Unauthenticated requests to these endpoints return HTTP 401 with error code 'UNAUTHORIZED'.
- AUTH-003: A doctor is permitted to delete only slots where the slot's doctor_id matches their own authenticated user ID. Attempting to delete a slot belonging to a different doctor returns HTTP 403 with error code 'FORBIDDEN', regardless of the doctor role claim.
- AUTH-004: Frontend route guards must redirect any authenticated user with role 'patient' who attempts to navigate to any doctor management route (e.g., /doctor/profile, /doctor/slots) to the patient home page, preventing rendering of the management UI entirely.

## Acceptance Criteria
- [ ] AC-001 (FR-001): Given a doctor is authenticated, when they send GET /doctors/me/profile, then the server returns HTTP 200 with a JSON body containing the doctor's user ID, first_name, last_name, and specialization fields.
- [ ] AC-002 (FR-002): Given a doctor is authenticated and has an existing profile, when they send PATCH /doctors/me/profile with a JSON body containing only a new value for first_name, then the server persists the updated first_name, leaves last_name and specialization unchanged, and returns HTTP 200 with the full updated profile.
- [ ] AC-003 (FR-002): Given a doctor is authenticated and has an existing profile, when they send PATCH /doctors/me/profile with a JSON body containing new values for first_name, last_name, and specialization, then the server persists all three changes and returns HTTP 200 with the updated profile reflecting all submitted values.
- [ ] AC-004 (FR-003): Given a doctor is authenticated, when they send POST /doctors/me/slots with a JSON body containing a valid starts_at ISO-8601 UTC datetime and an ends_at ISO-8601 UTC datetime that is strictly after starts_at, then the server returns HTTP 201 with a JSON body representing the created slot including its ID, starts_at, ends_at, and status 'free'.
- [ ] AC-005 (FR-003): Given a doctor is authenticated and has just created a new slot via POST /doctors/me/slots with a valid time range, when they send GET /doctors/me/slots, then the response array contains the newly created slot with status 'free'.
- [ ] AC-006 (FR-004): Given a doctor is authenticated and has both 'free' and 'booked' slots, when they send GET /doctors/me/slots, then the server returns HTTP 200 with a JSON array containing all of the doctor's slots regardless of status, sorted in ascending order by starts_at.
- [ ] AC-007 (FR-005): Given a doctor is authenticated and owns a slot with status 'free', when they send DELETE /doctors/{doctorId}/slots/{slotId} using their own doctorId and that slot's ID, then the server returns HTTP 204 and a subsequent GET /doctors/me/slots response does not include the deleted slot.
- [ ] AC-008 (FR-006): Given an authenticated user (patient or doctor), when they send GET /doctors without a search parameter, then the server returns HTTP 200 with a JSON array containing all registered doctors.
- [ ] AC-009 (FR-006): Given an authenticated user, when they send GET /doctors?search=cardio (case-insensitive), then the server returns HTTP 200 with a JSON array containing only doctors whose first_name, last_name, or specialization contains the substring 'cardio' in a case-insensitive match, and excludes doctors with no matching fields.
- [ ] AC-010 (FR-007): Given an authenticated user and a doctor who has at least one 'free' slot with starts_at greater than or equal to the current UTC time and at least one slot with starts_at in the past, when they send GET /doctors/{doctorId}/slots?upcoming=true, then the server returns HTTP 200 with a JSON array containing only the future 'free' slot(s) sorted ascending by starts_at, with no past slots and no 'booked' slots included.
- [ ] AC-011 (FR-007): Given an authenticated user, when they send GET /doctors/{doctorId}/slots?upcoming=true for a doctorId that exists and has no free upcoming slots, then the server returns HTTP 200 with an empty JSON array.
- [ ] AC-012 (FR-008): Given a doctor is authenticated and has an existing slot from 09:00 to 10:00 UTC, when they send POST /doctors/me/slots with starts_at 09:30 UTC and ends_at 10:30 UTC (overlapping the existing slot), then the database transaction is rolled back, no new slot is persisted, and the server returns HTTP 409 with error code 'SLOT_OVERLAP' and message 'The requested slot overlaps with an existing slot.'.
- [ ] AC-013 (FR-008): Given two concurrent POST /doctors/me/slots requests from the same doctor both specifying identical starts_at and ends_at values, when both requests are processed simultaneously, then exactly one request succeeds with HTTP 201 and exactly one request fails with HTTP 409 and error code 'SLOT_OVERLAP', with no duplicate slots persisted in the database.
