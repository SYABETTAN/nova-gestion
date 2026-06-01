import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { StorageProvider, StoragePutInput, StoredObject } from "@/lib/storage/types";
import { sha256Checksum } from "@/lib/storage/path-utils";

export type S3StorageConfig = {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

export function createS3StorageProvider(config: S3StorageConfig): StorageProvider {
  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint || undefined,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: Boolean(config.endpoint),
  });

  return {
    name: "s3",
    async put(input: StoragePutInput): Promise<StoredObject> {
      const storageKey = `${input.organizationId}/${input.relativePath}`.replace(/\\/g, "/");
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: storageKey,
          Body: input.body,
          ContentType: input.mimeType,
        }),
      );
      return {
        storageKey,
        sizeBytes: input.body.length,
        checksum: sha256Checksum(input.body),
      };
    },
    async get(storageKey: string): Promise<Buffer> {
      const response = await client.send(
        new GetObjectCommand({ Bucket: config.bucket, Key: storageKey }),
      );
      if (!response.Body) throw new Error("Fichier introuvable dans le stockage");
      const bytes = await response.Body.transformToByteArray();
      return Buffer.from(bytes);
    },
    async delete(storageKey: string): Promise<void> {
      await client.send(
        new DeleteObjectCommand({ Bucket: config.bucket, Key: storageKey }),
      );
    },
    async exists(storageKey: string): Promise<boolean> {
      try {
        await client.send(
          new HeadObjectCommand({ Bucket: config.bucket, Key: storageKey }),
        );
        return true;
      } catch {
        return false;
      }
    },
  };
}
