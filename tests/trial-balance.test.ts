import { describe, expect, it } from "vitest";
import { computeTrialBalanceTotals } from "@/lib/trial-balance";

describe("trial balance", () => {
  const rows = [
    {
      accountId: "1",
      accountNumber: "411000",
      accountName: "Clients",
      accountType: "CUSTOMER",
      totalDebit: 1000,
      totalCredit: 200,
      debitBalance: 800,
      creditBalance: 0,
    },
    {
      accountId: "2",
      accountNumber: "401000",
      accountName: "Fournisseurs",
      accountType: "SUPPLIER",
      totalDebit: 0,
      totalCredit: 500,
      debitBalance: 0,
      creditBalance: 500,
    },
  ];

  it("calcule total débit et crédit", () => {
    const totals = computeTrialBalanceTotals(rows);
    expect(totals.totalDebit).toBe(1000);
    expect(totals.totalCredit).toBe(700);
  });

  it("calcule soldes débiteur et créditeur", () => {
    const totals = computeTrialBalanceTotals(rows);
    expect(totals.totalDebitBalance).toBe(800);
    expect(totals.totalCreditBalance).toBe(500);
  });
});
