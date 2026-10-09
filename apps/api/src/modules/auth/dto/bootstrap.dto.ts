import { IsEmail, IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class BootstrapDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  organizationName: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'organizationSlug must use lowercase letters, numbers, and single hyphens only',
  })
  organizationSlug: string;

  @IsEmail()
  adminEmail: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  adminPassword: string;
}
