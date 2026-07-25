import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type {
  PresignedUpload,
  StorageProvider,
} from './storage.interface';

/**
 * Local/dev storage provider. Produces namespaced keys and time-boxed URLs that
 * point at the API's own file-serving route. Mirrors the shape an S3 provider
 * returns so the swap is a one-line binding change in production.
 */
@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly baseUrl: string;
  private readonly ttlSeconds = 900;

  constructor(configService: ConfigService) {
    this.baseUrl =
      configService.get<string>('STORAGE_BASE_URL') ??
      'http://localhost:4000/api/v1/files';
  }

  private sanitize(fileName: string): string {
    return fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  }

  async createUpload(params: {
    organizationId: string;
    fileName: string;
  }): Promise<PresignedUpload> {
    const storageKey = `orgs/${params.organizationId}/${randomUUID()}/${this.sanitize(
      params.fileName,
    )}`;
    return {
      uploadUrl: `${this.baseUrl}/${encodeURI(storageKey)}`,
      storageKey,
      method: 'PUT',
      expiresIn: this.ttlSeconds,
    };
  }

  async getDownloadUrl(storageKey: string): Promise<string> {
    return `${this.baseUrl}/${encodeURI(storageKey)}`;
  }

  async remove(): Promise<void> {
    // Local provider is metadata-only; object lifecycle is a no-op here.
  }
}
