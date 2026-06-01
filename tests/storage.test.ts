import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { createLocalStorageProvider } from "@/lib/storage/local-provider";
import { validateUploadFile } from "@/lib/storage/file-validation";
import { sanitizeFileName, buildRelativeStoragePath } from "@/lib/storage/path-utils";
import { resetStorageProviderForTests, setStorageProviderForTests } from "@/lib/storage";

describe("file validation", () => {
  it("accepte un PDF valide", () => {
    const result = validateUploadFile("facture.pdf", "application/pdf", 1024);
    expect(result.valid).toBe(true);
  });

  it("refuse une extension dangereuse", () => {
    const result = validateUploadFile("virus.exe", "application/octet-stream", 100);
    expect(result.valid).toBe(false);
  });

  it("refuse un fichier trop volumineux", () => {
    const result = validateUploadFile("gros.pdf", "application/pdf", 20 * 1024 * 1024);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toMatch(/volumineux/i);
    }
  });
});

describe("local storage provider", () => {
  let tmpDir: string;

  afterEach(async () => {
    setStorageProviderForTests(null);
    resetStorageProviderForTests();
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("stocke et récupère un fichier", async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "esther-storage-"));
    const provider = createLocalStorageProvider(tmpDir);
    setStorageProviderForTests(provider);

    const body = Buffer.from("contenu test");
    const stored = await provider.put({
      organizationId: "org_test",
      relativePath: buildRelativeStoragePath("uploads", "doc.pdf"),
      body,
      mimeType: "application/pdf",
    });

    expect(stored.storageKey).toContain("org_test/");
    const read = await provider.get(stored.storageKey);
    expect(read.equals(body)).toBe(true);
    await provider.delete(stored.storageKey);
    expect(await provider.exists(stored.storageKey)).toBe(false);
  });

  it("sanitise les noms de fichiers", () => {
    expect(sanitizeFileName("../../etc/passwd")).not.toContain("..");
    expect(sanitizeFileName("facture client.pdf")).toBe("facture_client.pdf");
  });
});
