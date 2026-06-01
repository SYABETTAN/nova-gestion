import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createLocalStorageProvider } from "@/lib/storage/local-provider";
import { resetStorageProviderForTests, setStorageProviderForTests } from "@/lib/storage";
import {
  deleteDocumentFile,
  getDocumentFileBuffer,
  uploadAndCreateDocument,
} from "@/lib/documents/document-storage";

const prisma = new PrismaClient();
const orgIds: string[] = [];

async function createTestOrg() {
  const slug = `storage-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const org = await prisma.organization.create({
    data: {
      name: "Storage Test Org",
      legalName: "Storage Test Org",
      slug,
      country: "FR",
    },
  });
  orgIds.push(org.id);
  const user = await prisma.user.create({
    data: {
      name: "Storage User",
      email: `storage-${Date.now()}@test.local`,
      passwordHash: "hash",
    },
  });
  const role = await prisma.role.findUniqueOrThrow({ where: { key: "OWNER" } });
  await prisma.organizationMember.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      roleId: role.id,
      status: "ACTIVE",
      joinedAt: new Date(),
    },
  });
  return { org, user };
}

describe("document storage service", () => {
  let tmpDir: string;

  afterEach(async () => {
    setStorageProviderForTests(null);
    resetStorageProviderForTests();
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true });
      tmpDir = "";
    }
  });

  afterAll(async () => {
    for (const id of orgIds) {
      await prisma.document.deleteMany({ where: { organizationId: id } });
      await prisma.organizationMember.deleteMany({ where: { organizationId: id } });
      await prisma.organization.delete({ where: { id } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  it("crée, récupère et supprime un document", async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "esther-doc-"));
    setStorageProviderForTests(createLocalStorageProvider(tmpDir));

    const { org, user } = await createTestOrg();
    const pdf = Buffer.from("%PDF-1.4\n%%EOF\n");

    const { document } = await uploadAndCreateDocument({
      organizationId: org.id,
      userId: user.id,
      type: "OTHER",
      title: "Test doc",
      fileName: "test.pdf",
      mimeType: "application/pdf",
      buffer: pdf,
      category: "uploads",
    });

    expect(document.storageKey).toBeTruthy();
    expect(document.sizeBytes).toBe(pdf.length);

    const { buffer } = await getDocumentFileBuffer(document.id, org.id);
    expect(buffer.equals(pdf)).toBe(true);

    await deleteDocumentFile(document.id, org.id);
    const gone = await prisma.document.findUnique({ where: { id: document.id } });
    expect(gone).toBeNull();
  });

  it("refuse l'accès cross-tenant à la récupération", async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "esther-doc-"));
    setStorageProviderForTests(createLocalStorageProvider(tmpDir));

    const { org, user } = await createTestOrg();
    const other = await createTestOrg();

    const { document } = await uploadAndCreateDocument({
      organizationId: org.id,
      userId: user.id,
      type: "OTHER",
      title: "Privé",
      fileName: "prive.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n%%EOF\n"),
    });

    await expect(getDocumentFileBuffer(document.id, other.org.id)).rejects.toThrow(
      /introuvable/i,
    );

    await deleteDocumentFile(document.id, org.id);
  });
});
