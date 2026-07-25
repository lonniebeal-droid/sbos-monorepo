import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsString,
  MinLength,
} from 'class-validator';

import { Role } from '../../../common/enums/role.enum';

export class CreateUserDto {
  @ApiProperty({ example: 'newuser@sbos.health' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Jordan Practitioner' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ example: 'S3cure!Pass', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ enum: Role, example: Role.CLINICIAN })
  @IsEnum(Role)
  role!: Role;

  @ApiProperty({ example: 'org_success_brand' })
  @IsString()
  organizationId!: string;
}
