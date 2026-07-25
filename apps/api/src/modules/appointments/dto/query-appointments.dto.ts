import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class QueryAppointmentsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by clinician id' })
  @IsOptional()
  @IsString()
  clinicianId?: string;

  @ApiPropertyOptional({ description: 'Filter by client id' })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({ description: 'Range start (ISO datetime)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'Range end (ISO datetime)' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
