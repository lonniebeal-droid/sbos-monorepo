import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

import { AppointmentTypeDto } from '../../appointments/dto/create-appointment.dto';

export enum WaitlistStatusDto {
  WAITING = 'WAITING',
  OFFERED = 'OFFERED',
  SCHEDULED = 'SCHEDULED',
  CANCELLED = 'CANCELLED',
}

export class CreateWaitlistDto {
  @ApiProperty({ description: 'Client id' })
  @IsString()
  clientId!: string;

  @ApiPropertyOptional({ description: 'Preferred clinician id' })
  @IsOptional()
  @IsString()
  clinicianId?: string;

  @ApiPropertyOptional({ enum: AppointmentTypeDto, default: AppointmentTypeDto.INDIVIDUAL })
  @IsOptional()
  @IsEnum(AppointmentTypeDto)
  appointmentType?: AppointmentTypeDto;

  @ApiPropertyOptional({ default: 0, description: 'Higher = more urgent' })
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  preferredNotes?: string;
}

export class UpdateWaitlistDto {
  @ApiProperty({ enum: WaitlistStatusDto })
  @IsEnum(WaitlistStatusDto)
  status!: WaitlistStatusDto;
}
