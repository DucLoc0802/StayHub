# StayHub Implementation Plan

Status legend: `TODO`, `IN PROGRESS`, `DONE`, `BLOCKED (environment)`.

| Phase | Scope | Status |
|---|---|---|
| 0 | Environment inspection and plan | DONE |
| 1 | Repository scaffold | DONE |
| 2 | PostgreSQL via Docker Compose | BLOCKED (environment: Docker unavailable) |
| 3 | Prisma schema, migration, seed | BLOCKED (schema/client validated; migration/seed require PostgreSQL) |
| 4-10 | NestJS foundation, auth, admin, properties, bookings, payments, cancellation | DONE |
| 11-16 | Next.js foundation and public/auth/booking/host/admin UI | DONE |
| 17 | Responsive and UX pass | DONE (production build and HTTP render; interactive browser runtime unavailable) |
| 18 | Postman and documentation | DONE |
| 19 | Lint, build, Prisma checks | DONE |
| 20 | End-to-end smoke test | BLOCKED (database unavailable; frontend HTTP smoke passed) |
| 21 | Final audit | DONE |

## Architecture decisions

- Two independent TypeScript applications: Next.js App Router frontend and NestJS REST backend.
- PostgreSQL is the only database; Prisma owns schema, migrations, and seed data.
- JWT access token authentication stored in browser localStorage as explicitly required.
- One `Property` is one bookable unit. Booking totals and deposit percentages are snapshotted.
- Payment confirmation performs an overlap re-check in a serializable transaction.
- Vietnamese presentation text; English code, API, and database identifiers.

## Environment notes

- Node.js: `v24.11.1`.
- Use `npm.cmd` because local PowerShell execution policy blocks `npm.ps1`.
- Docker CLI was not found during Phase 0, so container/database verification requires Docker Desktop to be installed or exposed on PATH.
