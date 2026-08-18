-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Document_organizationId_deletedAt_idx" ON "Document"("organizationId", "deletedAt");
