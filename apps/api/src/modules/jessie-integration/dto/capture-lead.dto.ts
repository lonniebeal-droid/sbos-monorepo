import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MinLength, IsEmail, IsPhoneNumber } from 'class-validator';

export enum LeadUrgency {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  EMERGENCY = 'emergency',
}

export class CaptureLeadRequestDto {
  @ApiProperty({ example: 'client_abc123' })
  @IsString()
  @MinLength(1)
  clientId!: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MinLength(1)
  callerName!: string;

  @ApiProperty({ example: '+15551234567' })
  @IsPhoneNumber()
  callerPhone!: string;

  @ApiPropertyOptional({ example: 'john.doe@example.com' })
  @IsOptional()
  @IsEmail()
  callerEmail?: string;

  @ApiProperty({ example: 'Seeking therapy for anxiety' })
  @IsString()
  @MinLength(1)
  reasonForCall!: string;

  @ApiPropertyOptional({ example: 'individual_therapy' })
  @IsOptional()
  @IsString()
  serviceInterest?: string;

  @ApiPropertyOptional({ enum: LeadUrgency, default: LeadUrgency.NORMAL })
  @IsOptional()
  @IsEnum(LeadUrgency)
  urgency?: LeadUrgency;

  @ApiPropertyOptional({ example: '2026-09-01T10:00:00Z' })
  @IsOptional()
  @IsString()
  preferredCallbackTime?: string;

  @ApiPropertyOptional({ example: 'Caller mentioned insurance questions' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ example: 'conv_abc123' })
  @IsString()
  @MinLength(1)
  conversationId!: string;

  @ApiProperty({ example: 'req_xyz789' })
  @IsString()
  @MinLength(1)
  requestId!: string;
}

export class CaptureLeadResponseDto {
  @ApiProperty({ example: 'lead_abc123' })
  leadId!: string;

  @ApiProperty({ example: 'created' })
  status!: 'created' | 'duplicate';

  @ApiProperty({ example: '2026-08-29T10:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: 'req_xyz789' })
  requestId!: string;
}

export class CaptureLeadErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'VALIDATION_ERROR' })
  code!: string;

  @ApiProperty({ example: 'Invalid caller phone number format' })
  message!: string;

  @ApiProperty({ example: 'req_xyz789' })
  requestId!: string;
}