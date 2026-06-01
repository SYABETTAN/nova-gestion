import { z } from "zod";
import { isProduction } from "@/lib/env";

const storageSchema = z.object({
  STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
  STORAGE_PATH: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
});

export type StorageConfig = {
  provider: "local" | "s3";
  localPath?: string;
  s3Endpoint?: string;
  s3Region?: string;
  s3Bucket?: string;
  s3AccessKey?: string;
  s3SecretKey?: string;
};

let cached: StorageConfig | null = null;

export function getStorageConfig(): StorageConfig {
  if (cached) return cached;

  const parsed = storageSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error("Configuration stockage invalide");
  }

  const env = parsed.data;
  const provider = env.STORAGE_PROVIDER;

  if (isProduction() && provider === "local") {
    console.warn(
      "[storage] STORAGE_PROVIDER=local en production — préférez s3 ou R2 pour la montée en charge.",
    );
  }

  if (provider === "s3") {
    const missing = [
      !env.S3_REGION && "S3_REGION",
      !env.S3_BUCKET && "S3_BUCKET",
      !env.S3_ACCESS_KEY && "S3_ACCESS_KEY",
      !env.S3_SECRET_KEY && "S3_SECRET_KEY",
    ].filter(Boolean);
    if (missing.length > 0) {
      throw new Error(
        `Configuration S3 incomplète : ${missing.join(", ")} requis avec STORAGE_PROVIDER=s3`,
      );
    }
  }

  cached = {
    provider,
    localPath: env.STORAGE_PATH,
    s3Endpoint: env.S3_ENDPOINT,
    s3Region: env.S3_REGION,
    s3Bucket: env.S3_BUCKET,
    s3AccessKey: env.S3_ACCESS_KEY,
    s3SecretKey: env.S3_SECRET_KEY,
  };

  return cached;
}

export function resetStorageConfigForTests(): void {
  cached = null;
}
