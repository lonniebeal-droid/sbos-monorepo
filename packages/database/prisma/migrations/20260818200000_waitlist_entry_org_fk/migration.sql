-- Schema-review fix: WaitlistEntry.organizationId was a bare column with an
-- index but no foreign key, unlike every other tenant-scoped table in this
-- schema. Backfills the missing referential-integrity/tenant-scope guarantee.
-- Generated and verified via `prisma migrate diff --from-schema-datamodel
-- <pre-change schema> --to-schema-datamodel <post-change schema> --script`
-- against a live-DB-free diff (no local Postgres reachable in this session).

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
