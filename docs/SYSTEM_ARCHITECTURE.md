# SBOS — System Architecture

Success Brand Operating System (SBOS) is a production-grade behavioral health
operating system built as a **pnpm + Turborepo monorepo**.

## High-level topology

```
┌──────────────────────────────────────────────────────────────┐
│                          Clients                             │
│         Web browser (desktop / tablet / mobile)              │
└───────────────┬──────────────────────────────────────────────┘
                │ HTTPS
        ┌───────▼─────────┐        ┌──────────────────────────┐
        │  apps/web        │  REST  │  apps/api                │
        │  Next.js 15      │──────► │  NestJS 10               │
        │  React 19 / RSC  │  JWT   │  REST · Swagger · RBAC   │
        │  Tailwind/shadcn │        │  Throttler · Validation  │
        └───────┬─────────┘        └───────────┬──────────────┘
                │ (cookie session)             │ Prisma Client
                │                    ┌──────────▼──────────────┐
                │                    │  packages/database       │
                │                    │  Prisma 6 · PostgreSQL   │
                │                    └──────────────────────────┘
        ┌───────▼──────────────────────────────────────────────┐
        │  packages/tsconfig · packages/core (shared)           │
        └───────────────────────────────────────────────────────┘
```

## Workspaces

| Package | Path | Role |
| --- | --- | --- |
| `@sbos/web` | `apps/web` | Next.js 15 App Router front end |
| `@sbos/api` | `apps/api` | NestJS REST API |
| `@sbos/database` | `packages/database` | Prisma schema, client, migrations, seed |
| `@sbos/core` | `packages/core` | Shared domain primitives |
| `@sbos/tsconfig` | `packages/tsconfig` | Shared TypeScript base config |
| `@sbos/service-operations` | `apps/service-operations` | Ops utilities |

Turborepo orchestrates `build`, `dev`, `lint`, `test`, `typecheck` with
`^build` dependency ordering and output caching (`dist/**`, `.next/**`).

## Front end (`apps/web`)

- **Next.js 15 App Router** with React Server Components; route group `(app)`
  hosts the authenticated dashboard, `/login` is public.
- **Auth**: JWT session (via `jose`) stored in an httpOnly cookie; edge
  `middleware.ts` guards all routes and redirects unauthenticated users.
- **UI**: Tailwind CSS v3 design-token system (light/dark), hand-authored
  shadcn/ui component library (Radix primitives + CVA).
- **State/data**: TanStack Query provider; React Hook Form + Zod for forms.
- **Theming**: `next-themes` class strategy; fully responsive with a mobile
  slide-over navigation.

## Back end (`apps/api`)

- **NestJS 10**, URI-versioned (`/api/v1`), global `api` prefix.
- **Guards (global)**: `ThrottlerGuard` (rate limiting) → `JwtAuthGuard`
  (passport-jwt, `@Public()` opt-out) → `RolesGuard` (hierarchical RBAC).
- **Validation**: global `ValidationPipe` (whitelist + transform).
- **Docs**: Swagger/OpenAPI served at `/docs` with bearer auth.
- **Config**: `@nestjs/config` typed configuration; secrets via env.

## Data (`packages/database`)

- **Prisma 6 / PostgreSQL**, 29 models, multi-tenant via `organizationId`.
- Generated client exposed through a cached singleton (`src/index.ts`).
- Deployable SQL migration under `prisma/migrations`.

## Cross-cutting concerns

- **Multi-tenancy**: every tenant-scoped table carries `organizationId`;
  API scopes queries to the authenticated user's organization.
- **Security**: bcrypt password hashing, short-lived access + long-lived
  refresh tokens, RBAC hierarchy, rate limiting, input whitelisting.
- **Auditability**: `AuditLog` model captures actor/action/entity for
  compliance (HIPAA-oriented).

## Planned infrastructure (roadmap)

Redis + BullMQ (queues), S3-compatible storage (documents), WebSockets
(realtime), Stripe (payments), Resend (email), Twilio (SMS), and an AI
services layer (OpenAI/Claude/Gemini) powering the "Jessie" receptionist and
AI note generation. See `ROADMAP.md`.
