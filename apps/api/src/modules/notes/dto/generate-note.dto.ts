import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export enum AssistNoteTypeDto {
  BIRP = 'BIRP',
  DAP = 'DAP',
  SOAP = 'SOAP',
  PROGRESS = 'PROGRESS',
  GROUP = 'GROUP',
}

export class GenerateNoteDto {
  @ApiProperty({ enum: AssistNoteTypeDto })
  @IsEnum(AssistNoteTypeDto)
  type!: AssistNoteTypeDto;

  @ApiProperty({
    example: 'Client discussed work stress and sleep difficulties this week.',
  })
  @IsString()
  @MinLength(3)
  prompt!: string;

  @ApiPropertyOptional({ description: 'Client id for context (name lookup)' })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({
    description: 'The primary concern or reason for the session',
    example: 'Anxiety related to work transition',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  presentingProblem?: string;

  @ApiPropertyOptional({ type: [String], example: ['CBT', 'mindfulness'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interventions?: string[];
}
