export type StoredObject = {
  storageKey: string;
  sizeBytes: number;
  checksum: string;
};

export type StoragePutInput = {
  organizationId: string;
  relativePath: string;
  body: Buffer;
  mimeType: string;
};

export type StorageProviderName = "local" | "s3";

export interface StorageProvider {
  readonly name: StorageProviderName;
  put(input: StoragePutInput): Promise<StoredObject>;
  get(storageKey: string): Promise<Buffer>;
  delete(storageKey: string): Promise<void>;
  exists(storageKey: string): Promise<boolean>;
}
