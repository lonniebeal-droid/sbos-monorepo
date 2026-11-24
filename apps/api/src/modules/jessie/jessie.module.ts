import { Module } from '@nestjs/common';

import { AppointmentsModule } from '../appointments/appointments.module';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { JessieController } from './jessie.controller';
import { JessieIntegrationController } from './jessie-integration.controller';
import { ConversationsService } from './conversations.service';
import { PromptsService } from './prompts.service';
import { KnowledgeService } from './knowledge.service';
import { JessieIntegrationService } from './jessie-integration.service';
import { JessieAuthGuard } from './jessie-auth.guard';
import { AgentToolsController } from './tools/agent-tools.controller';
import { AgentToolsService } from './tools/agent-tools.service';
import { AgentToolsGuard } from './tools/agent-tools.guard';

/**
 * Jessie AI — the platform's proprietary assistant layer. Self-contained and
 * provider-abstracted so it can be licensed independently of the rest of SBOS.
 * Includes ElevenLabs agent tool webhooks under /jessie/agent/tools.
 */
@Module({
  imports: [AppointmentsModule, SchedulingModule],
  controllers: [JessieController, JessieIntegrationController, AgentToolsController],
  providers: [
    ConversationsService,
    PromptsService,
    KnowledgeService,
    JessieIntegrationService,
    JessieAuthGuard,
    AgentToolsService,
    AgentToolsGuard,
  ],
  exports: [
    ConversationsService,
    PromptsService,
    KnowledgeService,
    JessieIntegrationService,
    AgentToolsService,
  ],
})
export class JessieModule {}
