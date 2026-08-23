Local development quick start (exact commands)

This file contains focused, copy-paste commands to bring up the full SBOS
stack locally for testing (Postgres + Redis + API + Web) using Docker/Colima
or a local Postgres installation. Do NOT add secrets to the repo; use
`.env` locally only.

1) Prerequisites

- Docker Desktop or Colima installed and running (macOS users: `colima start`).
- `pnpm` 11 (use `corepack` to enable/install if needed).
- `openssl` for secret generation.

2) Create a local `.env` from the provided example (do not commit):

```bash
cd /path/to/sbos-monorepo
cp .env.docker.example .env
# Fill the secrets below (or let the commands generate them):
export JWT_ACCESS_SECRET=$(openssl rand -base64 48)
export JWT_REFRESH_SECRET=$(openssl rand -base64 48)
export AUTH_SECRET=$(openssl rand -base64 48)
sed -i.bak -e "s/JWT_ACCESS_SECRET=/JWT_ACCESS_SECRET=$JWT_ACCESS_SECRET/" .env
sed -i.bak -e "s/JWT_REFRESH_SECRET=/JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET/" .env
sed -i.bak -e "s/AUTH_SECRET=/AUTH_SECRET=$AUTH_SECRET/" .env
rm .env.bak
```

3) Start Docker services (Postgres + Redis + API + Web)

If using Docker Desktop or the Docker CLI:

```bash
docker compose up --build
```

If using Colima on macOS (recommended for Apple Silicon):

```bash
colima start --cpu 4 --memory 6
docker compose up --build
```

4) Alternative: run services locally without Docker

Install workspace deps and run the API and web locally (requires a local
Postgres instance reachable at `localhost:5432`):

```bash
pnpm install
# generate Prisma client and apply migrations
pnpm --filter @sbos/database prisma:generate
pnpm --filter @sbos/database prisma:deploy
pnpm --filter @sbos/database db:seed

# Terminal 1: API (http://localhost:4000)
pnpm --filter @sbos/api dev

# Terminal 2: Web (http://localhost:3000)
pnpm --filter @sbos/web dev
```

5) Verify the stack

- API health: http://localhost:4000/api/v1/health
- Web: http://localhost:3000
- Seeded demo user (if seed run): `admin@sbos.health` / `Sbos!2026`

6) Prisma commands (exact)

```bash
# generate the client
pnpm --filter @sbos/database prisma:generate
# apply migrations
pnpm --filter @sbos/database prisma:deploy
# optional: seed demo data
pnpm --filter @sbos/database db:seed
```

7) Running tests, lint, and build (recommended after changes)

```bash
pnpm -w lint
pnpm -w test
pnpm -w build
```

Notes
- If the Docker CLI cannot connect to a daemon, start Docker Desktop or
  Colima. The repo intentionally does not include secrets — use `.env` only.
- If a service fails due to missing provider keys (Twilio/Stripe/OpenAI), the
  code falls back to demo behavior in many places; you should still be able to
  exercise core workflows (auth, patients, appointments) after seeding the DB.
