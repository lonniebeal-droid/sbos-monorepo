import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum DiagnosisTypeDto {
  PRIMARY = 'PRIMARY',
  SECONDARY = 'SECONDARY',
  PROVISIONAL = 'PROVISIONAL',
  RULE_OUT = 'RULE_OUT',
}

export enum DiagnosisStatusDto {
  ACTIVE = 'ACTIVE',
  RESOLVED = 'RESOLVED',
  RULED_OUT = 'RULED_OUT',
  PROVISIONAL = 'PROVISIONAL',
}

export class CreateDiagnosisDto {
  @ApiProperty({ description: 'Client id' })
  @IsString()
  clientId!: string;

  @ApiProperty({ example: 'F41.1' })
  @IsString()
  icd10Code!: string;

  @ApiProperty({ example: 'Generalized anxiety disorder' })
  @IsString()
  description!: string;

  @ApiPropertyOptional({ enum: DiagnosisTypeDto, default: DiagnosisTypeDto.PRIMARY })
  @IsOptional()
  @IsEnum(DiagnosisTypeDto)
  type?: DiagnosisTypeDto;

  @ApiPropertyOptional({ enum: DiagnosisStatusDto, default: DiagnosisStatusDto.ACTIVE })
  @IsOptional()
  @IsEnum(DiagnosisStatusDto)
  status?: DiagnosisStatusDto;
}
