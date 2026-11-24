# SBOS — Project Status

SBOS (Success Brand Operating System) is a **multi-tenant SaaS behavioral-health
operating system**. It is a product in its own right; **SuccessBrand is Tenant
#1**, not the subject of the platform. There is no hardcoded tenant logic —
every table and endpoint is scoped by `organizationId` and supports unlimited
organizations, locations, staff, clinicians, clients, roles, and permissions.
**Jessie AI** is the platform's proprietary AI layer, architected as a
provider-abstracted module so it can eventually be licensed independently.

## Current status

This file previously carried its own snapshot of what's built and what's
outstanding; that content drifted out of sync with reality and has been
removed in favor of a single source of truth:

- **What's built, what's in progress, and known issues:**
  [`docs/CURRENT_STATUS.md`](docs/CURRENT_STATUS.md)
- **Why key decisions were made (RBAC, multi-tenancy, retention, etc.):**
  [`docs/DECISIONS.md`](docs/DECISIONS.md)
- **Feature-level roadmap:** [`docs/ROADMAP.md`](docs/ROADMAP.md)
