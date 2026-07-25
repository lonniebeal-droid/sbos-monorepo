import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  CreatePayerDto,
  CreateServiceCodeDto,
  UpdatePayerDto,
  UpdateServiceCodeDto,
} from './dto/reference.dto';
import { CreateClaimDto, UpdateClaimStatusDto } from './dto/claim.dto';
import { CreateInvoiceDto, RecordPaymentDto } from './dto/invoice.dto';
import { BillingReferenceService } from './billing-reference.service';
import { ClaimsService } from './claims.service';
import { InvoicesService } from './invoices.service';
import { PaymentsService } from './payments.service';
import { SuperbillsService } from './superbills.service';

@ApiTags('Billing')
@ApiBearerAuth()
@Controller({ path: 'billing', version: '1' })
export class BillingController {
  constructor(
    private readonly reference: BillingReferenceService,
    private readonly claims: ClaimsService,
    private readonly invoices: InvoicesService,
    private readonly payments: PaymentsService,
    private readonly superbills: SuperbillsService,
  ) {}

  // ----- Payers -----
  @Get('payers')
  @ApiOperation({ summary: 'List payers' })
  listPayers(@CurrentUser() user: AuthenticatedUser) {
    return this.reference.listPayers(user.organizationId);
  }

  @Post('payers')
  @Roles(Role.BILLING)
  @ApiOperation({ summary: 'Create a payer' })
  createPayer(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePayerDto,
  ) {
    return this.reference.createPayer(user.organizationId, dto);
  }

  @Patch('payers/:id')
  @Roles(Role.BILLING)
  @ApiOperation({ summary: 'Update a payer' })
  updatePayer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdatePayerDto,
  ) {
    return this.reference.updatePayer(user.organizationId, id, dto);
  }

  // ----- Service codes / fee schedule -----
  @Get('service-codes')
  @ApiOperation({ summary: 'List the CPT fee schedule' })
  listServiceCodes(@CurrentUser() user: AuthenticatedUser) {
    return this.reference.listServiceCodes(user.organizationId);
  }

  @Post('service-codes')
  @Roles(Role.BILLING)
  @ApiOperation({ summary: 'Add a service code to the fee schedule' })
  createServiceCode(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateServiceCodeDto,
  ) {
    return this.reference.createServiceCode(user.organizationId, dto);
  }

  @Patch('service-codes/:id')
  @Roles(Role.BILLING)
  @ApiOperation({ summary: 'Update a service code' })
  updateServiceCode(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateServiceCodeDto,
  ) {
    return this.reference.updateServiceCode(user.organizationId, id, dto);
  }

  // ----- Claims -----
  @Get('claims')
  @ApiOperation({ summary: 'List claims (paginated)' })
  listClaims(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.claims.findAll(user.organizationId, query);
  }

  @Get('claims/:id')
  @ApiOperation({ summary: 'Get a claim' })
  getClaim(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.claims.findOne(user.organizationId, id);
  }

  @Post('claims')
  @Roles(Role.BILLING)
  @ApiOperation({ summary: 'Create a claim (draft)' })
  createClaim(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateClaimDto,
  ) {
    return this.claims.create(user.organizationId, dto);
  }

  @Post('claims/:id/submit')
  @Roles(Role.BILLING)
  @ApiOperation({ summary: 'Submit a claim to the payer' })
  submitClaim(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.claims.submit(user.organizationId, id);
  }

  @Patch('claims/:id/status')
  @Roles(Role.BILLING)
  @ApiOperation({ summary: 'Update claim status (accept/deny/pay — ERA/EOB posting)' })
  updateClaimStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateClaimStatusDto,
  ) {
    return this.claims.updateStatus(user.organizationId, id, dto);
  }

  // ----- Invoices -----
  @Get('invoices')
  @ApiOperation({ summary: 'List invoices for a client (?clientId=)' })
  listInvoices(
    @CurrentUser() user: AuthenticatedUser,
    @Query('clientId') clientId: string,
  ) {
    return this.invoices.findForClient(user.organizationId, clientId);
  }

  @Get('invoices/:id')
  @ApiOperation({ summary: 'Get an invoice' })
  getInvoice(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.invoices.findOne(user.organizationId, id);
  }

  @Post('invoices')
  @Roles(Role.BILLING)
  @ApiOperation({ summary: 'Create an invoice with line items' })
  createInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInvoiceDto,
  ) {
    return this.invoices.create(user.organizationId, dto);
  }

  // ----- Payments -----
  @Get('payments')
  @ApiOperation({ summary: 'List payments for a client (?clientId=)' })
  listPayments(
    @CurrentUser() user: AuthenticatedUser,
    @Query('clientId') clientId: string,
  ) {
    return this.payments.findForClient(user.organizationId, clientId);
  }

  @Post('payments')
  @Roles(Role.BILLING)
  @ApiOperation({ summary: 'Record a payment (charges via the payment provider)' })
  recordPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.payments.record(user.organizationId, user.id, dto);
  }

  // ----- Superbill -----
  @Get('superbill')
  @ApiOperation({ summary: 'Generate a superbill for a client and date range' })
  superbill(
    @CurrentUser() user: AuthenticatedUser,
    @Query('clientId') clientId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.superbills.generate(user.organizationId, clientId, from, to);
  }
}
