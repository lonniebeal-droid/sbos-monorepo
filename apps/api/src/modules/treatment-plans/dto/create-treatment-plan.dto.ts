import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class CreateObjectiveDto {
  @ApiProperty({ example: 'Practice diaphragmatic breathing daily.' })
  @IsString()
  description!: string;
}

export class CreateGoalDto {
  @ApiProperty({ example: 'Reduce frequency of panic episodes.' })
  @IsString()
  description!: string;

  @ApiPropertyOptional({ type: [CreateObjectiveDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateObjectiveDto)
  objectives?: CreateObjectiveDto[];
}

export class CreateTreatmentPlanDto {
  @ApiProperty({ description: 'Client id' })
  @IsString()
  clientId!: string;

  @ApiProperty({ description: 'Clinician id' })
  @IsString()
  clinicianId!: string;

  @ApiProperty({ example: 'Anxiety management plan' })
  @IsString()
  title!: string;

  @ApiPropertyOptional({ example: 'Persistent worry impacting daily function.' })
  @IsOptional()
  @IsString()
  presentingProblem?: string;

  @ApiPropertyOptional({ type: [CreateGoalDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGoalDto)
  goals?: CreateGoalDto[];
}
