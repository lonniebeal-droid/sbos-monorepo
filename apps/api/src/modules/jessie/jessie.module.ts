import { Module } from '@nestjs/common';

import { JessieController } from './jessie.controller';
import { ConversationsService } from './conversations.service';
import { PromptsService } from './prompts.service';
import { KnowledgeService } from './knowledge.service';

/**
 * Jessie AI — the platform's proprietary assistant layer. Self-contained and
 * provider-abstracted so it can be licensed independently of the rest of SBOS.
 */
@Module({
  controllers: [JessieController],
  providers: [ConversationsService, PromptsService, KnowledgeService],
  exports: [ConversationsService, PromptsService, KnowledgeService],
})
export class JessieModule {}
