import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { JessieAuthGuard } from './jessie-auth.guard';
import type { PrismaService } from '../../prisma/prisma.service';
import type { ConfigService } from '@nestjs/config';

function createMockContext(headers: Record<string, string>) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers,
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('JessieAuthGuard', () => {
  let guard: JessieAuthGuard;
  let prisma: any;
  let config: Partial<ConfigService>;

  beforeEach(() => {
    prisma = {
      organization: {
        findUnique: vi.fn().mockResolvedValue({ id: 'org-1', isActive: true }),
      },
    };
    config = {
      get: vi.fn().mockReturnValue('test-secret'),
    };
    guard = new JessieAuthGuard(config as ConfigService, prisma);
  });

  it('allows request with valid secret and organization', async () => {
    const context = createMockContext({
      authorization: 'Bearer test-secret',
      'x-organization-id': 'org-1',
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(prisma.organization.findUnique).toHaveBeenCalledWith({
      where: { id: 'org-1' },
      select: { id: true, isActive: true },
    });
  });

  it('rejects request without authorization header', async () => {
    const context = createMockContext({
      'x-organization-id': 'org-1',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects request with invalid secret', async () => {
    const context = createMockContext({
      authorization: 'Bearer wrong-secret',
      'x-organization-id': 'org-1',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects request without organization id', async () => {
    const context = createMockContext({
      authorization: 'Bearer test-secret',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects request for inactive organization', async () => {
    prisma.organization = {
      findUnique: vi.fn().mockResolvedValue({ id: 'org-1', isActive: false }),
    } as any;
    guard = new JessieAuthGuard(config as ConfigService, prisma as PrismaService);

    const context = createMockContext({
      authorization: 'Bearer test-secret',
      'x-organization-id': 'org-1',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects request for non-existent organization', async () => {
    prisma.organization = {
      findUnique: vi.fn().mockResolvedValue(null),
    } as any;
    guard = new JessieAuthGuard(config as ConfigService, prisma as PrismaService);

    const context = createMockContext({
      authorization: 'Bearer test-secret',
      'x-organization-id': 'org-999',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('attaches jessieContext to request on success', async () => {
    const request = {
      headers: {
        authorization: 'Bearer test-secret',
        'x-organization-id': 'org-1',
      },
    } as Record<string, unknown> & { jessieContext?: { organizationId: string; userId: string; isServiceAccount: boolean } };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    await guard.canActivate(context);

    expect(request.jessieContext).toEqual({
      organizationId: 'org-1',
      userId: 'jessie-service-account',
      isServiceAccount: true,
    });
  });
});