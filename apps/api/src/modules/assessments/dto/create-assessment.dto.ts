import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateAssessmentDto {
  @ApiProperty({ description: 'Client id' })
  @IsString()
  clientId!: string;

  @ApiProperty({
    description: 'Assessment instrument',
    example: 'PHQ-9',
    enum: ['PHQ-9', 'GAD-7', 'C-SSRS', 'AUDIT', 'DAST-10', 'OTHER'],
  })
  @IsString()
  instrument!: string;

  @ApiPropertyOptional({ description: 'Total score' })
  @IsOptional()
  @IsInt()
  score?: number;

  @ApiPropertyOptional({ description: 'Severity level', example: 'Moderate' })
  @IsOptional()
  @IsString()
  severity?: string;

  @ApiPropertyOptional({
    description: 'Individual question responses as JSON',
    example: { q1: 2, q2: 1, q3: 3 },
  })
  @IsOptional()
  responses?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'When the assessment was administered' })
  @IsOptional()
  @IsString()
  administeredAt?: string;
}
