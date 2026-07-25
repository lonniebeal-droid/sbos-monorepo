import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class RefreshDto {
  @ApiProperty({ description: 'A valid refresh token' })
  @IsString()
  refreshToken!: string;
}
