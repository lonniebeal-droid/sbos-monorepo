import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export enum GenderDto {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  NON_BINARY = 'NON_BINARY',
  TRANSGENDER = 'TRANSGENDER',
  OTHER = 'OTHER',
  UNKNOWN = 'UNKNOWN',
  DECLINED = 'DECLINED',
}

export enum ClientStatusDto {
  PROSPECT = 'PROSPECT',
  INTAKE = 'INTAKE',
  ACTIVE = 'ACTIVE',
  ON_HOLD = 'ON_HOLD',
  DISCHARGED = 'DISCHARGED',
  INACTIVE = 'INACTIVE',
}

export class CreateClientDto {
  @ApiProperty({ example: 'SB-10247' })
  @IsString()
  @MaxLength(50)
  mrn!: string;

  @ApiProperty({ example: 'Jordan' })
  @IsString()
  firstName!: string;

  @ApiProperty({ example: 'Mitchell' })
  @IsString()
  lastName!: string;

  @ApiPropertyOptional({ example: 'JJ' })
  @IsOptional()
  @IsString()
  preferredName?: string;

  @ApiProperty({ example: '1990-05-15', description: 'ISO date' })
  @IsDateString()
  dateOfBirth!: string;

  @ApiPropertyOptional({ enum: GenderDto, default: GenderDto.UNKNOWN })
  @IsOptional()
  @IsEnum(GenderDto)
  gender?: GenderDto;

  @ApiPropertyOptional({ example: 'they/them' })
  @IsOptional()
  @IsString()
  pronouns?: string;

  @ApiPropertyOptional({ example: 'jordan@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '(555) 200-1010' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ enum: ClientStatusDto, default: ClientStatusDto.INTAKE })
  @IsOptional()
  @IsEnum(ClientStatusDto)
  status?: ClientStatusDto;

  @ApiPropertyOptional({ description: 'Primary clinician id' })
  @IsOptional()
  @IsString()
  primaryClinicianId?: string;
}
