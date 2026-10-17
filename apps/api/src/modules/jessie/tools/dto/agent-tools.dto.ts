import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Shared optional fields for all agent tools.
 * conversationId / sessionId must belong to the org resolved from the agent secret.
 */
export class AgentToolBaseDto {
  @ApiPropertyOptional({
    description: 'Idempotency key so retries do not duplicate side effects',
    example: 'el-call-abc-tool-1',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  idempotencyKey?: string;

  @ApiPropertyOptional({
    description:
      'Jessie conversation id for this agent session. Must belong to the agent organization.',
    example: 'clx_conversation_abc',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  conversationId?: string;

  @ApiPropertyOptional({
    description:
      'Alias for conversationId (ElevenLabs session correlation). Same ownership rules.',
    example: 'clx_conversation_abc',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  sessionId?: string;
}

export class LookupClientDto extends AgentToolBaseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Partial first or last name match' })
  @IsOptional()
  @IsString()
  name?: string;
}

export class SaveOrUpdateLeadDto extends AgentToolBaseDto {
  @ApiPropertyOptional({
    description: 'When set, updates an existing same-org client',
  })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiProperty({ example: 'Jordan' })
  @IsString()
  @MinLength(1)
  firstName!: string;

  @ApiProperty({ example: 'Lee' })
  @IsString()
  @MinLength(1)
  lastName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: '1990-05-15' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class CheckCalendarDto extends AgentToolBaseDto {
  @ApiProperty()
  @IsString()
  clinicianId!: string;

  @ApiProperty({ example: '2026-09-01' })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsInt()
  @Min(5)
  slotMinutes?: number;
}

export class ScheduleAppointmentDto extends AgentToolBaseDto {
  @ApiProperty()
  @IsString()
  clientId!: string;

  @ApiProperty()
  @IsString()
  clinicianId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locationId?: string;

  @ApiProperty({ example: '2026-09-01T14:00:00.000Z' })
  @IsDateString()
  startTime!: string;

  @ApiProperty({ example: '2026-09-01T14:50:00.000Z' })
  @IsDateString()
  endTime!: string;

  @ApiProperty({ example: 50 })
  @IsInt()
  @Min(1)
  durationMinutes!: number;

  @ApiPropertyOptional({ example: 'INDIVIDUAL' })
  @IsOptional()
  @IsString()
  type?: string;
}

export class SendSmsDto extends AgentToolBaseDto {
  @ApiProperty({ example: '+15552001010' })
  @IsString()
  @MinLength(7)
  to!: string;

  @ApiProperty({
    example: 'Your appointment is confirmed for Tuesday at 2pm.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(1600)
  body!: string;

  @ApiPropertyOptional({ description: 'Optional client id for audit context' })
  @IsOptional()
  @IsString()
  clientId?: string;
}

export class SendEmailDto extends AgentToolBaseDto {
  @ApiProperty({ example: 'jordan@example.com' })
  @IsEmail()
  to!: string;

  @ApiProperty({ example: 'Appointment confirmation' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  subject!: string;

  @ApiProperty({
    example: 'Your appointment is confirmed for Tuesday at 2pm.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  body!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientId?: string;
}

export class TransferToHumanDto extends AgentToolBaseDto {
  @ApiProperty({
    example: 'Caller requested to speak with the front desk.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  reason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({ description: 'Staff user id to assign the task to' })
  @IsOptional()
  @IsString()
  assigneeId?: string;
}

/** Optional body for get_business_information (org resolved from agent secret). */
export class GetBusinessInformationDto extends AgentToolBaseDto {}

/** Concise structured tool result for voice agents. */
export interface AgentToolResult {
  ok: boolean;
  tool: string;
  /** True when this response was replayed from a prior idempotent execution. */
  idempotentReplay?: boolean;
  /** Machine-readable error code when ok is false. */
  error?: string;
  message?: string;
  data?: Record<string, unknown>;
}
