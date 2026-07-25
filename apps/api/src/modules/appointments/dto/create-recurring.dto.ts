import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

import { CreateAppointmentDto } from './create-appointment.dto';

export enum RecurrenceFrequencyDto {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
  MONTHLY = 'MONTHLY',
}

export class CreateRecurringDto extends CreateAppointmentDto {
  @ApiProperty({ enum: RecurrenceFrequencyDto })
  @IsEnum(RecurrenceFrequencyDto)
  frequency!: RecurrenceFrequencyDto;

  @ApiProperty({ example: 8, minimum: 2, maximum: 52, description: 'Occurrences' })
  @IsInt()
  @Min(2)
  @Max(52)
  count!: number;
}
