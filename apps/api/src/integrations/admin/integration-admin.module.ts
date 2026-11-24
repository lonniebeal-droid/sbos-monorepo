import { Module } from '@nestjs/common';

import { AuditModule } from '../../audit/audit.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { X12GeneratorService } from '../x12/x12-generator.service';
import { X12ParserService } from '../x12/x12-parser.service';
import { IntegrationAdminController } from './integration-admin.controller';
import { IntegrationAdminService } from './integration-admin.service';
import { IntegrationConfigService } from './integration-config.service';

/**
 * Wires the standalone integrations tree (admin service + ProviderAdapter
 * lifecycle + X12 helpers) into the Nest application.
 *
 * Register in AppModule imports to activate the /v1/integrations/admin
 * endpoints. All endpoints are ORG_ADMIN-only and tenant-scoped via the
 * authenticated user.
 */
@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [IntegrationAdminController],
  providers: [
    IntegrationConfigService,
    X12GeneratorService,
    X12ParserService,
    IntegrationAdminService,
  ],
  exports: [IntegrationAdminService],
})
export class IntegrationAdminModule {}
