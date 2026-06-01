import { describe, expect, it } from "vitest";
import {
  calculateAccountingEntryTotals,
  canValidateEntryTotals,
  normalizeEntryLine,
} from "@/lib/accounting-calculations";
import { isAccountingEntryEditable } from "@/lib/accounting-utils";

describe("accounting entry validation", () => {
  it("calcule totalDebit et totalCredit correctement", () => {
    const totals = calculateAccountingEntryTotals([
      { accountId: "a1", lineNumber: 0, label: "Débit", debit: 120, credit: 0 },
      { accountId: "a2", lineNumber: 1, label: "Crédit HT", debit: 0, credit: 100 },
      { accountId: "a3", lineNumber: 2, label: "Crédit TVA", debit: 0, credit: 20 },
    ]);
    expect(totals.totalDebit).toBe(120);
    expect(totals.totalCredit).toBe(120);
    expect(totals.isBalanced).toBe(true);
  });

  it("une écriture équilibrée est valide", () => {
    const totals = calculateAccountingEntryTotals([
      { accountId: "a1", lineNumber: 0, label: "L1", debit: 50, credit: 0 },
      { accountId: "a2", lineNumber: 1, label: "L2", debit: 0, credit: 50 },
    ]);
    expect(canValidateEntryTotals(totals)).toBe(true);
  });

  it("une écriture non équilibrée ne peut pas être validée", () => {
    const totals = calculateAccountingEntryTotals([
      { accountId: "a1", lineNumber: 0, label: "L1", debit: 50, credit: 0 },
      { accountId: "a2", lineNumber: 1, label: "L2", debit: 0, credit: 40 },
    ]);
    expect(canValidateEntryTotals(totals)).toBe(false);
  });

  it("une ligne ne peut pas avoir débit et crédit simultanément", () => {
    expect(() =>
      normalizeEntryLine({
        accountId: "a1",
        lineNumber: 0,
        label: "L1",
        debit: 10,
        credit: 10,
      }),
    ).toThrow();
  });

  it("DRAFT est modifiable", () => {
    expect(isAccountingEntryEditable("DRAFT")).toBe(true);
  });

  it("VALIDATED n'est pas modifiable", () => {
    expect(isAccountingEntryEditable("VALIDATED")).toBe(false);
  });
});
