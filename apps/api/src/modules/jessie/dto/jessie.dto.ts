import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export enum AssistantKindDto {
  RECEPTIONIST = 'RECEPTIONIST',
  SCHEDULING = 'SCHEDULING',
  INTAKE = 'INTAKE',
  CLINICAL = 'CLINICAL',
  KNOWLEDGE = 'KNOWLEDGE',
  GENERAL = 'GENERAL',
}

export class StartConversationDto {
  @ApiPropertyOptional({ enum: AssistantKindDto, default: AssistantKindDto.RECEPTIONIST })
  @IsOptional()
  @IsEnum(AssistantKindDto)
  kind?: AssistantKindDto;

  @ApiPropertyOptional({ example: 'New appointment request' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ description: 'Associated client id' })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({ description: 'Optional first user message' })
  @IsOptional()
  @IsString()
  message?: string;
}

export class SendMessageDto {
  @ApiProperty({ example: 'I would like to book an appointment next week.' })
  @IsString()
  @MinLength(1)
  message!: string;
}

export class CreatePromptTemplateDto {
  @ApiProperty({ enum: AssistantKindDto })
  @IsEnum(AssistantKindDto)
  kind!: AssistantKindDto;

  @ApiProperty({ example: 'Front desk greeting' })
  @IsString()
  name!: string;

  @ApiProperty({ description: 'System prompt text' })
  @IsString()
  @MinLength(10)
  systemPrompt!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePromptTemplateDto extends PartialType(
  CreatePromptTemplateDto,
) {}

export class CreateKnowledgeArticleDto {
  @ApiProperty({ example: 'Office hours' })
  @IsString()
  title!: string;

  @ApiProperty({ example: 'Our office is open Monday–Friday, 9am–6pm.' })
  @IsString()
  body!: string;

  @ApiPropertyOptional({ type: [String], example: ['hours', 'contact'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateKnowledgeArticleDto extends PartialType(
  CreateKnowledgeArticleDto,
) {}

// Re-export integration DTOs
export * from './jessie-integration.dto';
