# Drivary Car

Website for a car rental agency: public fleet showcase with a reservation
flow that hands off to WhatsApp, plus a password-protected admin dashboard
for managing vehicles, reservations, handover checklists and PDF contracts.

## Features

- Public site: vehicle catalog with per-vehicle detail pages, tiered
  pricing (daily / 15-day / 30-day rates), date-based availability
  (only confirmed reservations block a vehicle)
- Reservation flow: form -> server action -> WhatsApp message to the
  agency; honeypot spam protection
- Admin dashboard (`/admin`): vehicle CRUD with image upload to Supabase
  Storage, reservation pipeline (pending -> contacted -> confirmed ->
  cancelled), handover completion (plate, mileage, damage map, equipment
  checklist), full contract editing with manual billing overrides
- Contract PDF generation (`@react-pdf/renderer`), numbered
  ARC-YYYY-NNNNN on confirmation
- Login rate limiting: 5 failed attempts per IP -> 15 min lockout

## Tech stack

Next.js 16 (App Router) - React 19 - Tailwind CSS 4 - postgres.js
(PostgreSQL) - Supabase Storage - Framer Motion - lucide-react

## Getting started

1. Install dependencies:

   npm install

2. Create a PostgreSQL database and load the schema:

   - Fresh database: run `schema.sql`
   - Existing database: run the files in `migrations/` in order

3. Set environment variables (`.env.local`):

   DATABASE_URL=postgres://user:password@host:5432/dbname
   ADMIN_PASSWORD=choose-a-long-password
   ADMIN_SESSION_SECRET=choose-a-long-random-secret
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

   Create the `vehicles` storage bucket in Supabase (public bucket for
   vehicle images). If ADMIN_PASSWORD / ADMIN_SESSION_SECRET are missing,
   the admin panel locks itself (fail closed).

4. Run the dev server:

   npm run dev

## Scripts

- npm run dev - development server
- npm run build / npm start - production build / serve
- npm run lint - ESLint

## Project structure

- app/ - pages and server actions (App Router)
- app/admin/ - back-office (protected by middleware.ts)
- app/vehicules/ - public catalog and reservation action
- components/ - UI components (home, vehicules, admin, layout)
- lib/db.ts - all data access (parameterized SQL)
- lib/auth.ts - admin session + login rate limiting
- lib/contract.ts, lib/pricing.ts - contract logic and price tiers
- lib/pdf/ContractDocument.tsx - contract PDF template
- migrations/ - incremental SQL migrations

## Deployment

Deploys as a standard Next.js app (Vercel recommended). Set the same
environment variables in the hosting dashboard. Note: the login rate
limit is in-memory, so it resets on each redeploy/server restart.

## License

MIT (see LICENSE).
