import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MinLength, IsBoolean } from 'class-validator';

export enum CallOutcomeResolution {
  RESOLVED = 'resolved',
  TRANSFERRED = 'transferred',
  CALLBACK_SCHEDULED = 'callback_scheduled',
  APPOINTMENT_REQUESTED = 'appointment_requested',
  VOICEMAIL_LEFT = 'voicemail_left',
  ABANDONED = 'abandoned',
  ESCALATED = 'escalated',
}

export enum CallOutcomeLeadQuality {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  UNKNOWN = 'unknown',
}

export enum CallOutcomeUrgency {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  EMERGENCY = 'emergency',
}

export class LogCallOutcomeRequestDto {
  @ApiProperty({ example: 'client_abc123' })
  @IsString()
  @MinLength(1)
  clientId!: string;

  @ApiProperty({ example: 'Acme Counseling Center' })
  @IsString()
  @MinLength(1)
  businessName!: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MinLength(1)
  callerName!: string;

  @ApiProperty({ example: '+15551234567' })
  @IsString()
  @MinLength(1)
  callerPhone!: string;

  @ApiPropertyOptional({ example: 'john.doe@example.com' })
  @IsOptional()
  @IsString()
  callerEmail?: string;

  @ApiProperty({ example: 'therapy_inquiry' })
  @IsString()
  @MinLength(1)
  intent!: string;

  @ApiPropertyOptional({ example: 'individual_therapy' })
  @IsOptional()
  @IsString()
  serviceInterest?: string;

  @ApiProperty({ enum: CallOutcomeLeadQuality, default: CallOutcomeLeadQuality.UNKNOWN })
  @IsEnum(CallOutcomeLeadQuality)
  leadQuality!: CallOutcomeLeadQuality;

  @ApiProperty({ enum: CallOutcomeUrgency, default: CallOutcomeUrgency.NORMAL })
  @IsEnum(CallOutcomeUrgency)
  urgency!: CallOutcomeUrgency;

  @ApiProperty({ example: false })
  @IsBoolean()
  appointmentRequested!: boolean;

  @ApiProperty({ example: false })
  @IsBoolean()
  appointmentCreated!: boolean;

  @ApiProperty({ example: false })
  @IsBoolean()
  transferRequested!: boolean;

  @ApiProperty({ example: false })
  @IsBoolean()
  transferCompleted!: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  callbackRequested!: boolean;

  @ApiPropertyOptional({ example: '["timeout_on_tts"]' })
  @IsOptional()
  @IsString({ each: true })
  toolErrors?: string[];

  @ApiProperty({ enum: CallOutcomeResolution })
  @IsEnum(CallOutcomeResolution)
  resolution!: CallOutcomeResolution;

  @ApiProperty({ example: true })
  @IsBoolean()
  followUpRequired!: boolean;

  @ApiProperty({ example: 'Caller requested callback for tomorrow morning regarding anxiety therapy' })
  @IsString()
  @MinLength(1)
  callSummary!: string;

  @ApiProperty({ example: 'conv_abc123' })
  @IsString()
  @MinLength(1)
  conversationId!: string;

  @ApiProperty({ example: 'req_xyz789' })
  @IsString()
  @MinLength(1)
  requestId!: string;
}

export class LogCallOutcomeResponseDto {
  @ApiProperty({ example: 'outcome_abc123' })
  outcomeId!: string;

  @ApiProperty({ example: 'logged' })
  status!: 'logged' | 'duplicate';

  @ApiProperty({ example: '2026-08-29T10:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: 'req_xyz789' })
  requestId!: string;
}

export class LogCallOutcomeErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'VALIDATION_ERROR' })
  code!: string;

  @ApiProperty({ example: 'Invalid resolution enum value' })
  message!: string;

  @ApiProperty({ example: 'req_xyz789' })
  requestId!: string;
}