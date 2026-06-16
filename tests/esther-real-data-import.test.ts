import { describe, expect, it } from "vitest";
import {
  ESTHER_REAL_CUSTOMERS,
  ESTHER_REAL_PRODUCTS,
  ESTHER_REAL_SUPPLIERS,
  buildMsiProductCatalog,
} from "@/lib/esther-real-data/catalog";
import {
  buildImportNotes,
  customerNumberFromSeed,
  itemNumberFromSku,
  resolveEstherDataDir,
  supplierInvoiceNumberFromSeed,
  supplierNumberFromSeed,
} from "@/lib/esther-real-data/import";

describe("esther real data catalog", () => {
  it("contient les clients TALIDRESS, ZACKO et SIMHA EMOI", () => {
    const keys = ESTHER_REAL_CUSTOMERS.map((c) => c.importKey);
    expect(keys).toContain("customer-talidress-levalois");
    expect(keys).toContain("customer-zacko-romy");
    expect(keys).toContain("customer-simha-emoi");
  });

  it("contient le fournisseur MSI", () => {
    expect(ESTHER_REAL_SUPPLIERS.some((s) => s.importKey === "supplier-msi")).toBe(true);
  });

  it("n'a pas de SKU produit en doublon", () => {
    const skus = ESTHER_REAL_PRODUCTS.map((p) => p.sku);
    expect(new Set(skus).size).toBe(skus.length);
  });

  it("importe les références MSI connues sans doublon", () => {
    const msi = buildMsiProductCatalog();
    expect(msi.some((p) => p.sku === "L25RINA")).toBe(true);
    expect(msi.some((p) => p.sku === "L25MAYAP")).toBe(true);
    expect(msi.length).toBeGreaterThanOrEqual(35);
  });

  it("n'utilise pas de libellés fake data", () => {
    const blob = JSON.stringify({ ESTHER_REAL_CUSTOMERS, ESTHER_REAL_SUPPLIERS, ESTHER_REAL_PRODUCTS });
    expect(blob.toLowerCase()).not.toContain("fictif");
    expect(blob.toLowerCase()).not.toContain("demo customer");
    expect(blob).not.toContain("Atelier Lumière");
  });
});

describe("esther real data idempotency keys", () => {
  it("génère un numéro client stable depuis le SIREN", () => {
    const talidress = ESTHER_REAL_CUSTOMERS.find((c) => c.importKey === "customer-talidress-levalois")!;
    expect(customerNumberFromSeed(talidress)).toBe("ESTHER-930535372");
  });

  it("génère un numéro fournisseur stable depuis la TVA", () => {
    const msi = ESTHER_REAL_SUPPLIERS.find((s) => s.importKey === "supplier-msi")!;
    expect(supplierNumberFromSeed(msi)).toBe("ESTHER-43533963153");
  });

  it("génère un numéro article depuis la référence", () => {
    expect(itemNumberFromSku("JPE26")).toBe("ART-JPE26");
  });

  it("génère un numéro facture fournisseur stable", () => {
    expect(supplierInvoiceNumberFromSeed({
      importKey: "x",
      supplierImportKey: "supplier-msi",
      supplierReference: "FA37374",
      title: "t",
      issueDate: "2025-08-26",
      receivedDate: "2025-08-26",
      dueDate: "2025-08-26",
      totalExcludingTax: 1,
      totalVatAmount: 0.2,
      totalIncludingTax: 1.2,
      lines: [],
    })).toBe("ESTHER-FA37374");
  });

  it("assemble les notes d'import avec metadata", () => {
    const notes = buildImportNotes({
      notes: "Test",
      sourceDocument: "kbis.pdf",
      metadata: { siren: "123" },
    });
    expect(notes).toContain("Test");
    expect(notes).toContain("kbis.pdf");
    expect(notes).toContain('"siren":"123"');
  });

  it("résout le répertoire data par défaut", () => {
    const dir = resolveEstherDataDir();
    expect(dir.endsWith("data/esther-real")).toBe(true);
  });
});
