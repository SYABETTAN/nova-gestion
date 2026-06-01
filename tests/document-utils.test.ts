import { describe, expect, it } from "vitest";
import {
  formatFileSize,
  getDocumentTypeLabel,
  getDocumentStatusLabel,
  getMimeTypeLabel,
} from "@/lib/documents/document-utils";

describe("document utils", () => {
  it("formatFileSize fonctionne", () => {
    expect(formatFileSize(500)).toBe("500 o");
    expect(formatFileSize(2048)).toContain("Ko");
  });

  it("getDocumentTypeLabel retourne le bon label", () => {
    expect(getDocumentTypeLabel("INVOICE")).toBe("Facture client");
  });

  it("getDocumentStatusLabel retourne le bon label", () => {
    expect(getDocumentStatusLabel("GENERATED")).toBe("Généré");
  });

  it("getMimeTypeLabel retourne le bon label", () => {
    expect(getMimeTypeLabel("application/pdf")).toBe("PDF");
  });
});
