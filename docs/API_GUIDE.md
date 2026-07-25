# SBOS — API Guide

A practical guide to consuming the SBOS REST API. For the full endpoint
reference see `docs/API_SPEC.md` or the live Swagger UI at `/docs`
(raw spec at `/docs/json`).

- **Base URL:** `https://<host>/api/v1`
- **Auth:** Bearer JWT
- **Content type:** `application/json`

## Authentication

```bash
# 1. Log in — returns access + refresh tokens
curl -X POST https://<host>/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"clinician@sbos.health","password":"Sbos!2026"}'
# → { "accessToken": "...", "refreshToken": "...", "expiresIn": 900, "user": {...} }

# 2. Call an endpoint
curl https://<host>/api/v1/clients \
  -H "Authorization: Bearer <accessToken>"

# 3. Refresh when the access token expires (default 15m)
curl -X POST https://<host>/api/v1/auth/refresh \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken":"<refreshToken>"}'
```

Access tokens are short-lived (15m); refresh tokens last 7 days. The web app
manages this automatically (cookie storage + middleware refresh).

## Authorization

Endpoints enforce a minimum role (hierarchical — higher roles pass). A call
without a token returns **401**; an authenticated call lacking the role returns
**403**. Every request is implicitly scoped to the caller's organization.

## Pagination

List endpoints accept `page` (default 1), `limit` (default 20, max 100), and
`search`:

```
GET /api/v1/clients?page=2&limit=50&search=mitchell
```

Response envelope:

```json
{
  "data": [ /* items */ ],
  "meta": {
    "page": 2, "limit": 50, "total": 240, "totalPages": 5,
    "hasNextPage": true, "hasPreviousPage": true
  }
}
```

Per-client sub-resources (e.g. `/diagnoses?clientId=`, `/medications?clientId=`)
return plain arrays scoped to that client.

## Filtering

- Appointments: `?clinicianId=&clientId=&from=<ISO>&to=<ISO>`
- Notes: `?clientId=&clinicianId=&type=&status=`
- Tasks: `?status=&assigneeId=`
- Waitlist: `?status=`

## Errors

Every error uses one envelope:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": ["email must be an email"],
  "timestamp": "2026-07-25T04:24:55.176Z",
  "path": "/api/v1/auth/login"
}
```

`message` is an array for validation errors, a string otherwise.

| Code | Meaning |
| --- | --- |
| 400 | Validation error |
| 401 | Missing/invalid/expired token |
| 403 | Insufficient role |
| 404 | Not found |
| 409 | Conflict (duplicate MRN/email/claim number) |
| 429 | Rate limit exceeded (login is 5/min; global 120/min) |

## Versioning

The API is URI-versioned under `/api/v1`. Breaking changes will ship under a new
version prefix; `v1` remains stable.

## Common flows

**Create a client → schedule → document:**

```bash
# create client (FRONT_DESK+)
POST /api/v1/clients { mrn, firstName, lastName, dateOfBirth }
# schedule (conflict-checked)
POST /api/v1/appointments { clientId, clinicianId, startTime, endTime, durationMinutes }
# document, then sign
POST /api/v1/notes { clientId, clinicianId, type:"BIRP", sections:{...} }
POST /api/v1/notes/{id}/sign
```

**Ask Jessie:**

```bash
POST /api/v1/jessie/conversations { kind:"RECEPTIONIST", message:"When are you open?" }
POST /api/v1/jessie/conversations/{id}/messages { message:"Can I book Tuesday?" }
```
