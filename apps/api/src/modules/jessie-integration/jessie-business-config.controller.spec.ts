import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { AuditAction } from '@sbos/database';
import { JessieBusinessConfigController, sanitizeJessieAdminProfile } from './jessie-business-config.controller';
import { Role } from '../../common/enums/role.enum';

const user = { id: 'admin-a', organizationId: 'org-a', role: Role.ORG_ADMIN, email: 'a@example.com', name: 'A' };

describe('Jessie admin profile editor', () => {
  it('rejects cross-tenant identifiers, booking enablement, and malformed profile', () => {
    expect(() => sanitizeJessieAdminProfile({ organizationId: 'org-b' })).toThrow(BadRequestException);
    expect(() => sanitizeJessieAdminProfile({ bookingEnabled: true })).toThrow(BadRequestException);
    expect(() => sanitizeJessieAdminProfile([])).toThrow(BadRequestException);
  });
  it('normalizes approved values and strips invalid transfers', () => {
    const profile = sanitizeJessieAdminProfile({
      greeting: '  Welcome!  ',
      transferNumbers: ['+14045550123', 'not-a-phone'],
      services: ['Consultation'], afterHoursBehavior: 'callback',
    });
    expect(profile.greeting).toBe('Welcome!');
    expect(profile.transferNumbers).toEqual(['+14045550123']);
    expect(profile.services).toEqual(['Consultation']);
  });
  it('reads and writes only the authenticated organization and records an audit', async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const upsert = vi.fn().mockResolvedValue({ profile: { greeting: 'Hello' }, isActive: true });
    const record = vi.fn();
    const controller = new JessieBusinessConfigController(
      { jessieBusinessConfig: { findUnique, upsert } } as any,
      { record } as any,
    );
    await controller.get(user);
    await controller.update(user, { profile: { greeting: 'Hello' }, isActive: true });
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: 'org-a' } }));
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: 'org-a' } }));
    expect(record).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org-a', actorId: 'admin-a', action: AuditAction.UPDATE,
    }));
    await expect(controller.update(user, { profile: {}, isActive: 'yes' })).rejects.toThrow(BadRequestException);
  });
});
