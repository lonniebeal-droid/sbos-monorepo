# SBOS — API Specification

**Framework:** NestJS 10 · **Base URL:** `/api/v1` · **Docs:** `/docs` (Swagger UI)
· **Auth:** Bearer JWT

All endpoints are versioned under `/api/v1`. Interactive OpenAPI documentation
is generated at runtime and served at `/docs` with `persistAuthorization`
enabled.

## Authentication model

- **Access token** — short-lived (default 15m), sent as
  `Authorization: Bearer <token>`.
- **Refresh token** — long-lived (default 7d), exchanged for new access tokens.
- Tokens are signed with separate secrets (`JWT_ACCESS_SECRET`,
  `JWT_REFRESH_SECRET`) and carry `{ sub, email, name, role, organizationId,
  type }`.

## Global behavior

- **Validation** — request bodies are validated and whitelisted; unknown
  properties are rejected (`ValidationPipe`).
- **Rate limiting** — 120 requests / 60 seconds per client (`@nestjs/throttler`).
- **RBAC** — `RolesGuard` enforces `@Roles()`; higher roles satisfy lower
  requirements. Role hierarchy (high→low): `SUPER_ADMIN`, `ORG_ADMIN`,
  `SUPERVISOR`, `CLINICIAN`, `BILLING`, `FRONT_DESK`.
- **Pagination** — list endpoints accept `?page`, `?limit` (max 100), `?search`
  and return `{ data, meta }` where meta includes `total`, `totalPages`,
  `hasNextPage`, `hasPreviousPage`.

## Endpoints

### Health

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/v1/health` | Public | Liveness/readiness probe |

### Authentication

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/v1/auth/login` | Public | Authenticate; returns tokens+user, or an MFA challenge |
| POST | `/api/v1/auth/login/mfa` | Public | Complete login with a TOTP code |
| POST | `/api/v1/auth/refresh` | Public | Rotate refresh token (revokes the old one) |
| POST | `/api/v1/auth/logout` | Public | Revoke a refresh token |
| GET | `/api/v1/auth/profile` | Bearer | Current authenticated user |
| POST | `/api/v1/auth/mfa/setup` | Bearer | Begin MFA enrollment (returns QR) |
| POST | `/api/v1/auth/mfa/enable` | Bearer | Confirm + enable MFA with a code |
| POST | `/api/v1/auth/mfa/disable` | Bearer | Disable MFA with a code |

**`POST /auth/login`**
```json
// request
{ "email": "clinician@sbos.health", "password": "Sbos!2026" }
// response 200
{
  "accessToken": "eyJ…",
  "refreshToken": "eyJ…",
  "expiresIn": 900,
  "user": { "id": "usr_2", "email": "…", "name": "Dr. Riley Chen",
            "role": "CLINICIAN", "organizationId": "org_success_brand" }
}
```

### Users

| Method | Path | Auth (min role) | Description |
| --- | --- | --- | --- |
| GET | `/api/v1/users` | ORG_ADMIN | List users in the caller's organization (paginated) |
| GET | `/api/v1/users/me` | any | Current user |
| GET | `/api/v1/users/:id` | SUPERVISOR | Get a user by id |
| POST | `/api/v1/users` | ORG_ADMIN | Create a user |

### Organizations (tenant-scoped)

| Method | Path | Auth (min role) | Description |
| --- | --- | --- | --- |
| GET | `/api/v1/organization` | any | Current user's organization |
| GET | `/api/v1/organization/stats` | any | Org-wide counts (clients, clinicians, appts, users) |
| PATCH | `/api/v1/organization` | ORG_ADMIN | Update organization profile |

### Locations

| Method | Path | Auth (min role) | Description |
| --- | --- | --- | --- |
| GET | `/api/v1/locations` | any | List locations (paginated, searchable) |
| GET | `/api/v1/locations/:id` | any | Get a location |
| POST | `/api/v1/locations` | ORG_ADMIN | Create a location |
| PATCH | `/api/v1/locations/:id` | ORG_ADMIN | Update a location |
| DELETE | `/api/v1/locations/:id` | ORG_ADMIN | Delete a location |

