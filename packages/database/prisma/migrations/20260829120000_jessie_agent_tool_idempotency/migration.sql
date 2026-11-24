-- Atomic idempotency for Jessie agent tools: one claim per (org, tool:key).
-- Partial unique index so normal multi-event AuditLog rows for the same entity remain allowed.
CREATE UNIQUE INDEX IF NOT EXISTS "AuditLog_jessie_agent_tool_idempotency_uidx"
ON "AuditLog" ("organizationId", "entityType", "entityId")
WHERE "entityType" = 'JessieAgentTool' AND "entityId" IS NOT NULL;
