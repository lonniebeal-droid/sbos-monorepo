import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export enum TaskStatusDto {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  BLOCKED = 'BLOCKED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum TaskPriorityDto {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export class CreateTaskDto {
  @ApiProperty({ example: 'Co-sign progress note' })
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Assignee user id' })
  @IsOptional()
  @IsString()
  assigneeId?: string;

  @ApiPropertyOptional({ description: 'Related client id' })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({ enum: TaskPriorityDto, default: TaskPriorityDto.MEDIUM })
  @IsOptional()
  @IsEnum(TaskPriorityDto)
  priority?: TaskPriorityDto;

  @ApiPropertyOptional({ example: '2026-08-01' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class UpdateTaskDto extends PartialType(CreateTaskDto) {
  @ApiPropertyOptional({ enum: TaskStatusDto })
  @IsOptional()
  @IsEnum(TaskStatusDto)
  status?: TaskStatusDto;
}

export class TaskQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: TaskStatusDto })
  @IsOptional()
  @IsEnum(TaskStatusDto)
  status?: TaskStatusDto;

  @ApiPropertyOptional({ description: 'Filter by assignee user id' })
  @IsOptional()
  @IsString()
  assigneeId?: string;
}
