export interface PresignedUpload {
  /** URL the client PUTs the file bytes to. */
  uploadUrl: string;
  /** Opaque storage key to persist on the document record. */
  storageKey: string;
  /** Method the client should use for the upload. */
  method: 'PUT';
  /** Seconds until the URL expires. */
  expiresIn: number;
}

/**
 * Object-storage abstraction. The default implementation targets local/dev
 * storage; an S3-compatible provider can be bound to {@link STORAGE_PROVIDER}
 * without changing callers.
 */
export interface StorageProvider {
  /** Build a namespaced key and a presigned upload target. */
  createUpload(params: {
    organizationId: string;
    fileName: string;
  }): Promise<PresignedUpload>;

  /** Presigned (or direct) URL to download an object. */
  getDownloadUrl(storageKey: string): Promise<string>;

  /** Remove an object from storage. */
  remove(storageKey: string): Promise<void>;
}

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');
