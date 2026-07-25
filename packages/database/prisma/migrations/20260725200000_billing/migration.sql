-- CreateTable
CREATE TABLE "Payer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "payerId" TEXT,
    "planType" TEXT,
    "claimsAddress" TEXT,
    "phone" TEXT,
    "electronicPayerId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceCode" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "defaultFee" DECIMAL(12,2) NOT NULL,
    "defaultUnits" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payer_organizationId_idx" ON "Payer"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Payer_organizationId_name_key" ON "Payer"("organizationId", "name");

-- CreateIndex
CREATE INDEX "ServiceCode_organizationId_idx" ON "ServiceCode"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCode_organizationId_code_key" ON "ServiceCode"("organizationId", "code");

-- AddForeignKey
ALTER TABLE "Payer" ADD CONSTRAINT "Payer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCode" ADD CONSTRAINT "ServiceCode_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

