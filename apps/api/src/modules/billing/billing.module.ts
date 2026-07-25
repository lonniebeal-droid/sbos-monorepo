import { Module } from '@nestjs/common';

import { BillingController } from './billing.controller';
import { BillingReferenceService } from './billing-reference.service';
import { ClaimsService } from './claims.service';
import { InvoicesService } from './invoices.service';
import { PaymentsService } from './payments.service';
import { SuperbillsService } from './superbills.service';

@Module({
  controllers: [BillingController],
  providers: [
    BillingReferenceService,
    ClaimsService,
    InvoicesService,
    PaymentsService,
    SuperbillsService,
  ],
  exports: [ClaimsService, InvoicesService, PaymentsService],
})
export class BillingModule {}
