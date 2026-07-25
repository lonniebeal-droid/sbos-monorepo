import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

export enum MedicationStatusDto {
  ACTIVE = 'ACTIVE',
  DISCONTINUED = 'DISCONTINUED',
  COMPLETED = 'COMPLETED',
  ON_HOLD = 'ON_HOLD',
}

export class CreateMedicationDto {
  @ApiProperty({ description: 'Client id' })
  @IsString()
  clientId!: string;

  @ApiPropertyOptional({ description: 'Prescribing clinician id' })
  @IsOptional()
  @IsString()
  prescriberId?: string;

  @ApiProperty({ example: 'Sertraline' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: '50 mg' })
  @IsOptional()
  @IsString()
  dosage?: string;

  @ApiPropertyOptional({ example: 'Once daily' })
  @IsOptional()
  @IsString()
  frequency?: string;

  @ApiPropertyOptional({ example: 'Oral' })
  @IsOptional()
  @IsString()
  route?: string;

  @ApiPropertyOptional({ enum: MedicationStatusDto, default: MedicationStatusDto.ACTIVE })
  @IsOptional()
  @IsEnum(MedicationStatusDto)
  status?: MedicationStatusDto;

  @ApiPropertyOptional({ example: '2026-07-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
