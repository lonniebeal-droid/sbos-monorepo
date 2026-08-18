-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Client_organizationId_deletedAt_idx" ON "Client"("organizationId", "deletedAt");
