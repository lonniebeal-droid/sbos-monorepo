-- CreateIndex
CREATE INDEX "Client_organizationId_status_idx" ON "Client"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Appointment_organizationId_clinicianId_startTime_idx" ON "Appointment"("organizationId", "clinicianId", "startTime");

-- CreateIndex
CREATE INDEX "Appointment_organizationId_startTime_idx" ON "Appointment"("organizationId", "startTime");

-- CreateIndex
CREATE INDEX "Note_organizationId_clientId_idx" ON "Note"("organizationId", "clientId");

-- CreateIndex
CREATE INDEX "Note_organizationId_status_idx" ON "Note"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Claim_organizationId_status_idx" ON "Claim"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Task_organizationId_status_idx" ON "Task"("organizationId", "status");

