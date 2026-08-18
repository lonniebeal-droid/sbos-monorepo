import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SystemHealthService {
  constructor(private readonly prisma: PrismaService) {}

  /** Database connectivity + latency probe. */
  private async database(): Promise<{ status: string; latencyMs: number | null }> {
    const start = process.hrtime.bigint();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const latencyMs = Number(process.hrtime.bigint() - start) / 1_000_000;
      return { status: 'up', latencyMs: Math.round(latencyMs * 100) / 100 };
    } catch {
      return { status: 'down', latencyMs: null };
    }
  }

  /** Organization-scoped operational snapshot for the admin dashboard. */
  async snapshot(organizationId: string) {
    const database = await this.database();

    let counts: Record<string, number> = {};
    if (database.status === 'up') {
      const [users, clients, appointments, notes, claims] = await Promise.all([
        this.prisma.user.count({ where: { organizationId } }),
        this.prisma.client.count({ where: { organizationId, deletedAt: null } }),
        this.prisma.appointment.count({ where: { organizationId } }),
        this.prisma.note.count({ where: { organizationId } }),
        this.prisma.claim.count({ where: { organizationId } }),
      ]);
      counts = { users, clients, appointments, notes, claims };
    }

    return {
      status: database.status === 'up' ? 'healthy' : 'degraded',
      service: 'sbos-api',
      database,
      counts,
      uptimeSeconds: Math.round(process.uptime()),
      memory: {
        rssMb: Math.round(process.memoryUsage().rss / 1_048_576),
      },
      timestamp: new Date().toISOString(),
    };
  }
}
