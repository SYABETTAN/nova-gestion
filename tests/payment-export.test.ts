import { describe, expect, it } from "vitest";
import { PAYMENT_CSV_HEADERS, escapeCsvValue, generatePaymentsCsv } from "@/lib/csv";

describe("payment CSV export", () => {
  it("génère un CSV avec headers", () => {
    const csv = generatePaymentsCsv([]);
    expect(csv.split("\n")[0]).toBe(PAYMENT_CSV_HEADERS.join(","));
  });

  it("inclut les champs attendus", () => {
    const csv = generatePaymentsCsv([
      {
        paymentNumber: "REG-2026-0001",
        status: "CONFIRMED",
        method: "BANK_TRANSFER",
        paymentDate: new Date("2026-01-15"),
        amount: 1200,
        allocatedAmount: 1200,
        unallocatedAmount: 0,
        currency: "EUR",
        reference: "VIR-001",
        bankReference: "BNK-001",
        checkNumber: null,
        cardLast4: null,
        createdAt: new Date("2026-01-15"),
        customer: { name: "Client Demo" },
      },
    ]);
    expect(csv).toContain("REG-2026-0001");
    expect(csv).toContain("Client Demo");
    expect(csv).toContain("1200");
  });

  it("échappe correctement les virgules et guillemets", () => {
    expect(escapeCsvValue('Client "Alpha", SAS')).toBe('"Client ""Alpha"", SAS"');
  });
});
