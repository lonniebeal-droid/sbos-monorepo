import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export enum AppointmentTypeDto {
  INTAKE = 'INTAKE',
  INDIVIDUAL = 'INDIVIDUAL',
  GROUP = 'GROUP',
  FAMILY = 'FAMILY',
  COUPLES = 'COUPLES',
  MEDICATION_MANAGEMENT = 'MEDICATION_MANAGEMENT',
  ASSESSMENT = 'ASSESSMENT',
  TELEHEALTH = 'TELEHEALTH',
  CONSULTATION = 'CONSULTATION',
}

export class CreateAppointmentDto {
  @ApiProperty({ description: 'Client id' })
  @IsString()
  clientId!: string;

  @ApiProperty({ description: 'Clinician id' })
  @IsString()
  clinicianId!: string;

  @ApiPropertyOptional({ description: 'Location id' })
  @IsOptional()
  @IsString()
  locationId?: string;

  @ApiPropertyOptional({ enum: AppointmentTypeDto, default: AppointmentTypeDto.INDIVIDUAL })
  @IsOptional()
  @IsEnum(AppointmentTypeDto)
  type?: AppointmentTypeDto;

  @ApiProperty({ example: '2026-07-24T13:00:00.000Z' })
  @IsDateString()
  startTime!: string;

  @ApiProperty({ example: '2026-07-24T13:50:00.000Z' })
  @IsDateString()
  endTime!: string;

  @ApiProperty({ example: 50 })
  @IsInt()
  @Min(1)
  durationMinutes!: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isTelehealth?: boolean;

  @ApiPropertyOptional({ example: '90834' })
  @IsOptional()
  @IsString()
  cptCode?: string;
}
