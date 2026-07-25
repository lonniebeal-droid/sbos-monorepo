import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

export interface UpsertFlagInput {
  key: string;
  isEnabled: boolean;
  description?: string;
}

@Injectable()
export class FeatureFlagsService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.featureFlag.findMany({
      where: { organizationId },
      orderBy: { key: 'asc' },
    });
  }

  /** Create or update a flag by key (idempotent). */
  upsert(organizationId: string, input: UpsertFlagInput) {
    return this.prisma.featureFlag.upsert({
      where: { organizationId_key: { organizationId, key: input.key } },
      create: {
        organizationId,
        key: input.key,
        isEnabled: input.isEnabled,
        description: input.description,
      },
      update: { isEnabled: input.isEnabled, description: input.description },
    });
  }

  async isEnabled(organizationId: string, key: string): Promise<boolean> {
    const flag = await this.prisma.featureFlag.findUnique({
      where: { organizationId_key: { organizationId, key } },
      select: { isEnabled: true },
    });
    return flag?.isEnabled ?? false;
  }
}
