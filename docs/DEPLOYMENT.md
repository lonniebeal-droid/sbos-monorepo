# SBOS — Deployment

Production deployment guide for the SBOS platform.

## Architecture at runtime

```
Internet ─► TLS load balancer ─► web (Next.js standalone, :3000)
                                    └─► api (NestJS, :4000) ─► PostgreSQL
                                                            └─► Redis (planned)
```

- The **web** app is the only public surface; it calls the **api** server-side.
- The **api** is stateless and horizontally scalable; put it behind the same or
  a separate load balancer.
- **PostgreSQL** is the system of record. **Redis** is provisioned in Compose
  for the planned queue/cache layer.

## Option A — Docker Compose (single host)

```bash
cp .env.production.example .env
# Fill in POSTGRES_PASSWORD, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, AUTH_SECRET,
# CORS_ORIGINS, and any provider keys.
docker compose up --build -d
docker compose ps        # all services healthy
docker compose logs -f api
```

- The **api** container runs `prisma migrate deploy` on start, so schema changes
  ship with the image.
- Seed once (optional, for a fresh org):
  `docker compose exec api node packages/database/... ` or run the seed against
  the database out-of-band.
- Both images run as **non-root** users and expose **HEALTHCHECK**s.

## Option B — Managed platform (Railway / Fly / AWS ECS)

For Railway, this repo now includes a prepared `.railway/railway.ts` scaffold.
It is not applied automatically; run `railway config plan` and review before
any apply.

Build and push the two images (CI already builds them):

```bash
docker build -f apps/api/Dockerfile -t <registry>/sbos-api:<tag> .
docker build -f apps/web/Dockerfile -t <registry>/sbos-web:<tag> .
```

Provision:
1. A managed **PostgreSQL** instance; set `DATABASE_URL` on the api service.
2. The **api** service with the secrets from `.env.production.example`.
3. The **web** service with `SBOS_API_URL` pointing at the api's internal URL
   plus `NEXT_PUBLIC_API_URL` pointing at the api's public HTTPS URL, and
   `AUTH_SECRET` set.
4. Run migrations on deploy exactly once per deploy path. The prepared Railway
   scaffold keeps migrations in the api start command, so do not also add a
   second Railway pre-deploy migration step for that same service.
5. If this is a fresh environment with no org yet, set a strong
   `ADMIN_BOOTSTRAP_TOKEN`, use the one-time bootstrap endpoint, then rotate or
   remove the token.

## Required configuration

| Variable | Service | Notes |
| --- | --- | --- |
| `DATABASE_URL` | api | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | api | Random; **must differ** from refresh |
| `JWT_REFRESH_SECRET` | api | Random |
| `AUTH_SECRET` | web | Session cookie signing |
| `CORS_ORIGINS` | api | Comma-separated allowed web origins |
| `SBOS_API_URL` | web | Internal URL of the api |
| `NEXT_PUBLIC_API_URL` | web | Public HTTPS URL of the api for browser-side auth/setup flows |
| `ADMIN_BOOTSTRAP_TOKEN` | api | Optional one-time bootstrap token for the first org/admin |

The API **fails fast** at boot if secrets are missing or left at dev defaults in
production (`NODE_ENV=production`).

## Migrations

```bash
# Apply pending migrations (idempotent; safe to run on every deploy)
pnpm --filter @sbos/database prisma:deploy
```

All migrations are additive and backwards-compatible (see
`docs/DATABASE_REVIEW.md`), so rolling deploys are safe. Take a database backup
before each deploy as standard practice.

## TLS, cookies & CORS

- Terminate TLS at the load balancer. Cookies are issued `Secure` +
  `HttpOnly` + `SameSite=Lax` when `NODE_ENV=production`.
- Set `CORS_ORIGINS` to your exact web origin(s); credentials are enabled.

## Observability

- **Health:** `GET /api/v1/health` (api), `GET /api/health` (web),
- `GET /api/v1/health` returns **503** when the DB probe fails, which keeps
  Railway-style health gates meaningful.
  `GET /api/v1/platform/system-health` (authenticated admin snapshot).
- Ship container stdout to your log aggregator; the API logs unexpected errors
  with stack traces via the global exception filter.

## Scaling & hardening (roadmap)

- Add a Redis-backed queue (BullMQ) for async jobs and rate-limit storage.
- Add a connection pooler (PgBouncer) and a read replica.
- Configure WAF, secrets rotation, and automated backups per your provider.
- Complete the HIPAA controls tracked in `RELEASE_1_CHECKLIST.md`.
