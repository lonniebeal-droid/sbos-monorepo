import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum LocationTypeDto {
  OFFICE = 'OFFICE',
  TELEHEALTH = 'TELEHEALTH',
  COMMUNITY = 'COMMUNITY',
  RESIDENTIAL = 'RESIDENTIAL',
}

export class CreateLocationDto {
  @ApiProperty({ example: 'Main Office' })
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ enum: LocationTypeDto, default: LocationTypeDto.OFFICE })
  @IsOptional()
  @IsEnum(LocationTypeDto)
  type?: LocationTypeDto;

  @ApiPropertyOptional({ example: '123 Wellness Ave' })
  @IsOptional()
  @IsString()
  addressLine1?: string;

  @ApiPropertyOptional({ example: 'Suite 200' })
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @ApiPropertyOptional({ example: 'Atlanta' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'GA' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ example: '30301' })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional({ example: '(555) 018-2200' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
