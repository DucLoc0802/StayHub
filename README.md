# StayHub

StayHub is a focused accommodation booking Mini Project for Ho Chi Minh City. A property is one independently bookable homestay or hotel unit. The application supports guests, approved hosts, and a minimal host-approval workflow for administrators.

## Features

- Vietnamese, responsive Next.js interface with a soft pink StayHub design.
- Search by property name/district, price and amenity filters, price sorting, and pagination.
- Property galleries, amenities, date-range selection, and backend-authoritative pricing.
- JWT email/password authentication with Guest, Host, and Admin authorization.
- Host approval and ownership-protected property management.
- Booking price/deposit snapshots, fake deposit payment, availability re-check, and non-refundable confirmed cancellation.
- Swagger, Prisma seed, Postman collection, and project documentation.

## Technology

- Frontend: Next.js App Router, TypeScript, Tailwind CSS, Radix/shadcn-style primitives, React Hook Form, Zod, Axios, TanStack Query, Sonner, React Day Picker.
- Backend: NestJS, TypeScript, Prisma, PostgreSQL, Passport JWT, class-validator, bcrypt, Swagger.
- Infrastructure: Docker Compose for PostgreSQL only.

## Structure

```text
StayHub/
├── frontend/             Next.js application
├── backend/              NestJS API and Prisma
├── docs/                 Architecture, flows, tests, and Postman
├── docker-compose.yml    PostgreSQL development service
└── PROJECT_PLAN.md       Implementation status
```

## Prerequisites

- Node.js 20 or newer and npm
- Docker Desktop with Docker Compose

## Setup

1. Start PostgreSQL:

   ```bash
   docker compose up -d postgres
   ```

2. Configure the backend:

   ```bash
   cd backend
   cp .env.example .env
   npm install
   npx prisma generate
   npx prisma migrate deploy
   npm run prisma:seed
   npm run start:dev
   ```

3. In another terminal, configure the frontend:

   ```bash
   cd frontend
   cp .env.example .env.local
   npm install
   npm run dev
   ```

On Windows PowerShell systems that block `npm.ps1`, use `npm.cmd` and `npx.cmd` for the same commands.

## URLs

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001/api
- Swagger: http://localhost:3001/api/docs

## Demo accounts

All seeded accounts use password `StayHub123!`.

| Role | Email | Initial status |
|---|---|---|
| Admin | `admin@stayhub.local` | Active |
| Guest | `guest@stayhub.local` | Active |
| Host | `host@stayhub.local` | Active |
| Host | `pendinghost@stayhub.local` | Pending |

These credentials are development-only. Never use them in production.

## Quality commands

Run in each application directory:

```bash
npm run lint
npm run build
```

Backend-specific validation:

```bash
npx prisma validate
npx prisma migrate status
```

## Postman

Import [the collection](docs/postman/StayHub.postman_collection.json) and [environment](docs/postman/StayHub.postman_environment.json). Select the environment, run a login request, and its test script stores `accessToken`. Property/booking create requests similarly capture their identifiers.

## Important business rules

- One property is exactly one bookable unit; there is no room-inventory hierarchy.
- Guests are active immediately. Hosts start pending and cannot manage properties until approved.
- Booking prices and property-specific deposit percentages are snapshotted when a booking is created.
- Checkout is exclusive. Adjacent bookings are allowed; confirmed overlapping bookings are not.
- Payment charges only the deposit. Availability is checked again inside a serializable transaction immediately before confirmation.
- Cancelling a confirmed booking does not delete or refund its successful payment.
- No reviews, ratings, maps, real payments, host booking approval, or refresh tokens are included.

See [architecture](docs/architecture.md), [ERD](docs/erd.md), [business flow](docs/business-flow.md), and [test cases](docs/test-cases.md).
