import { describe, expect, it } from "vitest";
import { generateJsonExport, sanitizeExportData } from "@/lib/export/json";

describe("json export", () => {
  it("generateJsonExport inclut les métadonnées d'environnement", () => {
    const json = generateJsonExport(
      {
        organizationName: "Joey & Joey",
        generatedAt: "2025-05-29T10:00:00.000Z",
        environment: "development",
        exportType: "CUSTOMERS",
        rowCount: 2,
      },
      [{ id: "1", name: "Client A" }],
    );
    const parsed = JSON.parse(json);
    expect(parsed.metadata.environment).toBe("development");
    expect(parsed.metadata.rowCount).toBe(2);
    expect(parsed.data).toHaveLength(1);
  });

  it("sanitizeExportData masque iban", () => {
    const result = sanitizeExportData({ iban: "FR7612345678901234567890123" });
    expect(result).not.toHaveProperty("iban");
  });

  it("rowCount est correct dans metadata", () => {
    const json = generateJsonExport(
      {
        organizationName: "Test",
        generatedAt: new Date().toISOString(),
        environment: "test",
        exportType: "INVOICES",
        rowCount: 5,
      },
      [],
    );
    expect(JSON.parse(json).metadata.rowCount).toBe(5);
  });
});
