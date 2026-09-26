import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { AdmissionStatus } from '@sbos/database';

export class CreateAdmissionDto {
  @ApiProperty({ description: 'Client id' })
  @IsString()
  clientId!: string;

  @ApiProperty({
    description: 'Program name',
    example: 'Outpatient Behavioral Health',
  })
  @IsString()
  program!: string;

  @ApiPropertyOptional({
    description: 'Level of care',
    example: 'PHP',
  })
  @IsOptional()
  @IsString()
  levelOfCare?: string;

  @ApiPropertyOptional({
    description: 'Admission status',
    enum: AdmissionStatus,
    default: AdmissionStatus.ADMITTED,
  })
  @IsOptional()
  @IsEnum(AdmissionStatus)
  status?: AdmissionStatus;

  @ApiPropertyOptional({ description: 'Admission timestamp (ISO)' })
  @IsOptional()
  @IsDateString()
  admittedAt?: string;
}
