import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreatePayerDto {
  @ApiProperty({ example: 'Aetna' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: '60054' })
  @IsOptional()
  @IsString()
  payerId?: string;

  @ApiPropertyOptional({ example: 'PPO' })
  @IsOptional()
  @IsString()
  planType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  claimsAddress?: string;

  @ApiPropertyOptional({ description: 'Electronic (EDI) payer id' })
  @IsOptional()
  @IsString()
  electronicPayerId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePayerDto extends PartialType(CreatePayerDto) {}

export class CreateServiceCodeDto {
  @ApiProperty({ example: '90834', description: 'CPT/HCPCS code' })
  @IsString()
  code!: string;

  @ApiProperty({ example: 'Psychotherapy, 45 minutes' })
  @IsString()
  description!: string;

  @ApiProperty({ example: 150.0 })
  @IsNumber()
  @Min(0)
  defaultFee!: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  defaultUnits?: number;
}

export class UpdateServiceCodeDto extends PartialType(CreateServiceCodeDto) {}
