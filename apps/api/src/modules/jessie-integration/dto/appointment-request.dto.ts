import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MinLength, IsPhoneNumber } from 'class-validator';

export enum AppointmentRequestStatus {
  REQUESTED = 'requested',
  BOOKED = 'booked',
  UNAVAILABLE = 'unavailable',
  UNSUPPORTED = 'unsupported',
  FAILED = 'failed',
}

export class CreateAppointmentRequestDto {
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

  @ApiProperty({ example: 'individual_therapy' })
  @IsString()
  @MinLength(1)
  service!: string;

  @ApiProperty({ example: '2026-09-01' })
  @IsString()
  @MinLength(1)
  requestedDate!: string;

  @ApiProperty({ example: '10:00' })
  @IsString()
  @MinLength(1)
  requestedTime!: string;

  @ApiProperty({ example: 'America/Chicago' })
  @IsString()
  @MinLength(1)
  timezone!: string;

  @ApiPropertyOptional({ example: 'Prefers morning appointments' })
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

export class AppointmentRequestResponseDto {
  @ApiProperty({ example: 'appt_req_abc123' })
  appointmentRequestId!: string;

  @ApiProperty({ enum: AppointmentRequestStatus })
  status!: AppointmentRequestStatus;

  @ApiPropertyOptional({ example: 'appt_abc123' })
  appointmentId?: string;

  @ApiProperty({ example: '2026-08-29T10:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: 'req_xyz789' })
  requestId!: string;
}

export class AppointmentRequestErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'VALIDATION_ERROR' })
  code!: string;

  @ApiProperty({ example: 'Invalid requested date format' })
  message!: string;

  @ApiProperty({ example: 'req_xyz789' })
  requestId!: string;
}