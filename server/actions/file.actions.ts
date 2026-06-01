"use server";

import { revalidatePath } from "next/cache";
import type { DocumentType } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import {
  deleteDocumentFile,
  getDocumentDownloadPath,
  uploadAndCreateDocument,
} from "@/lib/documents/document-storage";
import { validateUploadFile } from "@/lib/storage";

export async function uploadDocumentAction(formData: FormData) {
  const user = await requireAuth();
  requirePermission(user, "DOCUMENTS_CREATE");

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { success: false as const, error: "Fichier requis" };
  }

  const type = String(formData.get("type") ?? "OTHER") as DocumentType;
  const title = String(formData.get("title") ?? file.name);
  const entityType = formData.get("entityType") ? String(formData.get("entityType")) : undefined;
  const entityId = formData.get("entityId") ? String(formData.get("entityId")) : undefined;

  const buffer = Buffer.from(await file.arrayBuffer());
  const validation = validateUploadFile(file.name, file.type || "application/octet-stream", buffer.length);
  if (!validation.valid) {
    return { success: false as const, error: validation.error };
  }

  try {
    const { document } = await uploadAndCreateDocument({
      organizationId: user.organizationId,
      userId: user.id,
      type,
      title,
      fileName: file.name,
      mimeType: file.type || validation.mimeType,
      buffer,
      entityType,
      entityId,
      category: "uploads",
    });

    await createAuditLog({
      organizationId: user.organizationId,
      userId: user.id,
      action: "DOCUMENT_UPLOADED",
      entityType: "Document",
      entityId: document.id,
      entityLabel: document.title,
    });

    revalidatePath("/documents");
    if (entityType === "Customer" && entityId) revalidatePath(`/customers/${entityId}`);
    if (entityType === "Supplier" && entityId) revalidatePath(`/suppliers/${entityId}`);

    return {
      success: true as const,
      documentId: document.id,
      downloadUrl: getDocumentDownloadPath(document.id),
    };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Échec du téléversement",
    };
  }
}

export async function deleteDocumentAction(documentId: string) {
  const user = await requireAuth();
  requirePermission(user, "DOCUMENTS_ARCHIVE");

  try {
    const document = await deleteDocumentFile(documentId, user.organizationId);

    await createAuditLog({
      organizationId: user.organizationId,
      userId: user.id,
      action: "DOCUMENT_DELETED",
      entityType: "Document",
      entityId: document.id,
      entityLabel: document.title,
    });

    revalidatePath("/documents");
    return { success: true as const };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Suppression impossible",
    };
  }
}
