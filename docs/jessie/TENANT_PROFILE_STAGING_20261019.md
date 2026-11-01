# Jessie tenant profile — staging only

Branch `ju/jessie-tenant-profile-20261019` adds one optional `JessieBusinessConfig` per organization. The record is disabled by default (`isActive=false`) and does not modify existing organizations. A missing or disabled record returns existing safe defaults.

Profile JSON supports greeting, businessType, businessHours, services, faq, transferRules, E.164 transferNumbers, afterHoursBehavior, restrictedTopics, approvedClaims and customInstructions. Only allowlisted fields are returned; organization ID, business name, contact details and active status always come from the authenticated organization. No user-facing editing API has been added.

`bookingEnabled` remains false even if JSON requests true. `appointment-request` is a follow-up request, NOT a confirmed booking. Do not advertise live calendar booking or transfers without provider registration, routing verification, and live acceptance.

Validation: Prisma schema validate and generate; full API tests; TypeScript noEmit; all 16 migrations applied successfully to disposable Postgres on localhost port 55433 with tmpfs, then container stopped. Existing production database and API were not modified.

Next gate: admin-only configuration editor with validation/audit; verify tool registration in ElevenLabs and actual number assignment; run isolated authenticated tenant tests, then review release migration and controlled deploy. No PHI in staging.
