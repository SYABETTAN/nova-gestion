import { describe, expect, it } from "vitest";
import { formatExportFileName } from "@/lib/export/export-formatters";

describe("export file names", () => {
  const date = new Date("2025-05-29T12:00:00.000Z");

  it("génère un nom stable avec type et extension", () => {
    expect(formatExportFileName("CUSTOMERS", "CSV", date)).toBe("export-customers-2025-05-29.csv");
  });

  it("le nom contient type, date et extension json", () => {
    expect(formatExportFileName("INVOICES", "JSON", date)).toBe("export-invoices-2025-05-29.json");
  });
});
