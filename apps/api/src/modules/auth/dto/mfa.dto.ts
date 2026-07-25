import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class MfaCodeDto {
  @ApiProperty({ example: '123456', description: '6-digit TOTP code' })
  @IsString()
  @Length(6, 6)
  code!: string;
}

export class MfaLoginDto {
  @ApiProperty({ description: 'Challenge token from the login response' })
  @IsString()
  mfaToken!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  code!: string;
}

export class MfaSetupResponseDto {
  @ApiProperty({ description: 'otpauth:// provisioning URI' })
  otpauthUrl!: string;

  @ApiProperty({ description: 'QR code as a data URL for authenticator apps' })
  qrDataUrl!: string;

  @ApiProperty({ description: 'Base32 secret (for manual entry)' })
  secret!: string;
}

export class MfaChallengeDto {
  @ApiProperty({ example: true })
  mfaRequired!: true;

  @ApiProperty({ description: 'Short-lived token to complete MFA login' })
  mfaToken!: string;
}
