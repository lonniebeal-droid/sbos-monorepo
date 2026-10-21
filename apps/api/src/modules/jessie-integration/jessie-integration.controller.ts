import {
  Body,
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiHeader, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';

import { Public } from '../../common/decorators/public.decorator';
import { JessieIntegrationService } from './jessie-integration.service';
import {
  AGENT_SECRET_HEADER,
  AgentToolsGuard,
} from '../jessie/tools/agent-tools.guard';
import {
  LookupClientRequestDto,
  LookupClientResponseDto,
  LookupClientErrorResponseDto,
} from './dto/lookup-client.dto';
import {
  CaptureLeadRequestDto,
  CaptureLeadResponseDto,
  CaptureLeadErrorResponseDto,
} from './dto/capture-lead.dto';
import {
  CreateAppointmentRequestDto,
  AppointmentRequestResponseDto,
  AppointmentRequestErrorResponseDto,
} from './dto/appointment-request.dto';
import {
  TransferCallRequestDto,
  TransferCallResponseDto,
  TransferCallErrorResponseDto,
} from './dto/transfer-call.dto';
import {
  SendMessageOrCallbackRequestDto,
  CallbackMessageResponseDto,
  CallbackMessageErrorResponseDto,
} from './dto/callback-message.dto';
import {
  LogCallOutcomeRequestDto,
  LogCallOutcomeResponseDto,
  LogCallOutcomeErrorResponseDto,
} from './dto/call-outcome.dto';
import {
  GetBusinessInformationRequestDto,
  BusinessInformationResponseDto,
  BusinessInformationErrorResponseDto,
} from './dto/business-information.dto';

type AgentRequest = Request & { agentOrganizationId: string };

@ApiTags('Jessie Integration (ElevenLabs)')
@Public()
@ApiHeader({
  name: AGENT_SECRET_HEADER,
  description:
    'Agent tool secret configured in JESSIE_AGENT_SECRETS for the target organization',
  required: true,
})
@Controller({ path: 'jessie/integration', version: '1' })
@UseGuards(AgentToolsGuard)
export class JessieIntegrationController {
  constructor(private readonly service: JessieIntegrationService) {}

  private org(req: AgentRequest): string {
    return req.agentOrganizationId;
  }

  @Post('lookup-client')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resolve client configuration from ElevenLabs inbound context' })
  @ApiBody({ type: LookupClientRequestDto })
  @ApiResponse({ status: 200, type: LookupClientResponseDto })
  @ApiResponse({ status: 404, type: LookupClientErrorResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid or missing SBOS agent secret' })
  async lookupClient(
    @Req() req: AgentRequest,
    @Body() dto: LookupClientRequestDto,
  ): Promise<LookupClientResponseDto> {
    return this.service.lookupClient(this.org(req), dto);
  }

  @Post('capture-lead')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Capture a lead from an ElevenLabs conversation' })
  @ApiBody({ type: CaptureLeadRequestDto })
  @ApiResponse({ status: 200, type: CaptureLeadResponseDto })
  @ApiResponse({ status: 400, type: CaptureLeadErrorResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid or missing SBOS agent secret' })
  async captureLead(
    @Req() req: AgentRequest,
    @Body() dto: CaptureLeadRequestDto,
  ): Promise<CaptureLeadResponseDto> {
    return this.service.captureLead(this.org(req), dto);
  }

  @Post('appointment-request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create an appointment request from ElevenLabs' })
  @ApiBody({ type: CreateAppointmentRequestDto })
  @ApiResponse({ status: 200, type: AppointmentRequestResponseDto })
  @ApiResponse({ status: 400, type: AppointmentRequestErrorResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid or missing SBOS agent secret' })
  async createAppointmentRequest(
    @Req() req: AgentRequest,
    @Body() dto: CreateAppointmentRequestDto,
  ): Promise<AppointmentRequestResponseDto> {
    return this.service.createAppointmentRequest(this.org(req), dto);
  }

  @Post('transfer-call')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get transfer decision for ElevenLabs call' })
  @ApiBody({ type: TransferCallRequestDto })
  @ApiResponse({ status: 200, type: TransferCallResponseDto })
  @ApiResponse({ status: 400, type: TransferCallErrorResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid or missing SBOS agent secret' })
  async transferCall(
    @Req() req: AgentRequest,
    @Body() dto: TransferCallRequestDto,
  ): Promise<TransferCallResponseDto> {
    return this.service.transferCall(this.org(req), dto);
  }

  @Post('callback-message')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record a callback or message request from ElevenLabs' })
  @ApiBody({ type: SendMessageOrCallbackRequestDto })
  @ApiResponse({ status: 200, type: CallbackMessageResponseDto })
  @ApiResponse({ status: 400, type: CallbackMessageErrorResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid or missing SBOS agent secret' })
  async sendMessageOrCallbackRequest(
    @Req() req: AgentRequest,
    @Body() dto: SendMessageOrCallbackRequestDto,
  ): Promise<CallbackMessageResponseDto> {
    return this.service.sendMessageOrCallbackRequest(this.org(req), dto);
  }

  @Post('call-outcome')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log call outcome from ElevenLabs' })
  @ApiBody({ type: LogCallOutcomeRequestDto })
  @ApiResponse({ status: 200, type: LogCallOutcomeResponseDto })
  @ApiResponse({ status: 400, type: LogCallOutcomeErrorResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid or missing SBOS agent secret' })
  async logCallOutcome(
    @Req() req: AgentRequest,
    @Body() dto: LogCallOutcomeRequestDto,
  ): Promise<LogCallOutcomeResponseDto> {
    return this.service.logCallOutcome(this.org(req), dto);
  }

  @Post('business-information')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get business information for ElevenLabs' })
  @ApiBody({ type: GetBusinessInformationRequestDto })
  @ApiResponse({ status: 200, type: BusinessInformationResponseDto })
  @ApiResponse({ status: 404, type: BusinessInformationErrorResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid or missing SBOS agent secret' })
  async getBusinessInformation(
    @Req() req: AgentRequest,
    @Body() dto: GetBusinessInformationRequestDto,
  ): Promise<BusinessInformationResponseDto> {
    return this.service.getBusinessInformation(this.org(req), dto);
  }
}
