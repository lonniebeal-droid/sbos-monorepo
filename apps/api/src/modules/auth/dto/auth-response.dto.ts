import { ApiProperty } from '@nestjs/swagger';

import { UserEntity } from '../../users/entities/user.entity';

export class AuthTokensDto {
  @ApiProperty({ description: 'Short-lived access token (Bearer)' })
  accessToken!: string;

  @ApiProperty({ description: 'Long-lived refresh token' })
  refreshToken!: string;

  @ApiProperty({ example: 900, description: 'Access token TTL in seconds' })
  expiresIn!: number;
}

export class AuthResponseDto extends AuthTokensDto {
  @ApiProperty({ type: UserEntity })
  user!: UserEntity;
}
