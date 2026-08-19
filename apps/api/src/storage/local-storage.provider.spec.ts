import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';

import { LocalStorageProvider } from './local-storage.provider';

function makeProvider(baseUrl?: string): LocalStorageProvider {
  const configService = {
    get: vi.fn().mockReturnValue(baseUrl),
  } as unknown as ConfigService;
  return new LocalStorageProvider(configService);
}

describe('LocalStorageProvider', () => {
  describe('createUpload', () => {
    it('defaults the base URL when STORAGE_BASE_URL is not configured', async () => {
      const provider = makeProvider(undefined);

      const result = await provider.createUpload({
        organizationId: 'org1',
        fileName: 'chart.pdf',
      });

      expect(result.uploadUrl.startsWith('http://localhost:4000/api/v1/files/')).toBe(
        true,
      );
    });

    it('uses a configured STORAGE_BASE_URL', async () => {
      const provider = makeProvider('https://files.example.com');

      const result = await provider.createUpload({
        organizationId: 'org1',
        fileName: 'chart.pdf',
      });

      expect(result.uploadUrl.startsWith('https://files.example.com/')).toBe(true);
    });

    it('namespaces the storage key by organization with a random segment', async () => {
      const provider = makeProvider('https://files.example.com');

      const result = await provider.createUpload({
        organizationId: 'org1',
        fileName: 'chart.pdf',
      });

      expect(result.storageKey).toMatch(
        /^orgs\/org1\/[0-9a-f-]{36}\/chart\.pdf$/,
      );
      expect(result.method).toBe('PUT');
      expect(result.expiresIn).toBe(900);
    });

    it('strips path separators and other unsafe characters from the file name', async () => {
      const provider = makeProvider('https://files.example.com');

      const result = await provider.createUpload({
        organizationId: 'org1',
        fileName: '../../etc/passwd; rm -rf /.pdf',
      });

      const sanitizedName = result.storageKey.split('/').pop();
      // No '/' can survive in the last segment -- that's the actual safety
      // property (an injected '/' could otherwise escape the org/uuid
      // namespace). Only the allowed character classes remain.
      expect(sanitizedName).toMatch(/^[a-zA-Z0-9._-]+$/);
      expect(sanitizedName).not.toContain('/');
    });

    it('truncates an overly long file name to 120 characters', async () => {
      const provider = makeProvider('https://files.example.com');
      const longName = `${'a'.repeat(200)}.pdf`;

      const result = await provider.createUpload({
        organizationId: 'org1',
        fileName: longName,
      });

      const sanitizedName = result.storageKey.split('/').pop();
      expect(sanitizedName?.length).toBeLessThanOrEqual(120);
    });
  });

  describe('getDownloadUrl', () => {
    it('builds a URL-encoded download URL from the storage key', async () => {
      const provider = makeProvider('https://files.example.com');

      const url = await provider.getDownloadUrl('orgs/org1/abc/chart.pdf');

      expect(url).toBe('https://files.example.com/orgs/org1/abc/chart.pdf');
    });
  });

  describe('remove', () => {
    it('is a metadata-only no-op that resolves without touching anything', async () => {
      const provider = makeProvider('https://files.example.com');

      await expect(provider.remove()).resolves.toBeUndefined();
    });
  });
});
