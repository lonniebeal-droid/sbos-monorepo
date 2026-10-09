import { Module } from '@nestjs/common';

import { JessieController } from './jessie.controller';
import { JessieIntegrationController } from './jessie-integration.controller';
import { ConversationsService } from './conversations.service';
import { PromptsService } from './prompts.service';
import { KnowledgeService } from './knowledge.service';
import { JessieIntegrationService } from './jessie-integration.service';
import { JessieAuthGuard } from './jessie-auth.guard';

/**
 * Jessie AI — the platform's proprietary assistant layer. Self-contained and
 * provider-abstracted so it can be licensed independently of the rest of SBOS.
 */
@Module({
  controllers: [JessieController, JessieIntegrationController],
  providers: [
    ConversationsService,
    PromptsService,
    KnowledgeService,
    JessieIntegrationService,
    JessieAuthGuard,
  ],
  exports: [
    ConversationsService,
    PromptsService,
    KnowledgeService,
    JessieIntegrationService,
  ],
})
export class JessieModule {}
