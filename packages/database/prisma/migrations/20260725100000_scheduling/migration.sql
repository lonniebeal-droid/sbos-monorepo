-- CreateEnum
CREATE TYPE "WaitlistStatus" AS ENUM ('WAITING', 'OFFERED', 'SCHEDULED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "checkedOutAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ClinicianAvailability" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "locationId" TEXT,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicianAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicianTimeOff" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "reason" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClinicianTimeOff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clinicianId" TEXT,
    "appointmentType" "AppointmentType" NOT NULL DEFAULT 'INDIVIDUAL',
    "status" "WaitlistStatus" NOT NULL DEFAULT 'WAITING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "preferredNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClinicianAvailability_organizationId_idx" ON "ClinicianAvailability"("organizationId");

-- CreateIndex
CREATE INDEX "ClinicianAvailability_clinicianId_idx" ON "ClinicianAvailability"("clinicianId");

-- CreateIndex
CREATE INDEX "ClinicianAvailability_dayOfWeek_idx" ON "ClinicianAvailability"("dayOfWeek");

-- CreateIndex
CREATE INDEX "ClinicianTimeOff_organizationId_idx" ON "ClinicianTimeOff"("organizationId");

-- CreateIndex
CREATE INDEX "ClinicianTimeOff_clinicianId_idx" ON "ClinicianTimeOff"("clinicianId");

-- CreateIndex
CREATE INDEX "ClinicianTimeOff_startsAt_idx" ON "ClinicianTimeOff"("startsAt");

-- CreateIndex
CREATE INDEX "WaitlistEntry_organizationId_idx" ON "WaitlistEntry"("organizationId");

-- CreateIndex
CREATE INDEX "WaitlistEntry_status_idx" ON "WaitlistEntry"("status");

-- CreateIndex
CREATE INDEX "WaitlistEntry_clientId_idx" ON "WaitlistEntry"("clientId");

-- AddForeignKey
ALTER TABLE "ClinicianAvailability" ADD CONSTRAINT "ClinicianAvailability_clinicianId_fkey" FOREIGN KEY ("clinicianId") REFERENCES "Clinician"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicianTimeOff" ADD CONSTRAINT "ClinicianTimeOff_clinicianId_fkey" FOREIGN KEY ("clinicianId") REFERENCES "Clinician"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_clinicianId_fkey" FOREIGN KEY ("clinicianId") REFERENCES "Clinician"("id") ON DELETE SET NULL ON UPDATE CASCADE;

