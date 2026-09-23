# Drivary Car â€” Code Review Report

Date: 2026-09-12
Scope: full-codebase review (security, error handling, data leaks, deployment traps)
Method: source audit + `npm run lint` + `npm run build` + runtime smoke tests + git-history scan for secrets

Result: lint clean, production build passes, no committed secrets found. The issues below are listed by severity.

---

## HIGH

- `scripts/init-db.mjs`:
- H1 â€” `scripts/init-db.mjs` is destructive and creates an outdated (broken) schema
- `DROP TABLE IF EXISTS reservations` then recreates tables **without** the columns the code depends on: `min_rental_days`, `price_extended_15`, `price_monthly_30`, `fait_a`, `override_total_ht/tva/ttc`, `signing_token`, `signed_at`, etc.
- Uses `ssl: "require"`, which fails against any PostgreSQL that doesn't have SSL enabled (local dev, most managed DBs unless configured).
- Anyone running it as the "init" tool gets a schema that immediately crashes the app ("column does not exist").

Fix: delete the script or align it with `schema.sql` (which is correct and kept up to date). Document `schema.sql` as the single source of truth for fresh installs.

### H2 â€” Login / signing rate limit trusts a spoofable header

`lib/auth.ts` + `app/admin/actions.ts:27` + `app/sign/[token]/actions.ts:22` derive the per-IP key from:

```
h.get("x-forwarded-for")?.split(",")[0]
```

`x-forwarded-for` is written by the client when the app is hit directly (and the first hop is not always trustworthy behind every proxy/CDN).

Impact:

- An attacker can bypass the 5-attempt lockout by rotating the header value.
- An attacker can lock out the legitimate admin by failing 5 times while spoofing the admin's IP (DoS).

Fix: use the platform's client-IP field (Vercel: `x-vercel-forwarded-for` or `request.ip` from `NextRequest`). Either way, also rate-limit by the session cookie / a device fingerprint as a second factor.

### H3 â€” Public reservation endpoint is unrate-limited write path

`createReservationAction` (`app/vehicules/actions.ts`) inserts a DB row with no per-IP/per-form rate limit. The honeypot only stops naive bots. Anyone can spam the `reservations` table with junk leads (data pollution, storage growth, noise for the admin).

Fix: add the same in-memory rate limiter used for login (e.g. max ~3â€“5 submissions per IP per hour), and set sensible max lengths on free-text fields.

---

## MEDIUM

### M1 â€” MySQL-grade issue: image uploads validated by declared MIME type only

`app/admin/actions.ts:77` checks `file.type`, which is client-provided and trivially spoofed. It does not inspect the actual file content.
Related: `next.config.ts` enables `dangerouslyAllowSVG: true` in `next/image`. An SVG smuggled in as `image/png` would be rendered as an image.
Currently mitigated by the per-route CSP (`sandbox; script-src 'none'`) + `contentDispositionType: attachment`, so script execution is mostly neutralized â€” this is a hardening item, not a confirmed exploit.
Fix: sniff magic bytes (`%PNG`, `\xFF\xD8\xFF`, `RIFF....WEBP`, `GIF`), or reject SVG entirely if it isn't needed.

### M2 â€” Admin actions rely on middleware alone for authorization (defense in depth missing)

All `app/admin/actions.ts` server actions perform no auth check of their own; protection is only the `/admin/:path*` middleware matcher + Next.js's built-in same-origin check for server actions.
Not exploitable today, but fragile: if any admin action is ever referenced from a component/page outside `/admin`, or the middleware matcher is edited, write access is silently exposed.
Fix: add a small `requireAdmin()` guard (checks the `admin_session` cookie) at the top of every admin action.

### M3 â€” DB connection and static build hard-crash when env is missing / SSL is off

`lib/db.ts:5` creates the client at module import with `ssl: "require"` and a non-null asserted env var. Consequences seen in testing:

- Missing `DATABASE_URL` â†’ app crashes at startup instead of a clear error.
- DB without SSL â†’ connection fails (we had to enable SSL locally to run the app).
- `next build` runs `getVehicles()` during SSG (`generateStaticParams`, sitemap), so a build with no DB fails.

Fix: fail fast with an explicit startup message, make SSL flag configurable (`DATABASE_SSL=false` for local), and stub/prerender-safe the build-time DB calls.

### M4 â€” No error monitoring or friendly error pages for app-level failures

