import fs from "fs/promises";
import path from "path";
import type { StorageProvider, StoragePutInput, StoredObject } from "@/lib/storage/types";
import { sha256Checksum } from "@/lib/storage/path-utils";

export function createLocalStorageProvider(basePath: string): StorageProvider {
  const root = path.resolve(basePath);

  async function resolvePath(storageKey: string): Promise<string> {
    const full = path.resolve(root, storageKey);
    if (!full.startsWith(root + path.sep) && full !== root) {
      throw new Error("Chemin de stockage invalide");
    }
    return full;
  }

  return {
    name: "local",
    async put(input: StoragePutInput): Promise<StoredObject> {
      const storageKey = `${input.organizationId}/${input.relativePath}`.replace(/\\/g, "/");
      const filePath = await resolvePath(storageKey);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, input.body);
      return {
        storageKey,
        sizeBytes: input.body.length,
        checksum: sha256Checksum(input.body),
      };
    },
    async get(storageKey: string): Promise<Buffer> {
      const filePath = await resolvePath(storageKey);
      return fs.readFile(filePath);
    },
    async delete(storageKey: string): Promise<void> {
      const filePath = await resolvePath(storageKey);
      await fs.unlink(filePath).catch(() => undefined);
    },
    async exists(storageKey: string): Promise<boolean> {
      try {
        const filePath = await resolvePath(storageKey);
        await fs.access(filePath);
        return true;
      } catch {
        return false;
      }
    },
  };
}
