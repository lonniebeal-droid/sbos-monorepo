import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('Health')
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness and readiness probe (includes DB check)' })
  async check() {
    const start = process.hrtime.bigint();
    let dbStatus = 'up';
    let dbLatencyMs: number | null = null;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Math.round(Number(process.hrtime.bigint() - start) / 1_000_0) / 10;
    } catch {
      dbStatus = 'down';
    }

    const status = dbStatus === 'up' ? 'ok' : 'degraded';
    return {
      status,
      service: 'sbos-api',
      database: { status: dbStatus, latencyMs: dbLatencyMs },
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
    };
  }
}
