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
NODE_ENV=development pnpm --filter @sbos/api dev

# Terminal 2 — web on http://localhost:3000
NODE_ENV=development pnpm --filter @sbos/web dev
```

**Why the explicit `NODE_ENV=development`:** the API's config validation only
warns about missing/default secrets in development, but hard-fails
(`Refusing to start in production`) whenever `NODE_ENV=production` — and some
shells/CI images export `NODE_ENV=production` globally regardless of what
you're running. Run `echo $NODE_ENV` first if the API exits immediately on
`dev` with an "Insecure/missing configuration" error; set it to `development`
explicitly for local work rather than relying on it being unset.

### Docker vs. local Postgres

Two supported ways to get a database, pick one:

- **Docker Compose (whole stack, no local Node/Postgres needed):**
  ```bash
  cp .env.production.example .env   # set the required secrets
  docker compose up --build
  ```
  This starts Postgres, Redis, the api, and the web app together.

- **A standalone local/throwaway Postgres, running only `pnpm dev` for the
  apps** (useful when Docker Compose or a compose plugin isn't available):
  ```bash
  docker run --rm -d --name sbos-postgres -p 5432:5432 \
    -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=sbos postgres:16-alpine
  ```
  Then set `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sbos?schema=public`
  in `packages/database/.env` and `apps/api/.env` and continue with step 3
  above. The API also boots without a reachable database at all (it logs a
  warning and DB-backed endpoints error per-request) — useful for a quick
  build/boot sanity check, not for an actual demo.

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

- **API exits on start with "Insecure/missing configuration"** — this is the
  production fail-fast gate (see the `NODE_ENV` note in step 4), triggered
  whenever `NODE_ENV=production` is set — including inherited from your shell
  or CI environment, not just when you set it deliberately. For local dev,
  explicitly run with `NODE_ENV=development`. For an actual production
  deploy, set real secrets (see step 2) instead of unsetting `NODE_ENV`.
- **`prisma migrate` can't connect** — verify `DATABASE_URL` and that PostgreSQL
  is reachable.
- **Login fails locally** — ensure you ran `db:seed`; auth is database-backed.
- **Types errors from the root `typescript@7`** — apps pin TS 5.7 (see
  `docs/DECISIONS.md`, ADR-002); run `pnpm install` to hydrate per-package deps.
