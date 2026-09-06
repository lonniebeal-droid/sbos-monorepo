import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUrl, Matches, MaxLength } from 'class-validator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface';
import { MEDICAL_CONNECTOR_VENDORS, X12_TRANSACTIONS, type MedicalConnectorVendor, type X12Transaction } from './medical-connectors.types';
import { MedicalConnectorsService } from './medical-connectors.service';

class SaveConnectorDto {
  @IsIn(MEDICAL_CONNECTOR_VENDORS) vendor!: MedicalConnectorVendor;
  @IsUrl({ require_tld: false }) baseUrl!: string;
  @IsOptional() @IsString() @MaxLength(250) clientId?: string;
  @IsOptional() @IsString() @MaxLength(1500) scopes?: string;
}
class SyntheticX12Dto {
  @IsIn(X12_TRANSACTIONS) transaction!: X12Transaction;
  @Matches(/^SYN-[A-Za-z0-9-]{3,60}$/) traceId!: string;
}

@ApiTags('Medical Connectors')
@ApiBearerAuth()
@Controller({ path: 'medical-connectors', version: '1' })
export class MedicalConnectorsController {
  constructor(private readonly connectors: MedicalConnectorsService) {}

  @Get('vendors') @ApiOperation({ summary: 'List supported standards-first connector profiles' })
  vendors() { return this.connectors.vendors(); }

  @Get() @Roles(Role.ORG_ADMIN)
  list(@CurrentUser() user: AuthenticatedUser) { return this.connectors.list(user.organizationId); }

  @Post() @Roles(Role.ORG_ADMIN)
  save(@CurrentUser() user: AuthenticatedUser, @Body() dto: SaveConnectorDto) { return this.connectors.save(user.organizationId, user.id, dto); }

  @Post(':id/test') @Roles(Role.ORG_ADMIN)
  test(@CurrentUser() user: AuthenticatedUser, @Param('id') id:string) { return this.connectors.test(user.organizationId, user.id, id); }

  @Post(':id/disconnect') @Roles(Role.ORG_ADMIN)
  disconnect(@CurrentUser() user: AuthenticatedUser, @Param('id') id:string) { return this.connectors.disconnect(user.organizationId, user.id, id); }

  @Post('billing/synthetic-x12') @Roles(Role.ORG_ADMIN, Role.BILLING)
  x12(@Body() dto:SyntheticX12Dto) { return this.connectors.previewX12(dto.transaction, dto.traceId); }
}
