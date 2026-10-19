# StayHub payment and invoice implementation

Implemented locally on 18 October 2026. Production Vercel and Aiven have not been changed.

## Payment flow

Booking creation retains the existing pending hold and redirects to `/bookings/[id]/payment`. “Tôi đã thanh toán” now calls the Guest-only backend, records a successful simulated deposit (`FAKE`), and confirms the booking immediately. The browser then opens `/bookings/[id]/payment/result`. Success is derived from the persisted booking/payment response, never query parameters.

The backend retains MySQL SERIALIZABLE transactions, bounded deadlock retries, per-customer and property row locks, inventory checks excluding the current hold, and the unique `Payment.bookingId` constraint. It rechecks ownership, active Guest role, booking status, expiry, room/property availability and inventory. Payment, successful attempt and audit events commit together. Repeated/concurrent requests return the same settled payment, including after subsequent cancellation, without reconfirming the booking.

Unpaid expired/cancelled bookings cannot be paid. Historical settled MoMo records are returned unchanged. Historical failed attempts do not prevent an otherwise valid new simulation. A pre-existing non-successful **Payment** obligation is deliberately not overwritten; that uncommon legacy state returns a conflict requiring operator investigation. Real MoMo deposit aggregates remain separate from simulations.

Manual recipient configuration, transaction-reference submission, QR dependencies, claim/reconciliation endpoints and the Admin reconciliation component were removed. `/admin/payments` retains its existing redirect to `/admin/bookings`; there is no verification navigation entry. Booking detail shows read-only payment attempts and recorded events, including historical MoMo information. Expiration/cancellation no longer mutate old manual attempts.

## Routes and screens

All API paths below include the existing `/api` prefix.

| Method/path                                                  | Purpose/access                                                        |
| ------------------------------------------------------------ | --------------------------------------------------------------------- |
| `GET /api/bookings/:id/payment`                              | Ownership-checked checkout data and server time; Guest                |
| `POST /api/bookings/:id/pay`                                 | Atomic, idempotent simulated deposit; active owning Guest             |
| `GET /api/bookings/:id`                                      | Persisted booking/payment state; owning Guest                         |
| `GET /api/bookings/:id/invoice`                              | Paid receipt data, including later-cancelled bookings; owning Guest   |
| `GET /api/bookings/:id/invoice.pdf`                          | Real PDF generated from the same validated data; owning Guest         |
| Existing `/api/admin/bookings/...`, `/api/host/bookings/...` | Existing scoped history/management access; no customer payment action |

Affected screens: `/bookings`, `/bookings/pending-payments`, `/bookings/[id]`, `/bookings/[id]/payment`, `/bookings/[id]/payment/result`, `/bookings/[id]/invoice`, and existing Admin booking detail through its shared component.

Desktop checkout uses bordered white surfaces on cream with separate payment and booking columns. Mobile presents the booking summary before the payment action. Processing disables the action, rapid clicks are guarded, and errors retain retry/recovery controls. Paid history is invalidated immediately after payment. Booking detail and success include invoice viewing and authenticated PDF downloads, including for later-cancelled paid bookings.

## PDF and print

PDFKit 0.20.2 generates A4 portrait PDFs in memory, on demand. Noto Sans Regular is embedded with its SIL Open Font License in `backend/src/assets/fonts/`. Nest copies the assets to `dist`; Vercel explicitly includes the font assets. No browser engine, persistent output file, or third-party payment provider is used. The renderer supports wrapping, page breaks, page numbering, Vietnamese text and four-digit years.

Customer/property/room names, address, dates/times and pricing come from booking snapshots. The recorded **Payment.amount** supplies the deposit; remaining balance is total minus that persisted payment. No current host price/address/contact is substituted into a historical receipt. Missing historical snapshot fields are stated explicitly. Host contact was not snapshotted by the existing schema and is omitted rather than replaced with mutable current account data. Payment time is displayed only when recorded. Export/generation time describes the current document export and is separate from historical payment time.

The document includes StayHub branding, booking reference, customer contacts, property/address, room, dates/times, nights, guests, quantity, current booking status, price breakdown, deposit/balance, method/status/time, and the project/non-VAT/non-real-money notice. Historical MoMo receipts retain their original method and use a historical-record notice rather than being relabelled as simulated payments.

PDF responses use `application/pdf`, an attachment filename such as `StayHub-STB-123456.pdf`, `private, no-store, max-age=0`, `Pragma: no-cache`, and `nosniff`. Invoice JSON is private/no-store. CORS exposes `Content-Disposition`. Downloads use the existing authenticated Axios client and a temporary browser Blob URL; JWTs are never put in URLs. The invoice page also offers “In hóa đơn” and an A4 print stylesheet that hides page controls and protects rows from splitting.

