import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { Public } from '../../../common/decorators/public.decorator';
import { AgentToolsGuard, AGENT_SECRET_HEADER } from './agent-tools.guard';
import { AgentToolsService } from './agent-tools.service';
import {
  CheckCalendarDto,
  LookupClientDto,
  SaveOrUpdateLeadDto,
  ScheduleAppointmentDto,
  SendEmailDto,
  SendSmsDto,
  TransferToHumanDto,
  GetBusinessInformationDto,
} from './dto/agent-tools.dto';

type AgentRequest = Request & { agentOrganizationId: string };

/**
 * ElevenLabs webhook-tool endpoints.
 * Authenticated via X-SBOS-Agent-Secret (maps to organization server-side).
 * JWT is not required — these are machine-to-machine tool calls.
 */
@ApiTags('Jessie Agent Tools')
@Public()
@UseGuards(AgentToolsGuard)
@ApiHeader({
  name: AGENT_SECRET_HEADER,
  description: 'Agent tool secret configured in JESSIE_AGENT_SECRETS',
  required: true,
})
@Controller({ path: 'jessie/agent/tools', version: '1' })
export class AgentToolsController {
  constructor(private readonly tools: AgentToolsService) {}

  private org(req: AgentRequest): string {
    return req.agentOrganizationId;
  }

  @Post('lookup_client')
  @HttpCode(200)
  @ApiOperation({ summary: 'Lookup a client in the agent organization' })
  lookupClient(@Req() req: AgentRequest, @Body() dto: LookupClientDto) {
    return this.tools.lookupClient(this.org(req), dto);
  }

  @Post('save_or_update_lead')
  @HttpCode(200)
  @ApiOperation({ summary: 'Create or update a prospect lead' })
  saveOrUpdateLead(@Req() req: AgentRequest, @Body() dto: SaveOrUpdateLeadDto) {
    return this.tools.saveOrUpdateLead(this.org(req), dto);
  }

  @Post('check_calendar')
  @HttpCode(200)
  @ApiOperation({ summary: 'List open calendar slots for a clinician' })
  checkCalendar(@Req() req: AgentRequest, @Body() dto: CheckCalendarDto) {
    return this.tools.checkCalendar(this.org(req), dto);
  }

  @Post('schedule_appointment')
  @HttpCode(200)
  @ApiOperation({ summary: 'Book an appointment for a client' })
  scheduleAppointment(
    @Req() req: AgentRequest,
    @Body() dto: ScheduleAppointmentDto,
  ) {
    return this.tools.scheduleAppointment(this.org(req), dto);
  }

  @Post('send_sms')
  @HttpCode(200)
  @ApiOperation({ summary: 'Send an SMS via the configured provider' })
  sendSms(@Req() req: AgentRequest, @Body() dto: SendSmsDto) {
    return this.tools.sendSms(this.org(req), dto);
  }

  @Post('send_email')
  @HttpCode(200)
  @ApiOperation({ summary: 'Send an email via the configured provider' })
  sendEmail(@Req() req: AgentRequest, @Body() dto: SendEmailDto) {
    return this.tools.sendEmail(this.org(req), dto);
  }

  @Post('transfer_to_human')
  @HttpCode(200)
  @ApiOperation({ summary: 'Escalate to staff via a high-priority task' })
  transferToHuman(@Req() req: AgentRequest, @Body() dto: TransferToHumanDto) {
    return this.tools.transferToHuman(this.org(req), dto);
  }

  @Post('get_business_information')
  @HttpCode(200)
  @ApiOperation({ summary: 'Organization business profile (services, FAQ, hours) for the agent org' })
  getBusinessInformation(
    @Req() req: AgentRequest,
    @Body() dto: GetBusinessInformationDto,
  ) {
    return this.tools.getBusinessInformation(this.org(req), dto);
  }
}
