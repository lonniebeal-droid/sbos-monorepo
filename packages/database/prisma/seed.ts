import { randomUUID } from "node:crypto";

import {
  AppointmentStatus,
  AppointmentType,
  ClientStatus,
  DiagnosisType,
  Gender,
  NoteStatus,
  NoteType,
  PrismaClient,
  Role,
  TreatmentPlanStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Idempotent development seed. Establishes one organization with a full set of
 * users, clinicians, clients, appointments, and clinical records so the app and
 * API have realistic data to render against in local environments.
 */
async function main(): Promise<void> {
  if (process.env.SBOS_SEED_DEV !== 'true') {
    // Prevent accidental seeding in production. Require explicit opt-in.
    // eslint-disable-next-line no-console
    console.log('Skipping seed: SBOS_SEED_DEV not set to true');
    return;
  }
  const org = await prisma.organization.upsert({
    where: { slug: "success-brand" },
    update: {},
    create: {
      name: "Success Brand Behavioral Health",
      slug: "success-brand",
      npi: "1093847561",
      email: "hello@successbrand.org",
      phone: "(555) 018-2200",
      city: "Atlanta",
      state: "GA",
      timezone: "America/New_York",
    },
  });

  const adminUser = await prisma.user.upsert({
    where: {
      organizationId_email: {
        organizationId: org.id,
        email: "admin@sbos.health",
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      email: "admin@sbos.health",
      // bcrypt hash of "Sbos!2026"
      passwordHash:
        "$2a$10$W4hn0DhgeMwR19li6xaO3e.nvl9pfQ7cYzJEje2ZhRjFMyUB0oZIS",
      firstName: "Alex",
      lastName: "Administrator",
      role: Role.ORG_ADMIN,
    },
  });

  const clinicianUser = await prisma.user.upsert({
    where: {
      organizationId_email: {
        organizationId: org.id,
        email: "clinician@sbos.health",
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      email: "clinician@sbos.health",
      passwordHash:
        "$2a$10$W4hn0DhgeMwR19li6xaO3e.nvl9pfQ7cYzJEje2ZhRjFMyUB0oZIS",
      firstName: "Riley",
      lastName: "Chen",
      role: Role.CLINICIAN,
    },
  });

  const clinician = await prisma.clinician.upsert({
    where: { userId: clinicianUser.id },
    update: {},
    create: {
      organizationId: org.id,
      userId: clinicianUser.id,
      title: "Dr.",
      credentials: "PhD, LPC",
      npi: "1235551234",
      licenseState: "GA",
      specialties: ["Anxiety", "Trauma", "DBT"],
    },
  });

  const office = await prisma.location.upsert({
    where: { id: `loc_${org.id}` },
    update: {},
    create: {
      id: `loc_${org.id}`,
      organizationId: org.id,
      name: "Main Office",
      type: "OFFICE",
      city: "Atlanta",
      state: "GA",
    },
  });

  const clientSeeds = [
    { mrn: "SB-10241", firstName: "Jordan", lastName: "Mitchell", status: ClientStatus.ACTIVE },
    { mrn: "SB-10242", firstName: "Priya", lastName: "Shah", status: ClientStatus.INTAKE },
    { mrn: "SB-10243", firstName: "Marcus", lastName: "Turner", status: ClientStatus.ACTIVE },
  ];

  for (const seed of clientSeeds) {
    const client = await prisma.client.upsert({
      where: {
        organizationId_mrn: { organizationId: org.id, mrn: seed.mrn },
      },
      update: {},
      create: {
        organizationId: org.id,
        mrn: seed.mrn,
        firstName: seed.firstName,
        lastName: seed.lastName,
        dateOfBirth: new Date("1990-05-15"),
        gender: Gender.UNKNOWN,
        status: seed.status,
        primaryClinicianId: clinician.id,
      },
    });

    const start = new Date();
    start.setHours(9, 0, 0, 0);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + 50);

    const appointment = await prisma.appointment.create({
      data: {
        organizationId: org.id,
        clientId: client.id,
        clinicianId: clinician.id,
        locationId: office.id,
        type: AppointmentType.INDIVIDUAL,
        status: AppointmentStatus.SCHEDULED,
        startTime: start,
        endTime: end,
        durationMinutes: 50,
        cptCode: "90834",
      },
    });

    await prisma.note.create({
      data: {
        organizationId: org.id,
        clientId: client.id,
        clinicianId: clinician.id,
        authorId: clinicianUser.id,
        appointmentId: appointment.id,
        type: NoteType.BIRP,
        status: NoteStatus.SIGNED,
        title: "Session note",
        signedAt: new Date(),
        birp: {
          create: {
            behavior: "Client reported reduced anxiety this week.",
            intervention: "Practiced CBT thought-challenging exercises.",
            response: "Engaged well; identified two cognitive distortions.",
            plan: "Continue weekly sessions; assign thought-record homework.",
          },
        },
      },
    });

    await prisma.diagnosis.create({
      data: {
        organizationId: org.id,
        clientId: client.id,
        icd10Code: "F41.1",
        description: "Generalized anxiety disorder",
        type: DiagnosisType.PRIMARY,
      },
    });

    await prisma.treatmentPlan.create({
      data: {
        organizationId: org.id,
        clientId: client.id,
        clinicianId: clinician.id,
        title: "Anxiety management plan",
        status: TreatmentPlanStatus.ACTIVE,
        presentingProblem: "Persistent worry impacting daily functioning.",
        goals: {
          create: [
            {
              description: "Reduce frequency of panic episodes.",
              orderIndex: 0,
              objectives: {
                create: [
                  { description: "Practice diaphragmatic breathing daily.", orderIndex: 0 },
                  { description: "Complete weekly thought records.", orderIndex: 1 },
                ],
              },
            },
          ],
        },
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log(
    `Seed complete for organization ${org.name} (${org.id}). ` +
      `Admin: ${adminUser.email} · Clinician: ${clinicianUser.email}. ` +
      `Batch ${randomUUID().slice(0, 8)}.`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
