import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateAvailabilityDto {
  @ApiProperty({ description: 'Clinician id' })
  @IsString()
  clinicianId!: string;

  @ApiPropertyOptional({ description: 'Location id' })
  @IsOptional()
  @IsString()
  locationId?: string;

  @ApiProperty({ example: 1, description: '0=Sunday .. 6=Saturday' })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @ApiProperty({ example: '09:00' })
  @Matches(HHMM, { message: 'startTime must be HH:mm' })
  startTime!: string;

  @ApiProperty({ example: '17:00' })
  @Matches(HHMM, { message: 'endTime must be HH:mm' })
  endTime!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateTimeOffDto {
  @ApiProperty({ description: 'Clinician id' })
  @IsString()
  clinicianId!: string;

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  @IsString()
  startsAt!: string;

  @ApiProperty({ example: '2026-08-05T00:00:00.000Z' })
  @IsString()
  endsAt!: string;

  @ApiPropertyOptional({ example: 'PTO' })
  @IsOptional()
  @IsString()
  reason?: string;
}
