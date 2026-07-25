import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@sbos/database';

/**
 * Wraps the shared Prisma client with Nest lifecycle hooks so the connection is
 * established on module init and cleanly closed on shutdown.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Connected to the database');
    } catch {
      // Non-fatal: allow the API to boot without a database so that
      // non-persistent routes remain available in local/dev environments.
      // Database-backed endpoints will surface connection errors per-request.
      this.logger.warn(
        'Database unavailable at startup. Set DATABASE_URL and ensure PostgreSQL is reachable; DB-backed endpoints will error until then.',
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
