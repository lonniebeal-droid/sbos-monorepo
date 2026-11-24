# Jessie tenant profile administration — staging release

Authenticated organization administrators can GET and PATCH `/api/v1/jessie/business-profile`. PATCH accepts `{ "profile": { ... }, "isActive": false }` with approved fields only. The organization is always resolved from the signed-in user's JWT, never from request JSON. Non-admin roles are blocked by the existing global roles guard. Changes are audit logged without storing profile contents in audit metadata.

Supported fields: greeting, businessType, businessHours, services, faq, transferRules, transferNumbers (E.164 only), afterHoursBehavior, restrictedTopics, approvedClaims, customInstructions. Tenant identity and contact information cannot be overwritten. Booking stays disabled, regardless of tenant input. Activation is explicit and off by default.

Validation: 67 Jessie integration tests and TypeScript noEmit passed. No production schema migration, tenant activation, or live call test was performed in this change. Release only after isolated staging checks and a reviewed database backup/migration plan.
