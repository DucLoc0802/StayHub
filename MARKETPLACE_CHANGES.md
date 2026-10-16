# Marketplace implementation — 16 October 2026

## Delivered behavior

1. **Admin booking history:** server-side search by reference, customer and property; booking/payment status, Host, property and check-in date filters; pagination and resettable empty states. `/admin/bookings/[id]` shows booking snapshots, payment attempts and chronological recorded events. All Admin APIs require an active Admin. No confirmation/completion mutation was added.
2. **Realistic repeatable demo:** four active Host accounts own five fictional properties, with three independent owners and one two-property business. Deterministic IDs, bcrypt passwords supplied through `DEMO_PASSWORD`, two customers, Admin, varied room inventory, seven booking scenarios, and no generated public reviews.
3. **Host branch management:** a single-property owner needs no selector. Multiple-property owners select their own branch; dashboard, room/price editor and bookings follow that selection. API filters always intersect Host ownership; a foreign property ID is rejected. Existing room mutation ownership checks remain enforced.
4. **Customer payment:** review customer/stay/price details before creating a hold, then navigate to dedicated payment and result routes. Existing FAKE/QR integration stays explicitly labeled as demo. The result fetches persisted backend state; URL parameters never establish payment success. Failures remain retryable before expiry, with recorded reasons.
5. **Booking visibility and lifecycle:** My Bookings requires a successful initial deposit, including paid cancellations. Valid unpaid holds are recoverable separately. Expiry remains timestamp-backed, checked during access/creation/payment/availability, and processed by a protected scheduled endpoint. Existing MySQL serializable transactions, per-Guest locks, property locks and deadlock retries protect reservations and payments.
6. **Naming/presentation:** consistent property IDs and natural Vietnamese names, two recognizable Hoàng Thành branches, responsive Admin history and checkout, accessible labels and clear Vietnamese empty/error/result states. StayHub's existing orange, cream and typography are preserved using the Impeccable refinement guidance.

## Seed distribution

| Host / login                                       | Property                | Inventory                       |
| -------------------------------------------------- | ----------------------- | ------------------------------- |
| Trần Thảo An / `host@stayhub.local`                | Homestay An Nhiên       | 1 entire-home room type, 1 unit |
| Nguyễn Minh Châu / `host.east@stayhub.local`       | Khách sạn Minh Châu     | 3 room types, 9 units           |
| Lê Bình An / `host.south@stayhub.local`            | Nhà nghỉ Bình An        | 3 room types, 9 units           |
| Hoàng Thanh Tùng / `host.hoangthanh@stayhub.local` | Khách sạn Hoàng Thành 1 | 3 room types, 9 units           |
| Same Hoàng Thanh Tùng account                      | Khách sạn Hoàng Thành 2 | 3 room types, 9 units           |

New database totals: **4 Hosts, 5 properties, 13 room types, 37 units, 14 amenities, 2 customers, 1 Admin, 7 bookings**. Demo booking codes are `STB-DEMO-V2-1` through `STB-DEMO-V2-7`. Scenarios include future paid stays, a paid cancellation, an expired unpaid hold, two pending holds (one failed attempt), and a historical paid stay. All amounts and transitions are internally consistent; creation checks existing nightly inventory before inserting a fixture.

`DEMO_PASSWORD` is required (8+ characters, at most 72 UTF-8 bytes); no password is embedded in seed source. Existing account passwords, role decisions, property edits, room edits and booking history are preserved. Re-running does not move demo dates forward or recreate expired holds. Existing ID ownership conflicts fail explicitly instead of reassigning someone else's property.

On an upgraded database, only exact fingerprints in `backend/prisma/legacy-demo-data.ts` are archived by setting property status to INACTIVE. Unrelated/user-edited properties and all historical bookings/payments remain. The one old generated review is removed only if its fixed ID, booking ID and exact demo content match. An upgraded database can retain additional old accounts and archived/edited listings; the five-property distribution describes the new seed-managed catalog. No broad cleanup or production seed was run.

## Persisted model and migration

`backend/prisma/migrations/202610160001_booking_audit/migration.sql` adds:

