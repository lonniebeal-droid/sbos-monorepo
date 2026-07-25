import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export enum MessageThreadTypeDto {
  DIRECT = 'DIRECT',
  GROUP = 'GROUP',
  CLIENT_PORTAL = 'CLIENT_PORTAL',
  CARE_TEAM = 'CARE_TEAM',
}

export class CreateThreadDto {
  @ApiPropertyOptional({ enum: MessageThreadTypeDto, default: MessageThreadTypeDto.DIRECT })
  @IsOptional()
  @IsEnum(MessageThreadTypeDto)
  type?: MessageThreadTypeDto;

  @ApiPropertyOptional({ example: 'Care coordination — Jordan M.' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiProperty({ type: [String], description: 'Participant user ids (besides creator)' })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  participantIds!: string[];
}

export class PostMessageDto {
  @ApiProperty({ example: 'Following up on the intake paperwork.' })
  @IsString()
  @MinLength(1)
  body!: string;
}
