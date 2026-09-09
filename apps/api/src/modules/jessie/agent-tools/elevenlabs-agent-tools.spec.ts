import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { ElevenLabsAgentToolsController } from './elevenlabs-agent-tools.controller';
import { ElevenLabsAgentToolsGuard } from './elevenlabs-agent-tools.guard';

describe('ElevenLabs agent tools', () => {
  const config = (values: Record<string, string | undefined>) => ({
    get: (key: string) => values[key],
  });

  const prisma = (overrides: Record<string, unknown> = {}) => ({
    user: { findFirst: vi.fn().mockResolvedValue({ id: 'actor-1' }) },
    clinician: { findFirst: vi.fn().mockResolvedValue({ id: 'clinician-1' }) },
    location: { findFirst: vi.fn().mockResolvedValue({ id: 'location-1' }) },
    ...overrides,
  });

  it('fails closed when the shared secret is missing or wrong', () => {
    const guard = new ElevenLabsAgentToolsGuard(
      config({ ELEVENLABS_AGENT_TOOLS_SECRET: 'correct-secret' }) as never,
    );
    const context = (secret?: string) => ({
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { 'x-ju-agent-tools-secret': secret },
        }),
      }),
    });

    expect(() => guard.canActivate(context() as never)).toThrow(
      UnauthorizedException,
    );
    expect(() => guard.canActivate(context('wrong-secret') as never)).toThrow(
      UnauthorizedException,
    );
    expect(guard.canActivate(context('correct-secret') as never)).toBe(true);
  });

  it('uses only server-configured tenant and actor IDs', async () => {
    const availability = {
      getSlots: vi.fn().mockResolvedValue([{ start: '2026-09-08T14:00:00.000Z' }]),
    };
    const appointments = {
      create: vi.fn().mockResolvedValue({ id: 'appt-1' }),
    };
    const controller = new ElevenLabsAgentToolsController(
      config({
        ELEVENLABS_AGENT_TOOLS_ORGANIZATION_ID: 'org-1',
        ELEVENLABS_AGENT_TOOLS_ACTOR_ID: 'actor-1',
      }) as never,
      availability as never,
      appointments as never,
      prisma() as never,
    );

    await controller.availabilitySlots('clinician-1', '2026-09-08', '50');
    expect(availability.getSlots).toHaveBeenCalledWith(
      'org-1',
      'clinician-1',
      '2026-09-08',
      50,
    );

    const dto = {
      clientId: 'client-1',
      clinicianId: 'clinician-1',
      startTime: '2026-09-08T14:00:00.000Z',
      endTime: '2026-09-08T14:50:00.000Z',
      durationMinutes: 50,
    };
    await controller.book(dto);
    expect(appointments.create).toHaveBeenCalledWith('org-1', 'actor-1', dto);
  });

  it('blocks booking when server-side actor config is absent', async () => {
    const controller = new ElevenLabsAgentToolsController(
      config({ ELEVENLABS_AGENT_TOOLS_ORGANIZATION_ID: 'org-1' }) as never,
      {} as never,
      {} as never,
      prisma() as never,
    );
    await expect(
      controller.book({
        clientId: 'c',
        clinicianId: 'cl',
        startTime: '2026-09-08T14:00:00.000Z',
        endTime: '2026-09-08T14:50:00.000Z',
        durationMinutes: 50,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a clinician outside the configured organization before mutation', async () => {
    const appointments = { create: vi.fn() };
    const db = prisma({
      clinician: { findFirst: vi.fn().mockResolvedValue(null) },
    });
    const controller = new ElevenLabsAgentToolsController(
      config({
        ELEVENLABS_AGENT_TOOLS_ORGANIZATION_ID: 'org-1',
        ELEVENLABS_AGENT_TOOLS_ACTOR_ID: 'actor-1',
      }) as never,
      {} as never,
      appointments as never,
      db as never,
    );

    await expect(controller.book({
      clientId: 'client-1', clinicianId: 'foreign-clinician',
      startTime: '2026-09-08T14:00:00.000Z', endTime: '2026-09-08T14:50:00.000Z', durationMinutes: 50,
    })).rejects.toThrow(NotFoundException);
    expect(db.clinician.findFirst).toHaveBeenCalledWith({
      where: { id: 'foreign-clinician', organizationId: 'org-1' }, select: { id: true },
    });
    expect(appointments.create).not.toHaveBeenCalled();
  });

  it('rejects a foreign location and a stale or cross-tenant actor before mutation', async () => {
    const appointments = { create: vi.fn() };
    const db = prisma({
      user: { findFirst: vi.fn().mockResolvedValue(null) },
      location: { findFirst: vi.fn().mockResolvedValue(null) },
    });
    const controller = new ElevenLabsAgentToolsController(
      config({
        ELEVENLABS_AGENT_TOOLS_ORGANIZATION_ID: 'org-1',
        ELEVENLABS_AGENT_TOOLS_ACTOR_ID: 'foreign-actor',
      }) as never,
      {} as never,
      appointments as never,
      db as never,
    );

    await expect(controller.book({
      clientId: 'client-1', clinicianId: 'clinician-1', locationId: 'foreign-location',
      startTime: '2026-09-08T14:00:00.000Z', endTime: '2026-09-08T14:50:00.000Z', durationMinutes: 50,
    })).rejects.toThrow(NotFoundException);
    expect(db.user.findFirst).toHaveBeenCalledWith({
      where: { id: 'foreign-actor', organizationId: 'org-1', status: 'ACTIVE' }, select: { id: true },
    });
    expect(appointments.create).not.toHaveBeenCalled();
  });

});