- `BookingEvent`: recorded status transitions with booking ID, type, status and timestamp; indexed by booking/time.
- `PaymentAttempt`: immutable success/failure attempts with amount, method, optional safe failure reason and timestamp; indexed by booking/time.
- Existing Payment rows copied into attempts using their recorded `paidAt` or `createdAt`. Existing Booking/Payment records, values, states and relationships are untouched.

`Payment.bookingId` remains unique: one settled obligation per booking. A serialized retry returns the existing successful payment and does not append another successful attempt. A failed demo attempt changes neither booking confirmation nor payment settlement. Existing failed Payment records can be retried while their original attempt remains in history.

For old bookings, the timeline uses actual creation, payment, cancellation and expiration timestamps. It never infers confirmation, rejection or completion timestamps from the current status or checkout date. New transitions write audit events in the same transaction as the state change.

The existing state machine is retained: `PENDING_PAYMENT → CONFIRMED` on a successful deposit, with `CANCELLED` and `EXPIRED` terminal alternatives. Host confirmation is automatic after payment. This application did not have separate awaiting-Host, rejected-booking or completed-booking states; those new business processes were not invented. Past paid stays remain visible in history. Account approval/rejection remains separate from booking status.

## Routes and APIs

Frontend:

- `/admin/bookings`: expanded read-only search/filter list.
- `/admin/bookings/[id]`: new dedicated Admin detail/history.
- `/host`, `/host/bookings`, `/host/properties/[id]/edit`: shared ownership-scoped branch selection.
- `/bookings/[id]/payment`: dedicated QR/demo payment with amount payable and expiry.
- `/bookings/[id]/payment/result`: new persisted-state success/failure/cancel/expiry result.
- `/bookings/pending-payments`: new recovery list, separate from paid `/bookings`.
- `/bookings/[id]`: recorded history and booking information.

Backend paths below use the existing `/api` prefix:

