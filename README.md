# SBOS — Success Brand Operating System

A production-grade **behavioral health operating system**: scheduling, clinical
documentation, billing, and analytics for modern behavioral-health practices.

Built as a **pnpm + Turborepo** monorepo.

## Workspaces

| Package | Path | Stack |
| --- | --- | --- |
| `@sbos/web` | `apps/web` | Next.js 15 · React 19 · Tailwind · shadcn/ui |
| `@sbos/api` | `apps/api` | NestJS 10 · REST · Swagger · JWT · RBAC |
| `@sbos/database` | `packages/database` | Prisma 6 · PostgreSQL |
| `@sbos/core` | `packages/core` | Shared domain primitives |
| `@sbos/tsconfig` | `packages/tsconfig` | Shared TS config |

## Quick start

```bash
pnpm install          # install all workspaces
pnpm build            # turbo run build (all packages)
pnpm lint             # turbo run lint (typecheck)
pnpm dev              # run dev servers
```

### Run individual apps

```bash
pnpm --filter @sbos/web dev     # web on http://localhost:3000
pnpm --filter @sbos/api dev     # api on http://localhost:4000 (docs at /docs)
```

### Database

```bash
pnpm --filter @sbos/database prisma:generate
pnpm --filter @sbos/database prisma:deploy   # apply migrations (needs DATABASE_URL)
pnpm --filter @sbos/database db:seed
```

### Docker

Run the whole stack (PostgreSQL, Redis, API, web) with Docker Compose:

```bash
cp .env.docker.example .env   # set JWT/AUTH secrets
docker compose up --build
```

- Web: http://localhost:3000 · API: http://localhost:4000 (docs at `/docs`)
- The API container applies Prisma migrations on start.
- Images use multi-stage builds with Turborepo pruning; the web image runs the
  Next.js standalone server. CI (GitHub Actions) builds both images and runs
  build/lint/test on every push.

## Development sign-in

Until web auth is wired to the API, local sign-in accepts:

- `admin@sbos.health` / `Sbos!2026`
- `clinician@sbos.health` / `Sbos!2026`

## Documentation

See [`docs/`](docs/):

- **Getting started:** [INSTALL](docs/INSTALL.md) · [DEPLOYMENT](docs/DEPLOYMENT.md)
- **Guides:** [ADMIN_GUIDE](docs/ADMIN_GUIDE.md) · [API_GUIDE](docs/API_GUIDE.md) · [AI_CONFIGURATION](docs/AI_CONFIGURATION.md)
- **Reference:** [SYSTEM_ARCHITECTURE](docs/SYSTEM_ARCHITECTURE.md) · [DATABASE_SCHEMA](docs/DATABASE_SCHEMA.md) · [API_SPEC](docs/API_SPEC.md)
- **Reviews:** [SECURITY](docs/SECURITY.md) · [DATABASE_REVIEW](docs/DATABASE_REVIEW.md) · [DECISIONS](docs/DECISIONS.md)
- **Status:** [CURRENT_STATUS](docs/CURRENT_STATUS.md) · [ROADMAP](docs/ROADMAP.md) · [FEATURE_REQUIREMENTS](docs/FEATURE_REQUIREMENTS.md)
- **Release:** [RELEASE_1_CHECKLIST](RELEASE_1_CHECKLIST.md)

## License

See [LICENSE](LICENSE).