Library/runtime references: [PDFKit fonts and text](https://pdfkit.org/docs/text.html), [PDFKit buffered pages/streams](https://pdfkit.org/docs/getting_started.html), [Vercel file inclusion](https://vercel.com/kb/guide/how-can-i-use-files-in-serverless-functions), [Vercel NestJS](https://vercel.com/docs/frameworks/backend/nestjs).

## Data and migrations

**No Prisma schema changes or new migrations.** Existing snapshots, `Payment`, `PaymentAttempt` and `BookingEvent` support the flow. Historical payment methods/statuses and manual evidence columns remain in the schema. No production database connection, reset, seed, migration, data rewrite, backup or restore was performed for this task. Database tests used only the existing isolated MySQL container at `127.0.0.1:3310/stayhub_inventory_test`.

## Verification

| Check                                                          | Executed result                                                                                                    |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Prisma validation                                              | Passed                                                                                                             |
| Backend TypeScript, ESLint, production build                   | Passed                                                                                                             |
| Frontend TypeScript, ESLint, production build                  | Passed                                                                                                             |
| Backend complete suite with isolated MySQL                     | 86 passed, 0 failed, 0 skipped                                                                                     |
| Final focused payment/PDF/HTTP suite after backend refinements | 22 passed, 0 failed, 0 skipped                                                                                     |
| Running API integration/concurrency suite                      | 70 checks passed                                                                                                   |
| Frontend API configuration tests                               | 3 passed                                                                                                           |
| Complete Edge browser suite                                    | All 63 cases verified: 60 passed in the full run; 3 passed in focused reruns after fixture/expectation corrections |

Coverage includes unauthorized/cross-customer/Host/Admin requests; concurrent payment; one settled payment/attempt/confirmation; expiry and cancellation; stale/inactive inventory; competing room requests; preserved historical MoMo records; unpaid invoice refusal; real PDF headers/bytes; embedded Unicode font and extracted Vietnamese; A4 page dimensions and multipage content; immutable amounts/snapshots; refresh; immediate paid history; payment-page redirects; responsive layouts; downloads from success/detail; and print controls.

The first browser pass passed 42/43; its one failure was an ambiguous test locator also matching Next.js’s route announcer. The locator was scoped to the payment section. The complete 63-case run passed 60 and exposed three legacy test assumptions: an inconsistent branch-name snapshot, old deadline wording, and real-money cancellation wording. All three passed focused reruns after those fixtures/expectations were corrected; no application behavior was weakened to satisfy them. The final coverage includes double-click, unpaid-invoice and expired/cancelled UI cases. Initial sandbox-only attempts could not fetch the existing Google font or run Node test tooling; the builds/tests above ran successfully with the needed execution/network permissions.

Reproduce using an isolated MySQL URL whose database name is `stayhub_inventory_test` or `stayhub_seed_test`:

```powershell
# Backend, with DATABASE_URL and INVENTORY_TEST_DATABASE_URL targeting that isolated DB:
npm.cmd ci --prefix backend
npm.cmd run prisma:validate --prefix backend
npm.cmd run typecheck --prefix backend
npm.cmd run lint --prefix backend
npm.cmd run build --prefix backend
npm.cmd test --prefix backend
# Start the backend with the same isolated DATABASE_URL before test:e2e.
npm.cmd run test:e2e --prefix backend

# Frontend, with NEXT_PUBLIC_API_URL pointing to that running test API at build time:
npm.cmd ci --prefix frontend
npm.cmd run typecheck --prefix frontend
npm.cmd run lint --prefix frontend
npm.cmd run test:config --prefix frontend
npm.cmd run build --prefix frontend
# Start the frontend; set TEST_API_URL, PLAYWRIGHT_BASE_URL,
# INVENTORY_TEST_DATABASE_URL and the isolated fixture DEMO_PASSWORD.
npm.cmd run test:e2e --prefix frontend
```

## Impeccable review and screenshots

Used the installed [Impeccable skill](.agents/skills/impeccable/SKILL.md), its craft floor and polish guidance. Its required independent design/evidence assessments reviewed the initial desktop/mobile captures. Initial design score: 31/40; no P0 finding. Review priorities—mobile review order, invoice recovery, export-time labelling and duplicate timezone—were corrected in one batch. Two CLI target scans reported no findings. Browser detector overlays reported the cream background; this is intentional under the user's pinned StayHub palette. No persistent user-visible overlay remains.

Screenshots below were refreshed by the final real isolated payment/browser test at 1440, 768 and 375 pixels after the fixes. A bounded second visual pass confirmed the mobile summary order, receipt timestamp and desktop success layout. Physical printing was not tested; PDF A4 dimensions and browser print rules were checked programmatically.

| Screen  | Desktop                                            | Mobile                                           |
| ------- | -------------------------------------------------- | ------------------------------------------------ |
| Payment | [1440px](.local/payment-invoice-checkout-1440.png) | [375px](.local/payment-invoice-checkout-375.png) |
| Success | [1440px](.local/payment-invoice-success-1440.png)  | [375px](.local/payment-invoice-success-375.png)  |
| Invoice | [1440px](.local/payment-invoice-invoice-1440.png)  | [375px](.local/payment-invoice-invoice-375.png)  |

Questions skipped: 0 unresolved review priorities; the requested implementation already authorized the corrections. A remaining support-link enhancement for unusual legacy payment conflicts is outside this payment/receipt change; no support destination was supplied.

## Changed files

- Payment backend: `backend/src/payments/payments.service.ts`, `payments.module.ts`; removed `momo-config.ts` and `payment.dto.ts`.
- Booking/PDF backend: `backend/src/bookings/booking-access.service.ts`, `bookings.module.ts`, `bookings.service.ts`, `inventory.service.ts`; new `invoice.service.ts`, `backend/src/assets/fonts/NotoSans-Regular.ttf`, `OFL.txt`.
- Backend runtime/package: `backend/src/main.ts`, `backend/nest-cli.json`, `backend/vercel.json`, `backend/package.json`, `backend/package-lock.json`.
- Backend tests: `backend/test/business-features.test.ts`, `e2e.ts`, `inventory.test.ts`, `marketplace.test.ts`, `release-contract.test.ts`; new `invoice-pdf.test.ts`, `simulated-payments.test.ts`; removed `manual-payments.test.ts`.
- Frontend: `frontend/src/components/payment-screen.tsx`, `payment-error.tsx`, `booking-pages.tsx`, `booking-history.tsx`, `bookings-list.tsx`; new `invoice-download.tsx`; removed `booking-reconciliation.tsx`.
- Frontend shared files: `frontend/src/lib/api.ts`, `payment-state.ts`, `types.ts`, `frontend/src/app/globals.css`.
- Browser tests: `frontend/tests/business-features.spec.ts`, `motion.spec.ts`, `role-payments.spec.ts`, `inventory.spec.ts`, `ui.spec.ts`; new `payment-helper.ts` replaces `transfer-helper.ts`.
- Environment/docs: `.env.production.example`, `backend/.env.example`, `backend/.env.production.example`, `docker-compose.prod.yml`, `README.md`, `VERCEL_DEPLOYMENT.md`, this report.

## Vercel/Aiven rollout

1. Deploy this source to a **backend preview** with Root Directory `backend`, NestJS preset, `npm run build:vercel`, and the existing hosted MySQL/JWT/origin/cron configuration. Install from the updated lockfile. No payment-provider credentials are required. Remove `MOMO_RECEIVER_NAME`, `MOMO_RECEIVER_PHONE` and `MOMO_VERIFICATION_WINDOW_MINUTES` from Vercel settings and other runtime secret/config stores.
2. Verify the preview function includes Noto Sans and its license using the configured `includeFiles`. Run an authenticated PDF smoke test on the preview; local compiled-runtime success does not prove the deployed bundle. Check the content type, filename, private cache headers, Vietnamese text and download from the frontend origin.
3. Deploy the frontend preview with Root Directory `frontend`, the existing Next.js preset, and `NEXT_PUBLIC_API_URL=https://<backend-domain>/api` at **build time**. Configure backend `FRONTEND_URL` to the intended exact frontend origin. Keep JWT/database credentials server-only.
4. On preview, create a pending booking, click once, refresh success, reopen My Bookings, download/print the receipt, and verify another account/Host/Admin cannot call pay or retrieve the Guest PDF. Confirm Admin booking history remains read-only and old MoMo records stay intact.
5. This feature needs **no Aiven migration**. Before any unrelated pending migration is considered, verify the database target, obtain a recoverable backup and verify its restore, inspect migration status/SQL, test the same migration on an isolated restore, approve only the reviewed safe changes, then deploy and verify. Never run `migrate reset`, `db push`, or a development seed against production.
6. Promote the verified backend and frontend previews together, then repeat the authenticated smoke test on production. Roll back application deployments if needed; do not delete payment records or reverse history to roll back UI behavior.

Remaining rollout work: preview/production deployments, hosted font-bundle verification and production smoke tests. No claim is made that Vercel or Aiven has been updated. Missing historical host-contact/identity snapshots cannot be reconstructed safely and are not invented.
