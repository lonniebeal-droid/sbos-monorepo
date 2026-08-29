import { ApiProperty } from '@nestjs/swagger';

import { Role } from '../../../common/enums/role.enum';

/** Public representation of a user (never includes the password hash). */
export class UserEntity {
  @ApiProperty({ example: 'usr_a1b2c3' })
  id!: string;

  @ApiProperty({ example: 'clinician@sbos.health' })
  email!: string;

  @ApiProperty({ example: 'Riley' })
  firstName!: string;

  @ApiProperty({ example: 'Chen' })
  lastName!: string;

  @ApiProperty({ example: 'Dr. Riley Chen' })
  name!: string;

  @ApiProperty({ enum: Role, example: Role.CLINICIAN })
  role!: Role;

  @ApiProperty({ example: 'org_success_brand' })
  organizationId!: string;

  @ApiProperty({ example: 1, description: 'Credential generation for JWT invalidation' })
  passwordVersion!: number;

  @ApiProperty({ example: '2026-07-24T12:00:00.000Z' })
  createdAt!: string;
}
