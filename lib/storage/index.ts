import path from "path";
import { getStorageConfig } from "@/lib/storage/config";
import { createLocalStorageProvider } from "@/lib/storage/local-provider";
import { createS3StorageProvider } from "@/lib/storage/s3-provider";
import type { StorageProvider } from "@/lib/storage/types";

let cached: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (cached) return cached;

  const config = getStorageConfig();

  if (config.provider === "s3") {
    cached = createS3StorageProvider({
      endpoint: config.s3Endpoint,
      region: config.s3Region!,
      bucket: config.s3Bucket!,
      accessKeyId: config.s3AccessKey!,
      secretAccessKey: config.s3SecretKey!,
    });
  } else {
    const basePath = config.localPath ?? path.join(process.cwd(), "uploads");
    cached = createLocalStorageProvider(basePath);
  }

  return cached;
}

export function resetStorageProviderForTests(): void {
  cached = null;
}

export function setStorageProviderForTests(provider: StorageProvider | null): void {
  cached = provider;
}

export type { StorageProvider, StoragePutInput, StoredObject } from "@/lib/storage/types";
export {
  buildStorageKey,
  buildRelativeStoragePath,
  sanitizeFileName,
  sha256Checksum,
} from "@/lib/storage/path-utils";
export { validateUploadFile, getMaxUploadSizeBytes } from "@/lib/storage/file-validation";
