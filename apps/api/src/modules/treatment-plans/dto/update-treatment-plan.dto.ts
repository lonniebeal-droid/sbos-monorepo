import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export enum TreatmentPlanStatusDto {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  UNDER_REVIEW = 'UNDER_REVIEW',
  COMPLETED = 'COMPLETED',
  DISCONTINUED = 'DISCONTINUED',
}

export enum GoalStatusDto {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  ACHIEVED = 'ACHIEVED',
  DISCONTINUED = 'DISCONTINUED',
}

export class UpdateTreatmentPlanDto {
  @ApiPropertyOptional({ example: 'Anxiety management plan (rev. 2)' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  presentingProblem?: string;

  @ApiPropertyOptional({ enum: TreatmentPlanStatusDto })
  @IsOptional()
  @IsEnum(TreatmentPlanStatusDto)
  status?: TreatmentPlanStatusDto;
}

export class UpdateGoalDto {
  @ApiPropertyOptional({ enum: GoalStatusDto })
  @IsOptional()
  @IsEnum(GoalStatusDto)
  status?: GoalStatusDto;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progressPercent?: number;
}
