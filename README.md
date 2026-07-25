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

## Development sign-in

Until web auth is wired to the API, local sign-in accepts:

- `admin@sbos.health` / `Sbos!2026`
- `clinician@sbos.health` / `Sbos!2026`

## Documentation

See [`docs/`](docs/): system architecture, database schema, API spec, feature
requirements, roadmap, decisions (ADR), and current status.

## License

See [LICENSE](LICENSE).
