# Digital Wealth Vault

An academic prototype for organizing digital wealth and preparing for
inheritance: asset inventory, estimated values (INR default), recovery
guidance, official provider links, nominee authorizations, and a simulated
inheritance workflow.

> Status: **Slice 4** — app scaffold, UI kit, Docker Postgres config, landing
> page, PostgreSQL data layer (Prisma schema, migration, demo seed), Better
> Auth email/password authentication with a protected dashboard, and the
> **Asset Vault**: session-scoped asset create/read/update/delete with server-side
> validation, per-currency portfolio totals, and safe delete/archive handling.

> All demo valuations are fictional estimates. Not financial advice. The
> application never sells assets, processes payments, or bypasses provider
> restrictions.

## Prerequisites (Windows)

| Tool | Version used here | Check |
|---|---|---|
| Node.js | 24.x | `node --version` |
| npm | 11.x | `npm --version` |
| Docker Desktop | 29.x | `docker --version` |
| Git | 2.x | `git --version` |

## Setup (Windows PowerShell)

```powershell
# 1. Install dependencies
npm install

# 2. Environment configuration
Copy-Item .env.example .env
# Edit .env and replace the placeholder values.

# 3. Start PostgreSQL
docker compose up -d

# 4. Apply database migrations (creates tables from prisma/schema.prisma)
npx prisma migrate deploy

# 5. Seed deterministic demo data (idempotent, demo__* rows only)
npm run db:seed

# 6. Run the development server
npm run dev
# Open http://localhost:3000
```

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start dev server (http://localhost:3000) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`) |
| `npm run build` | Production build |
| `npm test` | Automated tests (validation, auth, ownership, deletion, nominees) |
| `npm run start` | Serve production build |
| `npm run db:seed` | Seed deterministic demo data (`prisma/seed.ts`) |
| `npx prisma migrate deploy` | Apply committed migrations |
| `npx prisma migrate dev` | Create/apply migrations during development |
| `npx prisma studio` | Browse data (http://localhost:5555) |
| `npx prisma generate` | Regenerate Prisma client |
| `docker compose up -d` | Start PostgreSQL 17 |
| `docker compose down` | Stop PostgreSQL (keeps data) |
| `docker compose down -v` | Stop PostgreSQL and delete data volume |

## Environment variables

Copy `.env.example` → `.env`. The template contains placeholders only —
never commit real secrets. `.env` is git-ignored; `.env.example` is not.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Docker Compose DB credentials |
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` | Better Auth (Slice 3) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional Google OAuth (Slice 3) |
| `INACTIVITY_THRESHOLD_DAYS` | Days before a check-in reminder (default 30) |
| `CLAIM_GRACE_PERIOD_DAYS` | Nominee response window (default 3) |
| `SIM_CLOCK_OFFSET_MS` | Simulated clock bootstrap offset (default 0) |
| `ENABLE_DEV_CLOCK` | Dev-only accelerated clock toggle |
| `SEED_ALLOW_PERSONAL` | `1` allows seeding when non-demo users exist (refused by default) |

## Database (Slice 2)

- **Schema**: `prisma/schema.prisma` — SQLite is not used; PostgreSQL via Prisma.
- **Migration**: `prisma/migrations/20261021162804_init_schema/` (initial tables)
  and `prisma/migrations/20261022100945_nominee_status/` (additive nominee
  status columns).
- **Seed**: `npm run db:seed` runs `prisma/seed.ts` (via `tsx`). The seed is
  **deterministic and idempotent** — rows use stable `demo__*` identifiers, so
  re-running it does not create duplicates or change row counts.
- **Safety guard**: if any non-demo user exists, seeding is **refused** to avoid
  mixing demo and personal data. Set `SEED_ALLOW_PERSONAL=1` to override (demo
  rows are still the only ones written).
- **Demo credentials** (disposable, fictional): `ada@demo.local` /
  `grace@demo.local` / `maya@demo.local`, password `DemoPass123!`. Valuations are
  fictional; assets use the INR default with one USD example.
- **Studio**: `npx prisma studio` opens a local data browser (default port 5555).

## Asset Vault (Slice 4)

- **Dashboard** (`/dashboard`): your assets only, per-currency portfolio and
  category totals (never summed across currencies), per-asset demo labels, and
  an empty state for new accounts (try `maya@demo.local`).
- **CRUD pages**: `/dashboard/assets/new`,
  `/dashboard/assets/[id]` (details), `/dashboard/assets/[id]/edit`.
- **API**: `GET/POST /api/assets`, `GET/PATCH/DELETE /api/assets/[id]` — every
  call is scoped to the authenticated session; the owner is never taken from
  the request body. Invalid input returns `400` with field-level messages.
- **Safe deletion**: assets referenced by inheritance requests or nominee
  authorizations return `409` and can only be archived (`status = ARCHIVED`)
  or restored — cascade deletion of inheritance records is refused.
- **Tests** (`npm test`, requires the dev server on port 3000): Zod schema
  unit tests plus HTTP integration tests covering authentication, ownership
  isolation, mass-assignment protection, validation, deletion, and demo-data
  preservation. Test users are created and removed by the suite itself.
- Built with `node:test` + `tsx` (no extra test framework dependencies).

## Nominee Management (Slice 5A)

- **Dashboard** (`/dashboard/nominees`): your nominees only — add, rename,
  invite to an asset, revoke, and restore. Revocation is reversible and never
  deletes records; restore reactivates the nominee but never prior access.
- **Status model**: `NomineeStatus` (`ACTIVE`/`REVOKED`) with `revokedAt` and
  an owner+status index, added by an additive migration. Nominee email is
  immutable after creation and normalized (trimmed, lowercased).
- **API**: `GET/POST /api/nominees`, `PATCH /api/nominees/[id]` (name,
  relationship, or restore via `status: "ACTIVE"` only),
  `POST /api/nominees/[id]/revoke`, `POST /api/assets/[id]/requests`
  (invitation). Every call is scoped to the authenticated session; foreign and
  missing records return an identical generic `404`.
- **Revocation (transactional)**: nominee → `REVOKED`; its `ACTIVE`
  authorizations are revoked; open requests (`INVITED`, `ELIGIBLE`,
  `CLAIMED_PENDING_CONFIRM`) become `REVOKED` with one appended audit event
  each; terminal requests and all rows are preserved. Repeat revocation is
  idempotent and adds no duplicate events.
- **Invitation (transactional)**: creates one `INVITED` request, an `INVITED`
  audit event, and an in-app `NOMINEE_INVITE` notification when the nominee
  email matches a registered account. It records a claim-window deadline
  (`graceEndsAt = now + CLAIM_GRACE_PERIOD_DAYS`) and **never** creates an
  `AssetAuthorization` — invitations grant no asset access.
- **Tests**: schema unit tests plus HTTP integration tests for auth, ownership
  isolation, mass-assignment protection, duplicate/conflict codes, revocation
  and restore semantics, notification behavior, and proof that an invited
  registered user still cannot read the invited asset.

## Claim & Verification Workflow (Slice 5B)

- **State machine** (owner approval is mandatory; nothing is automatic):
  - `INVITED → ELIGIBLE` — nominee *initiate claim* (attestation + one-time
    claim code) records `ELIGIBILITY_MET`.
  - `ELIGIBLE → CLAIMED_PENDING_CONFIRM` — nominee *submit claim* records
    `CLAIM_STARTED` + `IDENTITY_RECONFIRMED`.
  - `CLAIMED_PENDING_CONFIRM → RELEASED` — **owner approve only**; creates an
    `AssetAuthorization` (status `ACTIVE`, `grantedBy` = owner) and an
    `ACCESS_RELEASED` notification. This is the only code path that ever
    creates authorizations. Owner *reject* → `DECLINED`.
  - `INVITED / ELIGIBLE / CLAIMED_PENDING_CONFIRM → DECLINED` — nominee
    decline (allowed even if the nominee row is revoked; never reactivates
    access).
  - `INVITED` past `graceEndsAt` → `EXPIRED` — **lazily**, inside the next
    claim attempt, with exactly one audit event ever. Expiry grants no
    access and is never confirmation of death.
  - Owner authorization revoke: authorization → `REVOKED` with a `REVOKED`
    audit event on the granting request; the request itself stays `RELEASED`.
- **Claim codes**: every invitation generates a high-entropy one-time code
  (returned once at invite, shown in the invite dialog), stored only as a
  salted scrypt hash (`claimCodeHash`), verified with a timing-safe compare,
  consumed on successful use, and rate-limited to 5 failed attempts per
  invitation (`claimCodeAttempts`, then `CLAIM_CODE_LOCKED`). The code proves
  neither death nor legal entitlement.
- **Re-invitation & attempts**: an open request for a nominee+asset pair
  refuses re-invites (`409 REQUEST_EXISTS`); terminal history allows a new
  invitation with `attempt = previous max + 1`. Authorizations record the
  attempt they were granted under (composite uniques
  `assetId_nomineeId_attempt` on both tables, additive migration).
- **Nominee portal** (`/dashboard/nominee`): every request where you are the
  named nominee, across owners, with claim / submit-claim / decline actions
  and the attestation copy. Released requests with an `ACTIVE` authorization
  open a strict **whitelisted recovery view** (`/dashboard/nominee/[assetId]`):
  title, category, provider, recovery instructions, ownership evidence,
  official links, and the account identifier **only** when the owner enabled
  "Show account identifier to nominees after release"
  (`nomineeCanSeeAccountReference`, default off). Valuations, resale notes
  and descriptions are never exposed.
- **Owner side**: approve/reject actions on pending claims and revoke
  authorization on released requests, all on `/dashboard/nominees`. Access
  checks require request `RELEASED` **and** matching `ACTIVE` authorization
  **and** the authenticated email, evaluated per request.
- **API**: `GET /api/me/inheritance`,
  `POST /api/me/inheritance/[id]/claim | submit-claim | decline`,
  `GET /api/me/assets/[id]`, `POST /api/inheritance/[id]/approve | reject`,
  `POST /api/authorizations/[id]/revoke`. Transitions run in transactions with
  status-guarded updates: a lost race or repeat returns `409` and appends no
  duplicate audit events. Foreign and missing records return an identical
  generic `404`.
- **Notifications**: `ACCESS_RELEASED` on approval and `AUTHORIZATION_CHANGED`
  on authorization revoke are surfaced in a new dashboard notifications card —
  the first consumer of the notification store. No emails are ever sent.
- **Tests**: schema/hash unit tests plus HTTP integration tests covering the
  full workflow, claim-code failure/lock/consumption, lazy expiry
  (exactly-once events), concurrent duplicate claim/approve, D4 whitelist,
  cross-user isolation, idempotent revocation, attempt counters, and proof
  that demo rows and historical events are never rewritten.

## Project layout

- `src/app` — App Router pages and layouts
- `src/components/ui` — shadcn/ui components (New York-style preset, neutral theme)
- `src/lib` — shared utilities and the Prisma client singleton (`src/lib/prisma.ts`)
- `prisma` — schema, migrations, and deterministic demo seed
- `src/generated` — generated Prisma client (git-ignored; run `npx prisma generate` after install)
- `tests` — automated tests: `asset-schemas`/`asset-api` (Slice 4),
  `nominee-schemas`/`nominee-api` (Slice 5A), and
  `inheritance-schemas`/`inheritance-api` (Slice 5B), run with `npm test`
- `docker-compose.yml` — PostgreSQL 17 with a persistent named volume
