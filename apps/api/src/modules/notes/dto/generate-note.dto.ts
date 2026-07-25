import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

  @ApiPropertyOptional({ type: [String], example: ['CBT', 'mindfulness'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interventions?: string[];
}
