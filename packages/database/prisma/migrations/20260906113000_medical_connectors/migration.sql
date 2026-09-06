CREATE TABLE "medical_connectors" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "vendor" TEXT NOT NULL,
  "baseUrl" TEXT NOT NULL,
  "clientId" TEXT,
  "scopes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'not_connected',
  "fhirVersion" TEXT,
  "lastTestedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "medical_connectors_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "medical_connectors_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "medical_connectors_organizationId_vendor_key" ON "medical_connectors"("organizationId", "vendor");
CREATE INDEX "medical_connectors_organizationId_idx" ON "medical_connectors"("organizationId");
CREATE INDEX "medical_connectors_status_idx" ON "medical_connectors"("status");
