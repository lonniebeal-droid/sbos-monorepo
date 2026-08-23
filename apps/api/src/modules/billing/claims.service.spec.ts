import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { ClaimsService } from './claims.service';
import { ClaimStatus } from '@sbos/database';

describe('ClaimsService (transitions)', () => {
  const mockPrisma: any = {
    claim: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  };
  const mockAudit: any = { record: vi.fn() };

  const svc = new ClaimsService(mockPrisma as any, mockAudit as any);

  it('rejects backward transition (PAID -> DRAFT)', async () => {
    const claim = { id: 'c1', status: ClaimStatus.PAID };
    mockPrisma.claim.findFirst.mockResolvedValueOnce(claim);
    await expect(
      svc.updateStatus('org', 'actor', 'c1', { status: ClaimStatus.DRAFT as any }),
    ).rejects.toThrow(BadRequestException);
  });

  it('requires paidAmount when marking PAID', async () => {
    const claim = { id: 'c2', status: ClaimStatus.SUBMITTED };
    mockPrisma.claim.findFirst.mockResolvedValueOnce(claim);
    await expect(
      svc.updateStatus('org', 'actor', 'c2', { status: ClaimStatus.PAID as any }),
    ).rejects.toThrow(BadRequestException);
  });

  it('allows forward transition (DRAFT -> SUBMITTED)', async () => {
    const claim = { id: 'c3', status: ClaimStatus.DRAFT };
    mockPrisma.claim.findFirst.mockResolvedValueOnce(claim);
    mockPrisma.claim.update.mockResolvedValueOnce({ ...claim, status: ClaimStatus.SUBMITTED });
    const updated = await svc.updateStatus('org', 'actor', 'c3', { status: ClaimStatus.SUBMITTED as any });
    expect(updated.status).toBe(ClaimStatus.SUBMITTED);
  });
});
