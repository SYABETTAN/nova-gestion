import type { DocumentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildRelativeStoragePath,
  getStorageProvider,
  validateUploadFile,
} from "@/lib/storage";

export type UploadDocumentInput = {
  organizationId: string;
  userId: string;
  type: DocumentType;
  title: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  entityType?: string;
  entityId?: string;
  description?: string;
  category?: string;
};

export async function uploadAndCreateDocument(input: UploadDocumentInput) {
  const validation = validateUploadFile(input.fileName, input.mimeType, input.buffer.length);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const storage = getStorageProvider();
  const relativePath = buildRelativeStoragePath(
    input.category ?? input.type.toLowerCase(),
    input.fileName,
  );

  const stored = await storage.put({
    organizationId: input.organizationId,
    relativePath,
    body: input.buffer,
    mimeType: validation.mimeType,
  });

  const document = await prisma.document.create({
    data: {
      organizationId: input.organizationId,
      type: input.type,
      title: input.title,
      description: input.description,
      entityType: input.entityType,
      entityId: input.entityId,
      fileName: input.fileName,
      storageKey: stored.storageKey,
      mimeType: validation.mimeType,
      sizeBytes: stored.sizeBytes,
      checksum: stored.checksum,
      generatedById: input.userId,
      generatedAt: new Date(),
      status: "GENERATED",
    },
  });

  return { document, stored };
}

export async function getDocumentFileBuffer(documentId: string, organizationId: string) {
  const document = await prisma.document.findFirst({
    where: { id: documentId, organizationId },
  });
  if (!document) {
    throw new Error("Document introuvable");
  }

  const storage = getStorageProvider();
  const buffer = await storage.get(document.storageKey);
  return { document, buffer };
}

export async function deleteDocumentFile(documentId: string, organizationId: string) {
  const document = await prisma.document.findFirst({
    where: { id: documentId, organizationId },
  });
  if (!document) {
    throw new Error("Document introuvable");
  }

  const storage = getStorageProvider();
  await storage.delete(document.storageKey).catch(() => undefined);
  await prisma.document.delete({ where: { id: documentId } });
  return document;
}

export function getDocumentDownloadPath(documentId: string): string {
  return `/api/files/${documentId}`;
}
