import { describe, expect, it } from "vitest";
import { escapeCsvValue, generateQuotesCsv, QUOTE_CSV_HEADERS } from "@/lib/csv";

describe("quote CSV export", () => {
  it("génère un CSV avec headers", () => {
    const csv = generateQuotesCsv([]);
    expect(csv.split("\n")[0]).toBe(QUOTE_CSV_HEADERS.join(","));
  });

  it("inclut les champs attendus", () => {
    const csv = generateQuotesCsv([
      {
        quoteNumber: "DEV-2026-0001",
        status: "DRAFT",
        title: "Test devis",
        issueDate: new Date("2026-01-15"),
        validUntil: new Date("2026-02-15"),
        currency: "EUR",
        subtotalExcludingTax: 1000,
        totalDiscountAmount: 50,
        totalExcludingTax: 950,
        totalVatAmount: 190,
        totalIncludingTax: 1140,
        createdAt: new Date("2026-01-10"),
        customer: { name: "Client Demo" },
      },
    ]);
    expect(csv).toContain("DEV-2026-0001");
    expect(csv).toContain("Client Demo");
    expect(csv).toContain("1140");
  });

  it("échappe correctement les virgules et guillemets", () => {
    expect(escapeCsvValue('Titre "spécial", avec virgule')).toBe(
      '"Titre ""spécial"", avec virgule"',
    );
  });
});
