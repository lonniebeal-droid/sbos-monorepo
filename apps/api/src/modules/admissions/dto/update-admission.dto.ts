import { ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

import { CreateAdmissionDto } from './create-admission.dto';

export class UpdateAdmissionDto extends PartialType(
  OmitType(CreateAdmissionDto, ['clientId'] as const),
) {
  @ApiPropertyOptional({ description: 'Discharge timestamp (ISO)' })
  @IsOptional()
  @IsDateString()
  dischargedAt?: string;

  @ApiPropertyOptional({ description: 'Reason for discharge' })
  @IsOptional()
  @IsString()
  dischargeReason?: string;
}
