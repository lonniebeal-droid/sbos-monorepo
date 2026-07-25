import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CancelAppointmentDto {
  @ApiPropertyOptional({ example: 'Client requested reschedule' })
  @IsOptional()
  @IsString()
  reason?: string;
}
