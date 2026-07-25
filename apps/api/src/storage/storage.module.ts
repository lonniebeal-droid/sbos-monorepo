import { Global, Module } from '@nestjs/common';

import { LocalStorageProvider } from './local-storage.provider';
import { STORAGE_PROVIDER } from './storage.interface';

/**
 * Storage module. Binds {@link STORAGE_PROVIDER} to the local provider by
 * default; an S3-compatible provider can replace it here without touching
 * consumers.
 */
@Global()
@Module({
  providers: [
    LocalStorageProvider,
    { provide: STORAGE_PROVIDER, useExisting: LocalStorageProvider },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
