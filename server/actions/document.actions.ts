"use server";

import { revalidatePath } from "next/cache";
import type { DocumentStatus, DocumentType } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { documentFilterSchema } from "@/lib/export-validators";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";

export async function listDocumentsAction(searchParams: Record<string, string | undefined>) {
  const user = await requireAuth();
  requirePermission(user, "DOCUMENTS_READ");

  const parsed = documentFilterSchema.safeParse(searchParams);
  const filters = parsed.success ? parsed.data : { page: 1, pageSize: 20 };

  const where: {
    organizationId: string;
    type?: DocumentType;
    status?: DocumentStatus;
    OR?: { title?: { contains: string }; fileName?: { contains: string } }[];
    createdAt?: { gte?: Date; lte?: Date };
  } = { organizationId: user.organizationId };

  if (filters.type) where.type = filters.type as DocumentType;
  if (filters.status) where.status = filters.status as DocumentStatus;
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search } },
      { fileName: { contains: filters.search } },
    ];
  }
  if (filters.startDate || filters.endDate) {
    where.createdAt = {
      ...(filters.startDate ? { gte: new Date(filters.startDate) } : {}),
      ...(filters.endDate ? { lte: new Date(filters.endDate) } : {}),
    };
  }

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      include: { generatedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.document.count({ where }),
  ]);

  return {
    documents,
    total,
    page: filters.page,
    totalPages: Math.ceil(total / filters.pageSize),
  };
}

export async function getDocumentByIdAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "DOCUMENTS_READ");

  const document = await prisma.document.findFirst({
    where: { id, organizationId: user.organizationId },
    include: { generatedBy: { select: { name: true, email: true } } },
  });
  if (!document) throw new Error("Document introuvable");
  return document;
}

export async function archiveDocumentAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "DOCUMENTS_ARCHIVE");

  const document = await prisma.document.update({
    where: { id, organizationId: user.organizationId },
    data: { status: "ARCHIVED" },
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "DOCUMENT_ARCHIVED",
    entityType: "Document",
    entityId: document.id,
    entityLabel: document.title,
  });

  revalidatePath("/documents");
  revalidatePath(`/documents/${id}`);
  return { success: true as const };
}

/** @deprecated Utiliser uploadDocumentAction (server/actions/file.actions.ts) */
export async function createDocumentAction(_input: Record<string, unknown>) {
  const user = await requireAuth();
  requirePermission(user, "DOCUMENTS_CREATE");
  void user;
  throw new Error(
    "Création de document sans fichier obsolète. Utilisez le téléversement de fichier.",
  );
}

/** @deprecated Les PDF sont générés et stockés via generateInvoicePrintAction / generateQuotePrintAction */
export async function registerPrintPlaceholderAction(_input: {
  type: DocumentType;
  title: string;
  fileName: string;
  entityType?: string;
  entityId?: string;
}) {
  throw new Error("Les placeholders d'impression ne sont plus utilisés. Générez un PDF réel.");
}
