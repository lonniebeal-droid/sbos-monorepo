#!/usr/bin/env node
import('node:process').then(() => {});
// Small runtime script to create a test org + client using @prisma/client
(async () => {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const now = Date.now().toString().slice(-6);
    const org = await prisma.organization.create({
      data: {
        name: `test-org-${now}`,
        slug: `test-org-${now}`,
        email: `test+${now}@example.com`,
      },
    });
    const client = await prisma.client.create({
      data: {
        organizationId: org.id,
        mrn: `T-${now}`,
        firstName: 'Cross',
        lastName: 'Tenant',
        dateOfBirth: new Date('1990-01-01'),
      },
    });
    console.log(JSON.stringify({ orgId: org.id, clientId: client.id }));
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