| Method / API                                          | Behavior                                                                                                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /admin/bookings`                                 | Existing pagination plus `hostId`, `propertyId`, `paymentStatus=SUCCESS/FAILED/UNPAID`, `q`, `status`, `from`, `to`; dates filter check-in inclusively |
| `GET /admin/bookings/:id`                             | New Admin-only detail with attempts/events/timeline                                                                                                    |
| `GET /admin/booking-filters`                          | New minimal property/Host names and IDs for Admin selectors                                                                                            |
| `GET /host/bookings?propertyId=...`                   | Optional property filter intersected with authenticated ownership                                                                                      |
| `GET /bookings/my`                                    | Only bookings with successful initial payment                                                                                                          |
| `GET /bookings/pending-payments`                      | New authenticated valid unpaid holds                                                                                                                   |
| `POST /bookings/:id/pay`                              | Existing FAKE payment, idempotent after success; optional `outcome: SUCCESS/FAILED` for explicit demo scenarios                                        |
| `GET /bookings/:id`, `GET /bookings/:id/payment-demo` | Existing scoped detail/QR, with consistent attempts and events; failed attempts remain eligible until expiry                                           |
| `GET /internal/expire-bookings`                       | New scheduler endpoint requiring `Authorization: Bearer <CRON_SECRET>`                                                                                 |

Flow: **detail → room/dates/guests → booking review → persisted pending-payment booking → payment → result → “Xem đặt phòng của tôi” after success**. Failure stays in checkout with retry; expired or canceled holds cannot be paid. Visiting a result URL never executes payment.

## Deployment

1. Back up the target database using the existing deployment process. Apply the additive migration before starting the updated API:

   ```powershell
   npm.cmd run prisma:generate --prefix backend
   npm.cmd run prisma:migrate --prefix backend
   npm.cmd run build --prefix backend
   npm.cmd run build --prefix frontend
   ```

2. Set a private `CRON_SECRET` on the backend. `backend/vercel.json` configures an authenticated expiration call every ten minutes. Use a hosting plan/scheduler that supports that cadence; for other hosts, send an authenticated GET to `/api/internal/expire-bookings` periodically. Never place this secret in a `NEXT_PUBLIC_*` variable. `docker-compose.prod.yml` now passes the secret to the API.
3. Expiry processing is idempotent across repeated/multiple instances: only pending rows past their persistent deadline are transitioned, under the Guest lock. Each invocation processes up to 100 distinct overdue Guests, so recurring calls drain backlogs. Availability ignores overdue holds immediately even before the job runs, and payment always rechecks expiry and inventory. There is no application interval or Vercel in-memory expiry timer.
4. Seed **only local/development** databases explicitly with `DEMO_PASSWORD` set:

   ```powershell
   npm.cmd run build:seed --prefix backend
   npm.cmd run prisma:seed --prefix backend
   ```

   Production mode refuses the seed before connecting. Existing production deploy scripts do not run it. Existing local Compose startup seeds development data and therefore also requires `DEMO_PASSWORD` in `backend/.env`.

5. Keep the existing frontend API URL, backend authentication and MySQL TLS configuration. Rebuild the frontend with its deployment API URL. No production database, payment provider or hosted deployment was changed during this implementation.

## Verification

Validation ran against a separate local MySQL 8 container and the `stayhub_inventory_test` database, never the application/production database.

| Executed check                                                       | Final result                                                                           |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Prisma generate and validate                                         | Pass                                                                                   |
| All six versioned migrations on a new MySQL test database            | Pass                                                                                   |
| Upgrade migration with existing Booking/Payment rows                 | Pass; values preserved, original payment timestamp copied, no fabricated status events |
| Backend build and compiled seed build                                | Pass                                                                                   |
| Frontend production build                                            | Pass                                                                                   |
| Backend and frontend TypeScript                                      | Pass                                                                                   |
| Root lint (backend and frontend)                                     | Pass                                                                                   |
| Backend tests with MySQL integration enabled                         | **76 passed, 0 failed, 0 skipped**                                                     |
| Standalone API/concurrency end-to-end checks                         | **68 passed**                                                                          |
| Full Playwright suite against the production build and real test API | **45 passed**                                                                          |
| Frontend API configuration tests                                     | **3 passed**                                                                           |
| Diff whitespace check                                                | Pass                                                                                   |

Desktop (1440px) and mobile (375px) screenshots of Admin history, Host selection, actual demo QR checkout and payment results were inspected; existing suites also cover tablet, keyboard, touch and reduced-motion behavior. Final full browser run took 1.9 minutes. Snapshot artifacts are under ignored `.local/marketplace-*.png`; tracked screenshots overwritten by older tests were restored.

The restricted environment initially prevented `tsx` from reading Windows user information and Next.js from fetching the existing Google font. The successful runs used approved execution access. Earlier development-mode browser failures included outdated seed/name expectations and two motion checks during hot reload; the final stable production run passes every browser test. Prisma still prints the existing package.json seed-configuration deprecation notice; it does not fail validation/builds.

Reproduce backend checks with `INVENTORY_TEST_DATABASE_URL` pointing to a migrated isolated `stayhub_inventory_test` or `stayhub_seed_test` database. Compile the backend and seed first. Browser checks use `PLAYWRIGHT_BASE_URL`, `TEST_API_URL`, that same isolated database and `DEMO_PASSWORD`; seeded accounts must use that password. The live browser tests mutate/clean only their own fixtures, apart from the explicit demo customer cancellation journey in `ui.spec.ts`.

## Files changed

- Data: `backend/prisma/{schema.prisma,demo-data.ts,legacy-demo-data.ts,seed.ts}`, new audit migration.
- API: `backend/src/admin/management.module.ts`, `backend/src/bookings/{bookings.service.ts,bookings.module.ts,booking.dto.ts,booking-access.service.ts,booking-policy.ts,inventory.service.ts,inventory.module.ts,expiration.controller.ts}`, `backend/src/payments/payments.service.ts`.
- UI: `frontend/src/components/{admin-management.tsx,booking-card.tsx,booking-pages.tsx,booking-history.tsx,bookings-list.tsx,header.tsx,host-property-scope.tsx}`, `frontend/src/lib/{api.ts,types.ts}`, Host layouts/dashboard and booking pages/routes listed above.
- Tests: backend marketplace, inventory, seed and HTTP/API suites; frontend booking time, business feature, inventory, marketplace, motion, URL and UI suites.
- Operations/docs: backend environment examples, `backend/vercel.json`, `docker-compose.prod.yml`, `README.md`, this report.
