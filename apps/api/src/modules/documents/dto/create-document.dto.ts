import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum DocumentTypeDto {
  INTAKE_FORM = 'INTAKE_FORM',
  CONSENT = 'CONSENT',
  ASSESSMENT = 'ASSESSMENT',
  INSURANCE_CARD = 'INSURANCE_CARD',
  IDENTIFICATION = 'IDENTIFICATION',
  CLINICAL = 'CLINICAL',
  BILLING = 'BILLING',
  CORRESPONDENCE = 'CORRESPONDENCE',
  OTHER = 'OTHER',
}

export class CreateDocumentDto {
  @ApiProperty({ example: 'intake-packet.pdf' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ enum: DocumentTypeDto, default: DocumentTypeDto.OTHER })
  @IsOptional()
  @IsEnum(DocumentTypeDto)
  type?: DocumentTypeDto;

  @ApiPropertyOptional({ description: 'Associated client id' })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({ example: 'application/pdf' })
  @IsOptional()
  @IsString()
  mimeType?: string;
}