### Clients

| Method | Path | Auth (min role) | Description |
| --- | --- | --- | --- |
| GET | `/api/v1/clients` | any | List clients (paginated, searchable) |
| GET | `/api/v1/clients/:id` | any | Client chart (diagnoses, insurance, treatment plans) |
| POST | `/api/v1/clients` | FRONT_DESK | Create a client |
| PATCH | `/api/v1/clients/:id` | CLINICIAN | Update a client |
| DELETE | `/api/v1/clients/:id` | ORG_ADMIN | Delete a client |

### Appointments

| Method | Path | Auth (min role) | Description |
| --- | --- | --- | --- |
| GET | `/api/v1/appointments` | any | List (filter by clinician/client/date range) |
| GET | `/api/v1/appointments/:id` | any | Get an appointment |
| POST | `/api/v1/appointments` | FRONT_DESK | Schedule (conflict-checked) |
| PATCH | `/api/v1/appointments/:id` | FRONT_DESK | Update / reschedule |
| DELETE | `/api/v1/appointments/:id` | ORG_ADMIN | Delete |

### Clinical Notes

| Method | Path | Auth (min role) | Description |
| --- | --- | --- | --- |
| GET | `/api/v1/notes` | any | List (filter by client/clinician/type/status) |
| GET | `/api/v1/notes/:id` | any | Get a note with structured detail |
| GET | `/api/v1/notes/:id/versions` | any | Version history (audit trail) |
| POST | `/api/v1/notes` | CLINICIAN | Create a draft (BIRP/DAP/SOAP/progress/group) |
| POST | `/api/v1/notes/generate` | CLINICIAN | AI-assisted draft (Jessie; not persisted) |
| PATCH | `/api/v1/notes/:id` | CLINICIAN | Edit a draft (new version) |
| POST | `/api/v1/notes/:id/sign` | CLINICIAN | Sign (author) |
| POST | `/api/v1/notes/:id/cosign` | SUPERVISOR | Co-sign |
| POST | `/api/v1/notes/:id/amend` | CLINICIAN | Amend a signed note (new version) |
| DELETE | `/api/v1/notes/:id` | CLINICIAN | Delete a draft |

