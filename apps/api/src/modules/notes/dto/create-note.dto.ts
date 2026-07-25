import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export enum NoteTypeDto {
  INTAKE = 'INTAKE',
  PROGRESS = 'PROGRESS',
  BIRP = 'BIRP',
  DAP = 'DAP',
  SOAP = 'SOAP',
  GROUP = 'GROUP',
  PSYCHIATRIC = 'PSYCHIATRIC',
  DISCHARGE = 'DISCHARGE',
  CONTACT = 'CONTACT',
}

export class CreateNoteDto {
  @ApiProperty({ description: 'Client id' })
  @IsString()
  clientId!: string;

  @ApiProperty({ description: 'Authoring clinician id' })
  @IsString()
  clinicianId!: string;

  @ApiPropertyOptional({ description: 'Related appointment id' })
  @IsOptional()
  @IsString()
  appointmentId?: string;

  @ApiProperty({ enum: NoteTypeDto })
  @IsEnum(NoteTypeDto)
  type!: NoteTypeDto;

  @ApiPropertyOptional({ example: 'Session note' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: 'Free-text body for PROGRESS/GROUP/INTAKE notes',
  })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({
    description:
      'Structured sections keyed by field. BIRP: behavior/intervention/response/plan; DAP: data/assessment/plan; SOAP: subjective/objective/assessment/plan.',
    example: {
      behavior: 'Client reported reduced anxiety.',
      intervention: 'CBT thought-challenging.',
      response: 'Engaged well.',
      plan: 'Continue weekly sessions.',
    },
  })
  @IsOptional()
  @IsObject()
  sections?: Record<string, string>;

  @ApiPropertyOptional({
    default: false,
    description: 'Whether the note requires supervisor co-signature',
  })
  @IsOptional()
  @IsBoolean()
  requiresCosign?: boolean;

  @ApiPropertyOptional({ description: 'Assigned co-signer user id' })
  @IsOptional()
  @IsString()
  cosignerId?: string;
}
