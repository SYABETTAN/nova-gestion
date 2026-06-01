import { describe, expect, it } from "vitest";
import { escapeCsvValue, generateDashboardKpisCsv } from "@/lib/csv";

describe("dashboard CSV export", () => {
  it("génère un CSV avec headers", () => {
    const csv = generateDashboardKpisCsv([
      {
        section: "Vue d'ensemble",
        metricKey: "revenue",
        metricLabel: "CA facturé",
        value: 1250.5,
        currency: "EUR",
        periodStart: "2025-05-01",
        periodEnd: "2025-05-31",
        generatedAt: "2025-05-29T10:00:00.000Z",
      },
    ]);
    expect(csv.split("\n")[0]).toContain("section");
    expect(csv.split("\n")[0]).toContain("metricKey");
    expect(csv).toContain("CA facturé");
  });

  it("échappe correctement les virgules et guillemets", () => {
    expect(escapeCsvValue('Label, avec "guillemets"')).toBe('"Label, avec ""guillemets"""');
  });
});
