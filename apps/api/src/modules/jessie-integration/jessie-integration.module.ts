import { JessiePostCallController } from './post-call.controller';
import { ElevenLabsWebhookGuard } from './guards/elevenlabs-webhook.guard';
import { Module } from '@nestjs/common';

import { JessieIntegrationController } from './jessie-integration.controller';
import { JessieBusinessConfigController } from './jessie-business-config.controller';
import { JessieIntegrationService } from './jessie-integration.service';

@Module({
  controllers: [JessiePostCallController, JessieIntegrationController, JessieBusinessConfigController],
  providers: [ElevenLabsWebhookGuard, JessieIntegrationService],
  exports: [JessieIntegrationService],
})
export class JessieIntegrationModule {}