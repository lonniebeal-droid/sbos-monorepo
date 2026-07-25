import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Health')
@Controller({ path: 'health', version: '1' })
export class HealthController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness and readiness probe' })
  check() {
    return {
      status: 'ok',
      service: 'sbos-api',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
