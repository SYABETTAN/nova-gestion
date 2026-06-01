"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { getStorageProvider, validateUploadFile, buildRelativeStoragePath } from "@/lib/storage";
import { getDocumentDownloadPath } from "@/lib/documents/document-storage";

export async function uploadSupplierInvoiceAttachmentAction(
  invoiceId: string,
  formData: FormData,
) {
  const user = await requireAuth();
  requirePermission(user, "SUPPLIER_INVOICES_UPDATE");

  const invoice = await prisma.supplierInvoice.findFirst({
    where: { id: invoiceId, organizationId: user.organizationId },
  });
  if (!invoice) return { success: false, error: "Facture introuvable" };

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { success: false, error: "Fichier requis" };
  }

  const type = String(formData.get("type") ?? "INVOICE_PDF");
  const allowedTypes = ["INVOICE_PDF", "RECEIPT", "CONTRACT", "OTHER"] as const;
  if (!allowedTypes.includes(type as (typeof allowedTypes)[number])) {
    return { success: false, error: "Type de pièce jointe invalide" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const validation = validateUploadFile(file.name, file.type || "application/octet-stream", buffer.length);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const storage = getStorageProvider();
  const stored = await storage.put({
    organizationId: user.organizationId,
    relativePath: buildRelativeStoragePath("supplier-invoices", file.name),
    body: buffer,
    mimeType: validation.mimeType,
  });

  const attachment = await prisma.supplierInvoiceAttachment.create({
    data: {
      organizationId: user.organizationId,
      supplierInvoiceId: invoiceId,
      fileName: file.name,
      storageKey: stored.storageKey,
      mimeType: validation.mimeType,
      sizeBytes: stored.sizeBytes,
      checksum: stored.checksum,
      type: type as (typeof allowedTypes)[number],
      uploadedById: user.id,
    },
  });

  await prisma.supplierInvoiceActivity.create({
    data: {
      organizationId: user.organizationId,
      supplierInvoiceId: invoiceId,
      userId: user.id,
      type: "ATTACHMENT_ADDED",
      title: "Pièce jointe ajoutée",
      description: file.name,
    },
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "SUPPLIER_INVOICE_ATTACHMENT_ADDED",
    entityType: "SupplierInvoiceAttachment",
    entityId: attachment.id,
    entityLabel: file.name,
  });

  revalidatePath(`/supplier-invoices/${invoiceId}`);
  return {
    success: true as const,
    attachmentId: attachment.id,
    downloadUrl: `/api/files/supplier-attachment/${attachment.id}`,
  };
}

export async function deleteSupplierInvoiceAttachmentAction(attachmentId: string) {
  const user = await requireAuth();
  requirePermission(user, "SUPPLIER_INVOICES_UPDATE");

  const attachment = await prisma.supplierInvoiceAttachment.findFirst({
    where: { id: attachmentId, organizationId: user.organizationId },
  });
  if (!attachment) return { success: false, error: "Pièce jointe introuvable" };

  const storage = getStorageProvider();
  await storage.delete(attachment.storageKey).catch(() => undefined);
  await prisma.supplierInvoiceAttachment.delete({ where: { id: attachmentId } });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "SUPPLIER_INVOICE_ATTACHMENT_DELETED",
    entityType: "SupplierInvoiceAttachment",
    entityId: attachmentId,
    entityLabel: attachment.fileName,
  });

  revalidatePath(`/supplier-invoices/${attachment.supplierInvoiceId}`);
  return { success: true as const };
}

/** @deprecated — alias conservé */
export const addSupplierInvoiceAttachmentAction = uploadSupplierInvoiceAttachmentAction;
