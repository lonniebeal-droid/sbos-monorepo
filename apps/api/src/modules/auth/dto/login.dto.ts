import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'clinician@sbos.health' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Sbos!2026' })
  @IsString()
  @MinLength(1)
  password!: string;
}
