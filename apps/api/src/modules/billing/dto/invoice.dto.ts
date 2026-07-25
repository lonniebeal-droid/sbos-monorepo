import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class InvoiceLineItemDto {
  @ApiProperty({ example: 'Psychotherapy, 45 minutes' })
  @IsString()
  description!: string;

  @ApiPropertyOptional({ example: '90834' })
  @IsOptional()
  @IsString()
  cptCode?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiProperty({ example: 150.0 })
  @IsNumber()
  @Min(0)
  unitPrice!: number;
}

export class CreateInvoiceDto {
  @ApiProperty({ description: 'Client id' })
  @IsString()
  clientId!: string;

  @ApiProperty({ type: [InvoiceLineItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineItemDto)
  lineItems!: InvoiceLineItemDto[];

  @ApiPropertyOptional({ example: '2026-08-15' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ default: 0, description: 'Tax amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tax?: number;
}

export enum PaymentMethodDto {
  CARD = 'CARD',
  CASH = 'CASH',
  CHECK = 'CHECK',
  ACH = 'ACH',
  INSURANCE = 'INSURANCE',
  HSA_FSA = 'HSA_FSA',
  ADJUSTMENT = 'ADJUSTMENT',
}

export class RecordPaymentDto {
  @ApiProperty({ description: 'Client id' })
  @IsString()
  clientId!: string;

  @ApiPropertyOptional({ description: 'Invoice id to apply the payment to' })
  @IsOptional()
  @IsString()
  invoiceId?: string;

  @ApiPropertyOptional({ description: 'Claim id to apply the payment to' })
  @IsOptional()
  @IsString()
  claimId?: string;

  @ApiProperty({ enum: PaymentMethodDto, default: PaymentMethodDto.CARD })
  @IsEnum(PaymentMethodDto)
  method!: PaymentMethodDto;

  @ApiProperty({ example: 25.0 })
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiPropertyOptional({ description: 'External reference / receipt id' })
  @IsOptional()
  @IsString()
  reference?: string;
}