### Scheduling (recurrence, availability, waitlist, lifecycle)

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/v1/appointments/recurring` | Create a recurring series (skips conflicts) |
| POST | `/api/v1/appointments/:id/telehealth` | Provision/fetch telehealth session URL |
| POST | `/api/v1/appointments/:id/check-in` | Check a client in |
| POST | `/api/v1/appointments/:id/check-out` | Check out + complete |
| POST | `/api/v1/appointments/:id/cancel` | Cancel with reason |
| GET/POST/DELETE | `/api/v1/scheduling/availability` | Clinician weekly availability |
| POST | `/api/v1/scheduling/time-off` | Clinician time-off block |
| GET | `/api/v1/scheduling/slots` | Open slots for a clinician on a date |
| GET/POST/PATCH/DELETE | `/api/v1/scheduling/waitlist` | Waitlist entries + status |

### Diagnoses / Medications / Treatment Plans / Documents

| Method | Path | Description |
| --- | --- | --- |
| GET/POST/PATCH/DELETE | `/api/v1/diagnoses` | ICD-10 diagnoses per client |
| GET/POST/PATCH/DELETE | `/api/v1/medications` | Medication records per client |
| GET/POST/PATCH/DELETE | `/api/v1/treatment-plans` | Plans + goals/objectives |
| PATCH | `/api/v1/treatment-plans/:id/goals/:goalId` | Goal status/progress |
| GET/POST/DELETE | `/api/v1/documents` | Metadata + presigned upload/download |
| POST | `/api/v1/documents/:id/sign` | Electronic signature |

### Enterprise (tasks, notifications, messaging, analytics, platform admin)

| Method | Path | Description |
| --- | --- | --- |
| GET/POST/PATCH/DELETE | `/api/v1/tasks` | Task management (status/assignee/priority) |
| GET | `/api/v1/notifications` | Current user's notifications (+ `unread-count`) |
| POST | `/api/v1/notifications/:id/read`, `/read-all` | Mark read |
| GET/POST | `/api/v1/messaging/threads` | Internal messaging threads |
| GET/POST | `/api/v1/messaging/threads/:id[/messages]` | Thread + post message |
| GET | `/api/v1/analytics/overview` | Practice KPI snapshot |
| GET | `/api/v1/analytics/appointments-by-status` | Utilization/no-show reporting |
| GET | `/api/v1/analytics/claims-by-status` | Revenue-cycle reporting |
| GET/POST | `/api/v1/platform/feature-flags` | Per-tenant feature flags |
| GET | `/api/v1/platform/system-health` | Admin system-health dashboard |

### Jessie AI

| Method | Path | Description |
| --- | --- | --- |
| GET/POST | `/api/v1/jessie/conversations` | List / start conversations |
| GET | `/api/v1/jessie/conversations/:id` | Conversation + message history (memory) |
| POST | `/api/v1/jessie/conversations/:id/messages` | Send a message, get Jessie's reply |
| POST | `/api/v1/jessie/conversations/:id/close` | Close a conversation |
| GET/POST/PATCH | `/api/v1/jessie/prompts` | Admin prompt management (per assistant kind) |
| GET/POST/PATCH/DELETE | `/api/v1/jessie/knowledge` | Knowledge base (grounding) |

Jessie routes to specialized assistants (receptionist, scheduling, intake,
clinical, knowledge, general) via a `CHAT_PROVIDER` abstraction. The default is
an offline, deterministic provider (no credentials); a hosted LLM
(OpenAI/Claude/Gemini) implements the same interface. Conversation messages are
the persisted memory; grounded kinds retrieve knowledge-base articles.

### Billing (revenue cycle)

| Method | Path | Description |
| --- | --- | --- |
| GET/POST/PATCH | `/api/v1/billing/payers` | Insurance companies / payers |
| GET/POST/PATCH | `/api/v1/billing/service-codes` | CPT fee schedule |
| GET/POST | `/api/v1/billing/claims` | Claims (list/create) |
| POST | `/api/v1/billing/claims/:id/submit` | Submit a claim |
| PATCH | `/api/v1/billing/claims/:id/status` | Accept/deny/pay (ERA/EOB posting) |
| GET/POST | `/api/v1/billing/invoices` | Invoices + line items |
| GET/POST | `/api/v1/billing/payments` | Record payments (via provider) |
| GET | `/api/v1/billing/superbill` | Generate a superbill (client + date range) |

Payments route through a **provider abstraction** (`PAYMENT_PROVIDER`): a manual
provider records cash/check/external payments by default; a Stripe provider
implements the same interface for card processing.

> All resource endpoints are **Prisma-backed** (via the global `PrismaModule`),
> tenant-scoped by `organizationId`, and require a live PostgreSQL connection.
> The API boots without a database (connection is non-fatal); these endpoints
> return a connection error until `DATABASE_URL` points at a reachable instance.

## Status codes

| Code | Meaning |
| --- | --- |
| 200 | Success |
| 201 | Created |
| 400 | Validation error |
| 401 | Missing/invalid/expired token |
| 403 | Authenticated but insufficient role |
| 404 | Not found |
| 409 | Conflict (e.g. duplicate email) |
| 429 | Rate limit exceeded |

## Verified behavior (smoke test)

- `GET /health` → `{ status: "ok" }`
- `POST /auth/login` → issues access + refresh tokens
- `GET /auth/profile` with bearer → returns user
- `GET /users` as CLINICIAN → **403** (RBAC enforced)
- `GET /auth/profile` without token → **401**
- `GET /docs` → **200**

## Planned resource endpoints (roadmap)

Organizations, Clients, Appointments, Notes (BIRP/DAP/SOAP), Treatment Plans,
Diagnoses, Medications, Insurance, Claims, Invoices, Payments, Documents, Tasks,
Messaging, Reports — each following the same paginated, RBAC-guarded,
Swagger-documented pattern and backed by `@sbos/database`.
