# Jessie / ElevenLabs hosted agent-tools audit

Date: 2026-09-07
Starting SHA: 5737f0cc5d0252c4cf464f2d3242daff5f6ea650

Current main already contains tenant-scoped scheduling and appointment services. The smallest safe adapter therefore exposes only authenticated readiness, availability lookup, and booking. It reuses `AvailabilityService.getSlots()` and `AppointmentsService.create()` so existing tenant scoping and double-booking protection remain authoritative.

Security contract: every adapter route is outside end-user JWT auth but protected by a dedicated high-entropy server-side secret in `x-ju-agent-tools-secret`. Tenant and audit actor IDs are server configuration only (`ELEVENLABS_AGENT_TOOLS_ORGANIZATION_ID`, `ELEVENLABS_AGENT_TOOLS_ACTOR_ID`), never caller-selectable. Missing secret/tenant/actor fails closed. No broad client search, PHI export, admin API, payment, or production secret surface is exposed.
