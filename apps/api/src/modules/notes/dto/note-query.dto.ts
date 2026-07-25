import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { NoteTypeDto } from './create-note.dto';

export enum NoteStatusDto {
  DRAFT = 'DRAFT',
  PENDING_COSIGN = 'PENDING_COSIGN',
  SIGNED = 'SIGNED',
  AMENDED = 'AMENDED',
  LOCKED = 'LOCKED',
}

export class NoteQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by client id' })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({ description: 'Filter by clinician id' })
  @IsOptional()
  @IsString()
  clinicianId?: string;

  @ApiPropertyOptional({ enum: NoteTypeDto })
  @IsOptional()
  @IsEnum(NoteTypeDto)
  type?: NoteTypeDto;

  @ApiPropertyOptional({ enum: NoteStatusDto })
  @IsOptional()
  @IsEnum(NoteStatusDto)
  status?: NoteStatusDto;
}
