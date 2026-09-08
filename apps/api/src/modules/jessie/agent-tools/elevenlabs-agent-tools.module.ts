import { Module } from '@nestjs/common';

import { AppointmentsModule } from '../../appointments/appointments.module';
import { SchedulingModule } from '../../scheduling/scheduling.module';
import { ElevenLabsAgentToolsController } from './elevenlabs-agent-tools.controller';
import { ElevenLabsAgentToolsGuard } from './elevenlabs-agent-tools.guard';

@Module({
  imports: [AppointmentsModule, SchedulingModule],
  controllers: [ElevenLabsAgentToolsController],
  providers: [ElevenLabsAgentToolsGuard],
})
export class ElevenLabsAgentToolsModule {}
