"use server";

import { revalidatePath } from "next/cache";
import type { DocumentType } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import {
  createDocumentTemplateSchema,
  updateDocumentTemplateSchema,
} from "@/lib/export-validators";
import { replaceTemplateVariables, DEFAULT_TEMPLATE_VARS } from "@/lib/documents/document-templates";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";

export async function listDocumentTemplatesAction() {
  const user = await requireAuth();
  requirePermission(user, "DOCUMENT_TEMPLATES_READ");

  return prisma.documentTemplate.findMany({
    where: { organizationId: user.organizationId },
    orderBy: [{ type: "asc" }, { isDefault: "desc" }, { name: "asc" }],
  });
}

export async function createDocumentTemplateAction(input: Record<string, unknown>) {
  const user = await requireAuth();
  requirePermission(user, "DOCUMENT_TEMPLATES_UPDATE");

  const parsed = createDocumentTemplateSchema.parse(input);

  if (parsed.isDefault) {
    await prisma.documentTemplate.updateMany({
      where: { organizationId: user.organizationId, type: parsed.type as DocumentType },
      data: { isDefault: false },
    });
  }

  const template = await prisma.documentTemplate.create({
    data: {
      organizationId: user.organizationId,
      type: parsed.type as DocumentType,
      name: parsed.name,
      description: parsed.description,
      headerText: parsed.headerText,
      footerText: parsed.footerText,
      primaryColor: parsed.primaryColor,
      showLogo: parsed.showLogo,
      showSandboxBadge: parsed.showSandboxBadge,
      isDefault: parsed.isDefault,
      isActive: parsed.isActive,
    },
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "DOCUMENT_TEMPLATE_CREATED",
    entityType: "DocumentTemplate",
    entityId: template.id,
    entityLabel: template.name,
  });

  revalidatePath("/documents/templates");
  return { success: true as const, template };
}

export async function updateDocumentTemplateAction(id: string, input: Record<string, unknown>) {
  const user = await requireAuth();
  requirePermission(user, "DOCUMENT_TEMPLATES_UPDATE");

  const parsed = updateDocumentTemplateSchema.parse(input);
  const existing = await prisma.documentTemplate.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!existing) throw new Error("Modèle introuvable");

  if (parsed.isDefault) {
    await prisma.documentTemplate.updateMany({
      where: { organizationId: user.organizationId, type: existing.type },
      data: { isDefault: false },
    });
  }

  const { type: typeField, ...rest } = parsed;
  const template = await prisma.documentTemplate.update({
    where: { id },
    data: {
      ...rest,
      ...(typeField ? { type: typeField as DocumentType } : {}),
    },
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "DOCUMENT_TEMPLATE_UPDATED",
    entityType: "DocumentTemplate",
    entityId: template.id,
    entityLabel: template.name,
  });

  revalidatePath("/documents/templates");
  return { success: true as const, template };
}

export async function disableDocumentTemplateAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "DOCUMENT_TEMPLATES_UPDATE");

  const template = await prisma.documentTemplate.update({
    where: { id, organizationId: user.organizationId },
    data: { isActive: false, isDefault: false },
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "DOCUMENT_TEMPLATE_DISABLED",
    entityType: "DocumentTemplate",
    entityId: template.id,
    entityLabel: template.name,
  });

  revalidatePath("/documents/templates");
  return { success: true as const };
}

export async function setDefaultDocumentTemplateAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "DOCUMENT_TEMPLATES_UPDATE");

  const template = await prisma.documentTemplate.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!template) throw new Error("Modèle introuvable");

  await prisma.documentTemplate.updateMany({
    where: { organizationId: user.organizationId, type: template.type },
    data: { isDefault: false },
  });

  await prisma.documentTemplate.update({
    where: { id },
    data: { isDefault: true, isActive: true },
  });

  revalidatePath("/documents/templates");
  return { success: true as const };
}

export async function previewDocumentTemplateAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "DOCUMENT_TEMPLATES_READ");

  const template = await prisma.documentTemplate.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!template) throw new Error("Modèle introuvable");

  return {
    header: replaceTemplateVariables(template.headerText, DEFAULT_TEMPLATE_VARS),
    footer: replaceTemplateVariables(template.footerText, DEFAULT_TEMPLATE_VARS),
    template,
  };
}
