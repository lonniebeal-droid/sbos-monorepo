import type { Logger } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { PrismaService } from './prisma.service';

function loggerSpies(service: PrismaService) {
  const logger = (service as unknown as { logger: Logger }).logger;
  return {
    log: vi.spyOn(logger, 'log').mockImplementation(() => undefined),
    warn: vi.spyOn(logger, 'warn').mockImplementation(() => undefined),
  };
}

describe('PrismaService', () => {
  describe('onModuleInit', () => {
    it('logs success and does not warn when the connection succeeds', async () => {
      const service = new PrismaService();
      const spies = loggerSpies(service);
      vi.spyOn(service, '$connect').mockResolvedValue(undefined);

      await service.onModuleInit();

      expect(spies.log).toHaveBeenCalledWith('Connected to the database');
      expect(spies.warn).not.toHaveBeenCalled();
    });

    it('does not throw and logs a warning when the connection fails, so the app can still boot', async () => {
      const service = new PrismaService();
      const spies = loggerSpies(service);
      vi.spyOn(service, '$connect').mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(service.onModuleInit()).resolves.toBeUndefined();

      expect(spies.warn).toHaveBeenCalledTimes(1);
      expect(spies.warn.mock.calls[0][0] as string).toContain('DATABASE_URL');
      expect(spies.log).not.toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('disconnects the Prisma client', async () => {
      const service = new PrismaService();
      const disconnectSpy = vi.spyOn(service, '$disconnect').mockResolvedValue(undefined);

      await service.onModuleDestroy();

      expect(disconnectSpy).toHaveBeenCalledTimes(1);
    });
  });
});
