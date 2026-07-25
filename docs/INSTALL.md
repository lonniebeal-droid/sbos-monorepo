# SBOS — Installation (Local Development)

## Prerequisites

- **Node.js 24+** (the repo uses native TypeScript test execution)
- **pnpm 11** (`corepack enable` then `corepack prepare pnpm@11.17.0 --activate`)
- **PostgreSQL 14+** (local install, Docker, or a hosted dev database)

## 1. Clone & install

```bash
git clone https://github.com/lonniebeal-droid/sbos-monorepo.git
cd sbos-monorepo
pnpm install
```

## 2. Configure environment

```bash
cp packages/database/.env.example packages/database/.env   # DATABASE_URL
cp apps/api/.env.example apps/api/.env                       # API secrets + providers
cp apps/web/.env.example apps/web/.env                       # SBOS_API_URL, AUTH_SECRET
```

Set `DATABASE_URL` in both `packages/database/.env` and `apps/api/.env` to your
PostgreSQL instance, e.g.:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sbos?schema=public
```

Generate secrets:

```bash
openssl rand -base64 48   # use distinct values for JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, AUTH_SECRET
```

## 3. Set up the database

```bash
pnpm --filter @sbos/database prisma:generate
pnpm --filter @sbos/database prisma:deploy    # apply all migrations
pnpm --filter @sbos/database db:seed          # seed a demo organization
```

Seeded sign-in (development): `admin@sbos.health` / `Sbos!2026`.

## 4. Run

```bash
# Terminal 1 — API on http://localhost:4000 (Swagger at /docs)
pnpm --filter @sbos/api dev

# Terminal 2 — web on http://localhost:3000
pnpm --filter @sbos/web dev
```

Or the whole stack with Docker (no local Node/Postgres needed):

```bash
cp .env.production.example .env   # set the required secrets
docker compose up --build
```

## 5. Verify

```bash
pnpm build   # turbo run build — all packages
pnpm lint    # tsc typecheck across the workspace
pnpm test    # unit tests
```

All three should pass. See [INSTALL troubleshooting](#troubleshooting) if not.

## Monorepo layout

| Path | Package | Purpose |
| --- | --- | --- |
| `apps/web` | `@sbos/web` | Next.js 15 front end |
| `apps/api` | `@sbos/api` | NestJS REST API |
| `packages/database` | `@sbos/database` | Prisma schema, migrations, seed |
| `packages/core` | `@sbos/core` | Shared domain logic + tests |
| `packages/tsconfig` | `@sbos/tsconfig` | Shared TS config |

## Troubleshooting

- **API exits on start** — in production it refuses to boot with default/missing
  secrets or no `DATABASE_URL`. Set them (see step 2).
- **`prisma migrate` can't connect** — verify `DATABASE_URL` and that PostgreSQL
  is reachable.
- **Login fails locally** — ensure you ran `db:seed`; auth is database-backed.
- **Types errors from the root `typescript@7`** — apps pin TS 5.7 (see
  `docs/DECISIONS.md`, ADR-002); run `pnpm install` to hydrate per-package deps.
