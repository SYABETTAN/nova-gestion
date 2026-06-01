import { describe, expect, it } from "vitest";
import {
  generateAccountingEntriesCsv,
  generateGeneralLedgerCsv,
  generateTrialBalanceCsv,
  ACCOUNTING_ENTRIES_CSV_HEADERS,
} from "@/lib/csv";

describe("accounting CSV export", () => {
  it("génère un CSV écritures avec headers", () => {
    const csv = generateAccountingEntriesCsv([]);
    expect(csv.split("\n")[0]).toBe(ACCOUNTING_ENTRIES_CSV_HEADERS.join(","));
  });

  it("échappe les virgules", () => {
    const csv = generateAccountingEntriesCsv([
      {
        entryNumber: "ECR-2026-00001",
        entryDate: new Date("2026-01-01"),
        status: "VALIDATED",
        sourceType: "MANUAL",
        sourceLabel: null,
        label: "OD, test",
        totalDebit: 100,
        totalCredit: 100,
        isBalanced: true,
        createdAt: new Date("2026-01-01"),
        journal: { code: "OD" },
      },
    ]);
    expect(csv).toContain('"OD, test"');
  });

  it("exporte le grand livre", () => {
    const csv = generateGeneralLedgerCsv([
      {
        entryDate: new Date("2026-01-01"),
        journalCode: "VE",
        entryNumber: "ECR-1",
        accountNumber: "411000",
        accountName: "Clients",
        label: "Facture",
        debit: 120,
        credit: 0,
        runningBalance: 120,
      },
    ]);
    expect(csv).toContain("411000");
    expect(csv).toContain("120");
  });

  it("exporte la balance", () => {
    const csv = generateTrialBalanceCsv([
      {
        accountNumber: "411000",
        accountName: "Clients",
        totalDebit: 1000,
        totalCredit: 200,
        debitBalance: 800,
        creditBalance: 0,
      },
    ]);
    expect(csv).toContain("411000");
  });
});
