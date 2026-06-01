import { describe, expect, it } from "vitest";
import {
  resolveDefaultTemplate,
  replaceTemplateVariables,
} from "@/lib/documents/document-templates";
import type { DocumentTemplate } from "@prisma/client";

const base = (overrides: Partial<DocumentTemplate>): DocumentTemplate =>
  ({
    id: "1",
    organizationId: "org",
    type: "INVOICE",
    name: "Test",
    description: null,
    headerText: "{{organizationName}}",
    footerText: null,
    primaryColor: "#2563eb",
    showLogo: true,
    showSandboxBadge: true,
    isDefault: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as DocumentTemplate;

describe("document templates", () => {
  it("résout le template par défaut", () => {
    const templates = [
      base({ id: "1", isDefault: false, isActive: true }),
      base({ id: "2", isDefault: true, isActive: true }),
    ];
    expect(resolveDefaultTemplate(templates, "INVOICE")?.id).toBe("2");
  });

  it("un template inactif n'est pas sélectionné par défaut", () => {
    const templates = [base({ id: "1", isDefault: true, isActive: false })];
    expect(resolveDefaultTemplate(templates, "INVOICE")).toBeNull();
  });

  it("remplace les variables simples", () => {
    expect(
      replaceTemplateVariables("Bonjour {{customerName}}", { customerName: "ACME" }),
    ).toBe("Bonjour ACME");
  });
});
