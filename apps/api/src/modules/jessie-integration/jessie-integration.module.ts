import { Module } from '@nestjs/common';

import { JessieIntegrationController } from './jessie-integration.controller';
import { JessieBusinessConfigController } from './jessie-business-config.controller';
import { JessieIntegrationService } from './jessie-integration.service';

@Module({
  controllers: [JessieIntegrationController, JessieBusinessConfigController],
  providers: [JessieIntegrationService],
  exports: [JessieIntegrationService],
})
export class JessieIntegrationModule {}