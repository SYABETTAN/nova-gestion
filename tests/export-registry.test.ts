import { describe, expect, it } from "vitest";
import { getExportDefinition, listAvailableExports } from "@/lib/export/export-registry";

describe("export registry", () => {
  it("chaque type connu retourne une définition", () => {
    const exports = listAvailableExports();
    expect(exports.length).toBeGreaterThan(10);
    for (const def of exports) {
      expect(getExportDefinition(def.type).label).toBe(def.label);
    }
  });

  it("un type inconnu retourne une erreur contrôlée", () => {
    expect(() => getExportDefinition("UNKNOWN" as never)).toThrow("Type d'export inconnu");
  });

  it("les headers CSV existent pour customers via définition", () => {
    const def = getExportDefinition("CUSTOMERS");
    expect(def.formats).toContain("CSV");
    expect(def.permission).toBe("CUSTOMERS_READ");
  });
});
