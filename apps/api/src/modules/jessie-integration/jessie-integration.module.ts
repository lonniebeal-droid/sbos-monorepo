import { Module } from '@nestjs/common';

import { JessieIntegrationController } from './jessie-integration.controller';
import { JessieIntegrationService } from './jessie-integration.service';

@Module({
  controllers: [JessieIntegrationController],
  providers: [JessieIntegrationService],
  exports: [JessieIntegrationService],
})
export class JessieIntegrationModule {}