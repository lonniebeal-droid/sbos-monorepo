import { Global, Module } from '@nestjs/common';

import { PlatformController } from './platform.controller';
import { FeatureFlagsService } from './feature-flags.service';
import { SystemHealthService } from './system-health.service';

/** Global so FeatureFlagsService can gate behavior in any module. */
@Global()
@Module({
  controllers: [PlatformController],
  providers: [FeatureFlagsService, SystemHealthService],
  exports: [FeatureFlagsService],
})
export class PlatformModule {}
