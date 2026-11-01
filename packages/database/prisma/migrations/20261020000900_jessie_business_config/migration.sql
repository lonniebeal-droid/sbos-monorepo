CREATE TABLE "JessieBusinessConfig" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "profile" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JessieBusinessConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "JessieBusinessConfig_organizationId_key" ON "JessieBusinessConfig"("organizationId");
ALTER TABLE "JessieBusinessConfig" ADD CONSTRAINT "JessieBusinessConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
