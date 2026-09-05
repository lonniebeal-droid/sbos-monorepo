import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { Role } from '../../common/enums/role.enum';
import { UsersController } from './users.controller';

describe('UsersController privileged role grants', () => {
  const baseUser = {
    id: 'admin-1',
    email: 'admin@example.test',
    name: 'Admin',
    role: Role.ORG_ADMIN,
    organizationId: 'org-1',
  };

  it('blocks ORG_ADMIN from creating a SUPER_ADMIN', () => {
    const service = { create: vi.fn(), createInvite: vi.fn() };
    const controller = new UsersController(service as never);
    expect(() => controller.create({
      email: 'super@example.test', name: 'Super User', password: 'Passw0rd!', role: Role.SUPER_ADMIN,
    }, baseUser)).toThrow(ForbiddenException);
    expect(service.create).not.toHaveBeenCalled();
  });

  it('blocks ORG_ADMIN from inviting a SUPER_ADMIN', async () => {
    const service = { create: vi.fn(), createInvite: vi.fn() };
    const controller = new UsersController(service as never);
    await expect(controller.invite({ email: 'super@example.test', role: Role.SUPER_ADMIN }, baseUser)).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.createInvite).not.toHaveBeenCalled();
  });

  it('allows SUPER_ADMIN to grant SUPER_ADMIN inside the authenticated organization', async () => {
    const service = { create: vi.fn().mockResolvedValue({ id: 'u2' }), createInvite: vi.fn() };
    const controller = new UsersController(service as never);
    const superUser = { ...baseUser, role: Role.SUPER_ADMIN };
    await controller.create({ email: 'super2@example.test', name: 'Super Two', password: 'Passw0rd!', role: Role.SUPER_ADMIN }, superUser);
    expect(service.create).toHaveBeenCalledWith('org-1', expect.objectContaining({ role: Role.SUPER_ADMIN }));
  });
});
