import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpsertFeatureFlagDto {
  @ApiProperty({ example: 'telehealth.enabled' })
  @IsString()
  @MinLength(2)
  key!: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  isEnabled!: boolean;

  @ApiPropertyOptional({ example: 'Enable telehealth video sessions' })
  @IsOptional()
  @IsString()
  description?: string;
}
