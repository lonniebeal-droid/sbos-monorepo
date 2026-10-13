import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsArray, IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { IntegrationAdminService, MEDICAL_PROVIDER_IDS } from './integration-admin.service';

class ConfigureMedicalProviderDto {
  @IsIn([...MEDICAL_PROVIDER_IDS])
  provider!: string;
  @IsUrl({ require_tld: false })
  baseUrl!: string;
  @IsString()
  @MaxLength(250)
  clientId!: string;
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];
}

class AuthorizeMedicalProviderDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  code?: string;
}

class SyncMedicalResourcesDto {
  @IsArray()
  @IsString({ each: true })
  resourceTypes!: string[];
}

/**
 * Office-admin medical provider lifecycle (configure -> authorize -> test ->
 * sync -> retry -> revoke) backed by the provider-neutral ProviderAdapter.
 *
 * Tenant isolation: every endpoint derives the tenant from the authenticated
 * user (user.organizationId). The tenant is never accepted from the request
 * body, and the adapter re-asserts it on every operation.
 */
@ApiTags('Integration Admin')
@ApiBearerAuth()
@Controller({ path: 'integrations/admin', version: '1' })
@Roles(Role.ORG_ADMIN)
export class IntegrationAdminController {
  constructor(private readonly admin: IntegrationAdminService) {}

  @Post('medical-providers')
  @ApiOperation({ summary: 'Configure a medical provider connection (not yet authorized)' })
  configure(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfigureMedicalProviderDto,
  ) {
    return this.admin.configureMedicalProvider(user.organizationId, dto.provider, {
      baseUrl: dto.baseUrl,
      clientId: dto.clientId,
      scopes: dto.scopes,
    });
  }

  @Post('medical-providers/authorize')
  @ApiOperation({ summary: 'Authorize the configured medical provider (OAuth code exchange)' })
  authorize(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AuthorizeMedicalProviderDto,
  ) {
    return this.admin.authorizeMedicalConnection(user.organizationId, dto.code);
  }

  @Post('medical-providers/test')
  @ApiOperation({ summary: 'Test the medical provider connection' })
  test(@CurrentUser() user: AuthenticatedUser) {
    return this.admin.testMedicalConnection(user.organizationId);
  }

  @Get('medical-providers/health')
  @ApiOperation({ summary: 'Connection health model for this tenant' })
  health(@CurrentUser() user: AuthenticatedUser) {
    return this.admin.getMedicalConnectionHealth(user.organizationId);
  }

  @Get('medical-providers/capabilities')
  @ApiOperation({ summary: 'Discover provider capabilities, granted scopes, supported resources' })
  capabilities(@CurrentUser() user: AuthenticatedUser) {
    return this.admin.getMedicalConnectionCapabilities(user.organizationId);
  }

  @Post('medical-providers/sync')
  @ApiOperation({ summary: 'Sync permitted synthetic FHIR resources' })
  sync(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SyncMedicalResourcesDto,
  ) {
    return this.admin.syncMedicalResources(user.organizationId, dto.resourceTypes);
  }

  @Post('medical-providers/retry')
  @ApiOperation({ summary: 'Retry after a recoverable connection error' })
  retry(@CurrentUser() user: AuthenticatedUser) {
    return this.admin.retryMedicalConnection(user.organizationId);
  }

  @Delete('medical-providers')
  @ApiOperation({ summary: 'Revoke the medical provider connection' })
  revoke(@CurrentUser() user: AuthenticatedUser) {
    return this.admin.revokeMedicalConnection(user.organizationId);
  }
}
