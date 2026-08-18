-- Schema-review fix, same category as 20260818200000_waitlist_entry_org_fk.
-- ClinicianAvailability and ClinicianTimeOff were introduced in
-- 20260725100000_scheduling alongside WaitlistEntry, and both share the same
-- gap: organizationId was indexed but never given a foreign key, unlike
-- every other tenant-scoped table in this schema.
-- Generated and verified via `prisma migrate diff --from-schema-datamodel
-- <pre-change schema> --to-schema-datamodel <post-change schema> --script`
-- (no live database reachable in this session).

-- AddForeignKey
ALTER TABLE "ClinicianAvailability" ADD CONSTRAINT "ClinicianAvailability_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicianTimeOff" ADD CONSTRAINT "ClinicianTimeOff_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
