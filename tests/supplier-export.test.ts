import { describe, expect, it } from "vitest";
import { SUPPLIER_CSV_HEADERS, escapeCsvValue, generateSuppliersCsv } from "@/lib/csv";

describe("supplier CSV export", () => {
  it("Génère un CSV avec headers", () => {
    expect(generateSuppliersCsv([]).split("\n")[0]).toBe(SUPPLIER_CSV_HEADERS.join(","));
  });

  it("Échappe correctement les virgules", () => {
    expect(escapeCsvValue("Fournisseur, SAS")).toBe('"Fournisseur, SAS"');
  });
});