DB failures in page renderers throw raw Next errors (500 / dev overlay). No `error.tsx`, no logging layer, no Sentry. Real production issues will be silent or user-hostile.
Fix: add an `error.tsx` + `global-error.tsx`, a logging call in server actions, and (recommended) Sentry or Vercel Logs.

### M5 â€” Double-encoded UTF-8 (mojibake) in `app/admin/actions.ts`

Lines 83, 88, 105, 213 contain double-encoded accented characters. The admin sees:
`Type de fichier non autorisÃƒÂ©`, `Le fichier dÃƒÂ©passe la taille maximale...`, `Ãƒâ€°chec de l'upload`.
Cause: file was re-saved as wrong encoding (UTF-8 bytes read as Latin-1).
Fix: replace with proper UTF-8 literals (`autorisÃ©`, `dÃ©passe`, `Ã‰chec`). Grep for `ÃƒÂ©`, `Ãƒâ€°`, `Ãƒ ` throughout the file. Note: `Ã‚ge` / `Ã¢ge` in other files is correct French, not a bug.

---

## LOW / INFORMATIONAL

- **L1 â€” Session hygiene**: the admin cookie never rotates; revoking access means changing `ADMIN_PASSWORD` or `ADMIN_SESSION_SECRET` (which logs everyone out). Acceptable for one admin, worth knowing.
- **L2 â€” `confirmReservation` is check-then-act, not atomic** (`lib/db.ts:298`): two admins confirming overlapping bookings concurrently could both pass the availability check (small race window). A `SELECT ... FOR UPDATE` would close it.
- **L3 â€” French decimal comma**: `delivery_fee` / `pickup_fee` parse with `Number(x) || 0`, so an admin typing `1,5` stores `0` silently.
- **L4 â€” In-memory rate limiting resets on every redeploy** (documented in README; fine for single instance, not for multi-instance deploys).
- **L5 â€” Orphaned uploads**: deleting/replacing a vehicle never deletes the old image from the `vehicles` Supabase bucket.
- **L6 â€” Deprecations**: `middleware.ts` is deprecated in Next.js 16 in favor of `proxy.ts` (`npx @next/codemod@canary middleware-to-proxy .`). Turbopack also warns that `package-lock.json` sits outside the detected git repo root.
- **L7 â€” `scheduler` top-level dependency is now an RC build** (0.25.0-rc) after the lockfile regen. Nothing imports it today, but a future `import 'scheduler'` would hit a prerelease.
- **L8 â€” `npm audit`**: 0 vulnerabilities. Deprecations to watch: `eslint@9.39.5` (unsupported) and `signature_pad` usage is local, fine.
- **L9 â€” Supabase URL is hardcoded** in `next.config.ts:11` (`tkevjdipmoberbxjggcv.supabase.co`). It's a public project ref, not a secret, but it couples image loading to one specific project â€” if the deployed env uses a different Supabase project, `next/image` remote-pattern will block its URLs. Prefer env-based.

---

## Checked and OK

- No secrets/keys in git history or tracked files (`.env*` ignored; only placeholders ever committed). `.env.local` is git-ignored.
- SQL: all queries are parameterized (`postgres` tagged templates); no injection surface found.
- XSS: all dynamic UI values are React-escaped; honeypot fields present in both public forms.
- Contract PDF route (`/admin/reservations/[id]/contract`) is behind `/admin` middleware â€” contract PII is not publicly reachable.
- Signing tokens: UUID, single-use, expire after 7 days, consumed atomically in SQL; signer IP+PII only exposed to token holder.
- Admin cookie: `httpOnly`, `secure`, `sameSite=lax`.
- Login lockout (5 attempts / 15 min), timing-safe password compare, 800 ms decoy delay on failure.
- `npm run lint`: clean. `npm run build`: passes. Public pages (`/`, `/vehicules`, `/vehicules/[slug]`, `/admin/login`, `/sign/[token]`): render OK against a working DB.

---

## Quick wins for the team (suggested order)

1. Delete or rewrite `scripts/init-db.mjs` (H1).
2. Use a trustworthy IP source for rate limiting (H2).
3. Rate-limit the public reservation action (H3).
4. Fix the mojibake strings in `app/admin/actions.ts` (M5).
5. Add `requireAdmin()` guard inside admin server actions (M2).
6. Add `error.tsx` / logging (M4).
7. Make SSL optional per environment; add a clear startup error if `DATABASE_URL` is missing (M3).

