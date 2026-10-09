import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum CallOutcomeEnum {
  COMPLETED = 'COMPLETED',
  NO_ANSWER = 'NO_ANSWER',
  BUSY = 'BUSY',
  FAILED = 'FAILED',
  VOICEMAIL = 'VOICEMAIL',
  CALLBACK_REQUESTED = 'CALLBACK_REQUESTED',
  TRANSFERRED = 'TRANSFERRED',
}

export enum TransferTargetEnum {
  HUMAN_AGENT = 'HUMAN_AGENT',
  VOICEMAIL = 'VOICEMAIL',
  SCHEDULING_QUEUE = 'SCHEDULING_QUEUE',
  CRISIS_LINE = 'CRISIS_LINE',
}

export class LookupClientRequestDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  clientId!: string;

  @ApiPropertyOptional({ example: 'mrn-12345' })
  @IsOptional()
  @IsString()
  mrn?: string;

  @ApiPropertyOptional({ example: '+15551234567' })
  @IsOptional()
  @IsString()
  phone?: string;
}

export class LookupClientResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  clientId!: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  firstName!: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  lastName!: string;

  @ApiPropertyOptional({ example: 'Jon' })
  @IsOptional()
  @IsString()
  preferredName?: string;

  @ApiPropertyOptional({ example: 'mrn-12345' })
  @IsOptional()
  @IsString()
  mrn?: string;

  @ApiPropertyOptional({ example: '+15551234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'john.doe@example.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: 'INTAKE' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsOptional()
  @IsUUID()
  primaryClinicianId?: string;
}

export class CaptureLeadRequestDto {
  @ApiProperty({ example: 'Jane' })
  @IsString()
  @MinLength(1)
  firstName!: string;

  @ApiProperty({ example: 'Smith' })
  @IsString()
  @MinLength(1)
  lastName!: string;

  @ApiPropertyOptional({ example: '+15559876543' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'jane.smith@example.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: 'Interested in anxiety therapy' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ example: 'WEB_FORM' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiProperty({ example: 'req-550e8400-e29b-41d4-a716-446655440000' })
  @IsString()
  @MinLength(1)
  idempotencyKey!: string;
}

export class CaptureLeadResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  leadId!: string;

  @ApiProperty({ example: 'CREATED' })
  @IsEnum(['CREATED', 'EXISTS'])
  status!: 'CREATED' | 'EXISTS';
}

export class CreateOrRequestAppointmentRequestDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  clientId!: string;

  @ApiProperty({ example: 'INDIVIDUAL' })
  @IsEnum([
    'INTAKE',
    'INDIVIDUAL',
    'GROUP',
    'FAMILY',
    'COUPLES',
    'MEDICATION_MANAGEMENT',
    'ASSESSMENT',
    'TELEHEALTH',
    'CONSULTATION',
  ])
  type!: string;

  @ApiProperty({ example: '2026-09-15T10:00:00.000Z' })
  @IsDateString()
  preferredStartTime!: string;

  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @IsString()
  durationMinutes?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsOptional()
  @IsUUID()
  preferredClinicianId?: string;

  @ApiPropertyOptional({ example: 'ANXIETY_INTAKE' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({ example: 'req-550e8400-e29b-41d4-a716-446655440000' })
  @IsString()
  @MinLength(1)
  idempotencyKey!: string;
}

export class CreateOrRequestAppointmentResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  appointmentId!: string;

  @ApiProperty({ example: 'CONFIRMED' })
  @IsEnum(['CONFIRMED', 'REQUESTED'])
  status!: 'CONFIRMED' | 'REQUESTED';

  @ApiPropertyOptional({ example: '2026-09-15T10:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  confirmedStartTime?: string;

  @ApiPropertyOptional({ example: 'No clinician available at requested time; request queued.' })
  @IsOptional()
  @IsString()
  message?: string;
}

export class TransferCallRequestDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  conversationId!: string;

  @ApiProperty({ example: 'HUMAN_AGENT' })
  @IsEnum(TransferTargetEnum)
  target!: TransferTargetEnum;

  @ApiPropertyOptional({ example: 'Client requested human operator' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsOptional()
  @IsUUID()
  targetAgentId?: string;
}

export class TransferCallResponseDto {
  @ApiProperty({ example: 'TRANSFER_INITIATED' })
  @IsEnum(['TRANSFER_INITIATED', 'TRANSFER_QUEUED', 'TRANSFER_UNAVAILABLE'])
  status!: 'TRANSFER_INITIATED' | 'TRANSFER_QUEUED' | 'TRANSFER_UNAVAILABLE';

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440002' })
  @IsOptional()
  @IsUUID()
  transferId?: string;

  @ApiPropertyOptional({ example: 'Human agent will join within 2 minutes' })
  @IsOptional()
  @IsString()
  message?: string;
}

export class SendMessageOrCallbackRequestDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  clientId!: string;

  @ApiProperty({ example: 'CALLBACK_REQUEST' })
  @IsEnum(['SMS', 'EMAIL', 'CALLBACK_REQUEST', 'INTERNAL_NOTE'])
  type!: 'SMS' | 'EMAIL' | 'CALLBACK_REQUEST' | 'INTERNAL_NOTE';

  @ApiPropertyOptional({ example: 'Please call me back at 2pm' })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ example: '+15551234567' })
  @IsOptional()
  @IsString()
  contactValue?: string;

  @ApiPropertyOptional({ example: '2026-09-15T14:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  preferredCallbackTime?: string;

  @ApiProperty({ example: 'req-550e8400-e29b-41d4-a716-446655440000' })
  @IsString()
  @MinLength(1)
  idempotencyKey!: string;
}

export class SendMessageOrCallbackResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  requestId!: string;

  @ApiProperty({ example: 'QUEUED' })
  @IsEnum(['QUEUED', 'SENT', 'EXISTS'])
  status!: 'QUEUED' | 'SENT' | 'EXISTS';
}

export class LogCallOutcomeRequestDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  conversationId!: string;

  @ApiProperty({ example: 'COMPLETED' })
  @IsEnum(CallOutcomeEnum)
  outcome!: CallOutcomeEnum;

  @ApiPropertyOptional({ example: 420 })
  @IsOptional()
  @IsString()
  durationSeconds?: string;

  @ApiPropertyOptional({ example: 'Client scheduled follow-up appointment' })
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiPropertyOptional({ example: 'rec-550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsString()
  recordingId?: string;

  @ApiProperty({ example: 'req-550e8400-e29b-41d4-a716-446655440000' })
  @IsString()
  @MinLength(1)
  idempotencyKey!: string;
}

export class LogCallOutcomeResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  logId!: string;

  @ApiProperty({ example: 'LOGGED' })
  @IsEnum(['LOGGED', 'EXISTS'])
  status!: 'LOGGED' | 'EXISTS';
}

export class GetBusinessInformationResponseDto {
  @ApiProperty({ example: 'Success Behavioral Health' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: '+15551234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'info@sbhealth.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: '123 Main St, Suite 100, City, ST 12345' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'Mon-Fri 9am-6pm, Sat 10am-2pm' })
  @IsOptional()
  @IsString()
  hours?: string;

  @ApiPropertyOptional({ example: 'https://sbhealth.com' })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional({ type: [String], example: ['Anxiety Therapy', 'Depression Treatment', 'Couples Counseling'] })
  @IsOptional()
  @IsString({ each: true })
  services?: string[];

  @ApiPropertyOptional({ example: 'America/New_York' })
  @IsOptional()
  @IsString()
  timezone?: string;
}

export class MakeEventDto {
  @ApiProperty({ example: 'evt-550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  event_id!: string;

  @ApiProperty({ example: 'req-550e8400-e29b-41d4-a716-446655440000' })
  @IsString()
  request_id!: string;

  @ApiProperty({ example: 'conv-550e8400-e29b-41d4-a716-446655440000' })
  @IsString()
  conversation_id!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  client_id!: string;

  @ApiProperty({ example: 'org-550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  organization_id!: string;

  @ApiProperty({ example: 'capture_lead' })
  @IsEnum([
    'lookup_client',
    'capture_lead',
    'create_or_request_appointment',
    'transfer_call',
    'send_message_or_callback_request',
    'log_call_outcome',
    'get_business_information',
  ])
  event_type!: string;

  @ApiProperty({ example: '2026-09-15T10:30:00.000Z' })
  @IsDateString()
  timestamp!: string;

  @ApiPropertyOptional()
  @IsOptional()
  payload?: Record<string, unknown>;
}

export class JessieIntegrationResponseDto<T> {
  @ApiProperty({ example: true })
  @IsBoolean()
  success!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  data?: T;

  @ApiPropertyOptional({ example: 'Client not found' })
  @IsOptional()
  @IsString()
  error?: string;

  @ApiProperty({ example: 'req-550e8400-e29b-41d4-a716-446655440000' })
  @IsString()
  requestId!: string;
}