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
