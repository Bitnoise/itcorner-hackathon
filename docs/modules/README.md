# MedBridge — Module Index

This directory splits the MedBridge prototype (see [`../../quest.md`](../../quest.md)) into independently-deliverable feature modules so a team of 3 full-stack developers can work in parallel.

## Shared kickoff (precondition for all modules)

Before any module starts, the team pairs together on:

- pnpm monorepo scaffolding (`apps/api`, `apps/web`, `packages/contracts`)
- Postgres + Drizzle schema bootstrap (users + role tables)
- Login (email + password), session/cookie auth, role middleware (patient / doctor)
- Pre-seeded user base: at least one patient and two doctors with distinct specializations
- ts-rest contract package skeleton — empty contract surface for every module's endpoints, so each team can mock the dependent modules and unblock parallel work
- `pnpm dev` brings up Postgres + api + web; `pnpm verify` runs typecheck + tests + lint

The kickoff is not a module document — it is assumed in place when the modules below begin.

## Modules

| # | Module | One-liner |
|---|--------|-----------|
| 01 | [Patient Profile](./01-patient-profile.md) | Patient views and edits their health profile. |
| 02 | [Patient Documents & Sharing](./02-patient-documents-and-sharing.md) | Patient uploads documents and grants per-doctor access. |
| 03 | [Doctor Profile & Availability](./03-doctor-profile-and-availability.md) | Doctor manages profile and publishes individual bookable slots. |
| 04 | [Appointments & Booking](./04-appointments-and-booking.md) | Patient books a slot; doctor sees schedule with patient context. |
| 05 | [Visit Summary](./05-visit-summary.md) | Doctor writes summary and marks visit completed; patient reads it. |

## Dependency graph

```
[Shared kickoff: scaffolding + auth + seed users + contracts skeleton]
         │
         ├──► 01 Patient Profile        (independent)
         ├──► 02 Patient Documents      (independent)
         ├──► 03 Doctor Profile/Slots   (independent)
         │
         ├──► 04 Appointments & Booking (depends on 01 + 02 + 03 read-side endpoints)
         │
         └──► 05 Visit Summary          (depends on 04)
```

## Suggested parallelization for 3 devs

This is illustrative — the team is free to redistribute.

| Dev | Wave 1 (parallel)         | Wave 2                                  |
|-----|---------------------------|-----------------------------------------|
| A   | 01 Patient Profile        | 04 Appointments & Booking — patient UI  |
| B   | 02 Patient Documents      | 04 Appointments & Booking — doctor UI   |
| C   | 03 Doctor Profile/Slots   | 05 Visit Summary                        |

Because the kickoff defines all ts-rest contracts upfront, every team can mock the read-side endpoints they depend on and start UI work without waiting on the producing module.

## Module document conventions

Every module file contains:

- **Summary** — one-paragraph description.
- **Acceptance Criteria** — observable, testable outcomes.
- **Functional Requirements** — DB / API / UI surface.
- **Non-Functional Requirements** — contracts, tests, validation, perf, security notes.
- **Depends On** — explicit dependencies on other modules or the kickoff.
