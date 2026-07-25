import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export enum ClaimStatusDto {
  DRAFT = 'DRAFT',
  READY = 'READY',
  SUBMITTED = 'SUBMITTED',
  ACCEPTED = 'ACCEPTED',
  DENIED = 'DENIED',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  APPEALED = 'APPEALED',
  VOID = 'VOID',
}

export class CreateClaimDto {
  @ApiProperty({ description: 'Client id' })
  @IsString()
  clientId!: string;

  @ApiPropertyOptional({ description: 'Insurance policy id' })
  @IsOptional()
  @IsString()
  insurancePolicyId?: string;

  @ApiPropertyOptional({ description: 'Related appointment id' })
  @IsOptional()
  @IsString()
  appointmentId?: string;

  @ApiPropertyOptional({ example: '90834' })
  @IsOptional()
  @IsString()
  cptCode?: string;

  @ApiPropertyOptional({ type: [String], example: ['F41.1'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  icd10Codes?: string[];

  @ApiProperty({ example: 150.0 })
  @IsNumber()
  @Min(0)
  billedAmount!: number;

  @ApiProperty({ example: '2026-07-24' })
  @IsDateString()
  serviceDate!: string;
}

export class UpdateClaimStatusDto {
  @ApiProperty({ enum: ClaimStatusDto })
  @IsEnum(ClaimStatusDto)
  status!: ClaimStatusDto;

  @ApiPropertyOptional({ example: 'CO-97 duplicate claim' })
  @IsOptional()
  @IsString()
  denialReason?: string;

  @ApiPropertyOptional({ example: 120.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  paidAmount?: number;
}
