# SBOS — Administrator Guide

For organization administrators (`ORG_ADMIN`) and supervisors managing an SBOS
tenant.

## Roles & permissions

SBOS uses a hierarchical role model — a higher role satisfies any requirement
for a lower one.

| Role | Typical use | Can (highlights) |
| --- | --- | --- |
| `SUPER_ADMIN` | Platform operator | Everything |
| `ORG_ADMIN` | Practice administrator | Org settings, users, locations, feature flags, prompts, knowledge base |
| `SUPERVISOR` | Clinical supervisor | Co-sign notes, view analytics, manage treatment plans |
| `CLINICIAN` | Therapist / prescriber | Clients, notes, diagnoses, medications, scheduling |
| `BILLING` | Billing specialist | Payers, fee schedule, claims, invoices, payments |
| `FRONT_DESK` | Reception | Create clients, schedule/check-in appointments, waitlist |

Every action is scoped to your organization; you can never see another tenant's
data.

## Organization settings

**Settings → Organization.** Update the practice name, group NPI, phone, and
time zone. These appear on client-facing documents and claims.

## Team management

**Settings → Team** lists users. Create users via the API (`POST /users`,
`ORG_ADMIN`) with a role from the table above. Users authenticate with email +
password; passwords are bcrypt-hashed.

## Locations

Manage service locations (office, telehealth, community, residential) via the
Locations API. Appointments can reference a location.

## Feature flags

Per-tenant toggles let you roll capabilities out gradually.

- `GET /api/v1/platform/feature-flags` — list
- `POST /api/v1/platform/feature-flags` — create/update `{ key, isEnabled }`

## Jessie AI administration

- **Prompts** (`Jessie AI → prompts`): create per-assistant system prompts
  (receptionist, scheduling, intake, clinical, knowledge, general). Editing a
  prompt bumps its version. If no active prompt exists, a built-in default is
  used.
- **Knowledge base** (`Jessie AI → knowledge`): publish articles that ground
  the receptionist/knowledge/general assistants' answers.
- Provider selection (offline vs. hosted LLM) is configured via environment —
  see `docs/AI_CONFIGURATION.md`.

## Clinical documentation workflow

- Clinicians author notes as **drafts**, then **sign** them.
- Notes marked *requires co-sign* move to **pending co-sign**; a `SUPERVISOR`
  co-signs. Signed notes are amended (never edited in place) — every change is
  captured as an immutable **version**.

## Billing workflow

1. Configure **payers** and the **CPT fee schedule** (Billing, `BILLING`).
2. Create **claims** from services; **submit** them; post payer decisions via
   the claim **status** endpoint (accepted/denied/paid — ERA/EOB).
3. Create **invoices** for patient responsibility; **record payments**
   (via the configured payment provider); generate **superbills**.

## Monitoring

- **Reports** and **Analytics** show utilization, client, and revenue metrics.
- **Platform → system-health** returns a DB probe, counts, uptime, and memory.
- **Audit log** captures actor/action/entity for compliance (immutable).

## Security responsibilities

- Enforce strong passwords and least-privilege role assignment.
- Rotate provider keys and JWT secrets per policy.
- Review the audit trail regularly. See `docs/SECURITY.md`.
