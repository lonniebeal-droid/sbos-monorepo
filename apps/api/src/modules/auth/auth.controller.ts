import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { UserEntity } from '../users/entities/user.entity';
import { AuthService } from './auth.service';
import { AuthResponseDto, AuthTokensDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import {
  MfaChallengeDto,
  MfaCodeDto,
  MfaLoginDto,
  MfaSetupResponseDto,
} from './dto/mfa.dto';

@ApiTags('Authentication')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Authenticate with email and password',
    description:
      'Returns tokens, or an MFA challenge ({ mfaRequired, mfaToken }) when the account has MFA enabled.',
  })
  @ApiOkResponse({ type: AuthResponseDto })
  login(@Body() dto: LoginDto): Promise<AuthResponseDto | MfaChallengeDto> {
    return this.authService.login(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login/mfa')
  @HttpCode(200)
  @ApiOperation({ summary: 'Complete login by verifying an MFA code' })
  @ApiOkResponse({ type: AuthResponseDto })
  loginMfa(@Body() dto: MfaLoginDto): Promise<AuthResponseDto> {
    return this.authService.loginMfa(dto.mfaToken, dto.code);
  }

  @Post('mfa/setup')
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: 'Begin MFA enrollment (returns a QR code)' })
  @ApiOkResponse({ type: MfaSetupResponseDto })
  mfaSetup(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MfaSetupResponseDto> {
    return this.authService.mfaSetup(user.id);
  }

  @Post('mfa/enable')
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: 'Confirm and enable MFA with a TOTP code' })
  mfaEnable(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MfaCodeDto,
  ): Promise<{ enabled: true }> {
    return this.authService.mfaEnable(user.id, dto.code);
  }

  @Post('mfa/disable')
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: 'Disable MFA with a current TOTP code' })
  mfaDisable(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MfaCodeDto,
  ): Promise<{ enabled: false }> {
    return this.authService.mfaDisable(user.id, dto.code);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Rotate a refresh token for a new token pair',
    description:
      'Rotates the refresh token (the presented one is revoked). Reuse of a revoked token revokes the whole family.',
  })
  @ApiOkResponse({ type: AuthTokensDto })
  refresh(@Body() dto: RefreshDto): Promise<AuthTokensDto> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Revoke a refresh token (logout)' })
  logout(@Body() dto: RefreshDto): Promise<{ success: true }> {
    return this.authService.logout(dto.refreshToken);
  }

  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the authenticated user profile' })
  @ApiOkResponse({ type: UserEntity })
  profile(@CurrentUser() user: AuthenticatedUser): Promise<UserEntity> {
    return this.authService.profile(user.id);
  }
}
