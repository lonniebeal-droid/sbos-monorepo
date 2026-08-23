import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsString } from 'class-validator';

import { Role } from '../../../common/enums/role.enum';

export class InviteUserDto {
  @ApiProperty({ example: 'newclinician@sbos.health' })
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: Role, example: Role.CLINICIAN })
  @IsEnum(Role)
  role!: Role;
}
