import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JessieAuthGuard, JessieContext } from './jessie-auth.guard';
import {
  LookupClientRequestDto,
  LookupClientResponseDto,
  CaptureLeadRequestDto,
  CaptureLeadResponseDto,
  CreateOrRequestAppointmentRequestDto,
  CreateOrRequestAppointmentResponseDto,
  TransferCallRequestDto,
  TransferCallResponseDto,
  SendMessageOrCallbackRequestDto,
  SendMessageOrCallbackResponseDto,
  LogCallOutcomeRequestDto,
  LogCallOutcomeResponseDto,
  GetBusinessInformationResponseDto,
  JessieIntegrationResponseDto,
} from './dto/jessie-integration.dto';
import { JessieIntegrationService } from './jessie-integration.service';

@ApiTags('Jessie Integration')
@ApiBearerAuth()
@Controller({ path: 'jessie/integration', version: '1' })
@UseGuards(JessieAuthGuard)
export class JessieIntegrationController {
  constructor(private readonly service: JessieIntegrationService) {}

  private getContext(@Req() req: { jessieContext?: JessieContext }): JessieContext {
    if (!req.jessieContext) {
      throw new Error('Jessie context not set - guard should have run');
    }
    return req.jessieContext;
  }

  @Post('lookup-client')
  @HttpCode(200)
  @ApiOperation({ summary: 'Look up a client by ID (tenant-safe)' })
  async lookupClient(
    @Req() req: { jessieContext?: JessieContext },
    @Body() dto: LookupClientRequestDto,
  ): Promise<JessieIntegrationResponseDto<LookupClientResponseDto>> {
    return this.service.lookupClient(this.getContext(req), dto);
  }

  @Post('capture-lead')
  @HttpCode(200)
  @ApiOperation({ summary: 'Capture a new lead (idempotent)' })
  async captureLead(
    @Req() req: { jessieContext?: JessieContext },
    @Body() dto: CaptureLeadRequestDto,
  ): Promise<JessieIntegrationResponseDto<CaptureLeadResponseDto>> {
    return this.service.captureLead(this.getContext(req), dto);
  }

  @Post('create-or-request-appointment')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Create a confirmed appointment or queue an appointment request (idempotent)',
  })
  async createOrRequestAppointment(
    @Req() req: { jessieContext?: JessieContext },
    @Body() dto: CreateOrRequestAppointmentRequestDto,
  ): Promise<JessieIntegrationResponseDto<CreateOrRequestAppointmentResponseDto>> {
    return this.service.createOrRequestAppointment(this.getContext(req), dto);
  }

  @Post('transfer-call')
  @HttpCode(200)
  @ApiOperation({ summary: 'Initiate a call transfer (returns decision/target contract)' })
  async transferCall(
    @Req() req: { jessieContext?: JessieContext },
    @Body() dto: TransferCallRequestDto,
  ): Promise<JessieIntegrationResponseDto<TransferCallResponseDto>> {
    return this.service.transferCall(this.getContext(req), dto);
  }

  @Post('send-message-or-callback-request')
  @HttpCode(200)
  @ApiOperation({ summary: 'Queue a message or callback request (idempotent)' })
  async sendMessageOrCallbackRequest(
    @Req() req: { jessieContext?: JessieContext },
    @Body() dto: SendMessageOrCallbackRequestDto,
  ): Promise<JessieIntegrationResponseDto<SendMessageOrCallbackResponseDto>> {
    return this.service.sendMessageOrCallbackRequest(this.getContext(req), dto);
  }

  @Post('log-call-outcome')
  @HttpCode(200)
  @ApiOperation({ summary: 'Log a call outcome (idempotent)' })
  async logCallOutcome(
    @Req() req: { jessieContext?: JessieContext },
    @Body() dto: LogCallOutcomeRequestDto,
  ): Promise<JessieIntegrationResponseDto<LogCallOutcomeResponseDto>> {
    return this.service.logCallOutcome(this.getContext(req), dto);
  }

  @Get('business-information')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get approved business information (tenant-scoped)' })
  async getBusinessInformation(
    @Req() req: { jessieContext?: JessieContext },
  ): Promise<JessieIntegrationResponseDto<GetBusinessInformationResponseDto>> {
    return this.service.getBusinessInformation(this.getContext(req));
  }
}