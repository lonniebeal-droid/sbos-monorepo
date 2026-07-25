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
| POST | `/api/v1/auth/login` | Public | Authenticate; returns tokens + user |
| POST | `/api/v1/auth/refresh` | Public | Exchange refresh token for new tokens |
| GET | `/api/v1/auth/profile` | Bearer | Current authenticated user |

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
