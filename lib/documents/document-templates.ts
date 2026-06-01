import type { DocumentTemplate, DocumentType } from "@prisma/client";

export function resolveDefaultTemplate(
  templates: DocumentTemplate[],
  type: DocumentType,
): DocumentTemplate | null {
  const active = templates.filter((t) => t.isActive && t.type === type);
  return active.find((t) => t.isDefault) ?? active[0] ?? null;
}

export function replaceTemplateVariables(
  text: string | null | undefined,
  vars: Record<string, string>,
): string {
  if (!text) return "";
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

export const DEFAULT_TEMPLATE_VARS: Record<string, string> = {
  organizationName: "Nova Gestion",
  documentNumber: "DOC-0001",
  customerName: "Client démo",
  supplierName: "Fournisseur démo",
  documentDate: new Date().toLocaleDateString("fr-FR"),
  totalAmount: "1 250,00 €",
};
