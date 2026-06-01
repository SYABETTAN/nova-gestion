import { describe, expect, it } from "vitest";
import { expectMoney } from "@/lib/money";
import {
  buildCustomerInvoiceEntry,
  buildCustomerPaymentEntry,
  buildSupplierInvoiceEntry,
} from "@/lib/accounting-generators";

const map = new Map<string, string>([
  ["411000", "acc-411"],
  ["706000", "acc-706"],
  ["445710", "acc-445710"],
  ["512000", "acc-512"],
  ["530000", "acc-530"],
  ["401000", "acc-401"],
  ["445660", "acc-445660"],
  ["611000", "acc-611"],
]);

describe("accounting generators", () => {
  it("génère une écriture facture client équilibrée", () => {
    const data = buildCustomerInvoiceEntry(map, {
      id: "inv-1",
      invoiceNumber: "FAC-2026-0001",
      issueDate: new Date("2026-01-15"),
      totalExcludingTax: 1000,
      totalVatAmount: 200,
      totalIncludingTax: 1200,
      customer: { id: "cust-1", name: "Client Demo" },
      lines: [{ lineType: "SERVICE", itemId: null }],
    });
    const debit = data.lines.reduce((s, l) => s + expectMoney(l.debit), 0);
    const credit = data.lines.reduce((s, l) => s + expectMoney(l.credit), 0);
    expect(debit).toBe(1200);
    expect(credit).toBe(1200);
    expect(data.lines.find((l) => expectMoney(l.debit) === 1200)?.accountId).toBe("acc-411");
  });

  it("génère une écriture paiement banque", () => {
    const data = buildCustomerPaymentEntry(map, {
      id: "pay-1",
      paymentNumber: "REG-2026-0001",
      paymentDate: new Date("2026-01-20"),
      amount: 500,
      method: "BANK_TRANSFER",
      customer: { id: "cust-1", name: "Client Demo" },
    });
    expect(data.lines[0]?.accountId).toBe("acc-512");
    expect(data.lines[1]?.accountId).toBe("acc-411");
  });

  it("génère une écriture paiement caisse", () => {
    const data = buildCustomerPaymentEntry(map, {
      id: "pay-2",
      paymentNumber: "REG-2026-0002",
      paymentDate: new Date("2026-01-21"),
      amount: 100,
      method: "CASH",
      customer: { id: "cust-1", name: "Client Demo" },
    });
    expect(data.lines[0]?.accountId).toBe("acc-530");
  });

  it("génère une écriture facture fournisseur équilibrée", () => {
    const data = buildSupplierInvoiceEntry(map, {
      id: "si-1",
      supplierInvoiceNumber: "ACH-2026-0001",
      issueDate: new Date("2026-01-10"),
      totalExcludingTax: 800,
      totalVatAmount: 160,
      totalIncludingTax: 960,
      supplier: { id: "sup-1", name: "Fournisseur Demo" },
      expenseCategory: { name: "Sous-traitance", accountingAccountPlaceholder: "611000" },
    });
    const debit = data.lines.reduce((s, l) => s + expectMoney(l.debit), 0);
    const credit = data.lines.reduce((s, l) => s + expectMoney(l.credit), 0);
    expect(debit).toBe(960);
    expect(credit).toBe(960);
    expect(data.lines[0]?.accountId).toBe("acc-611");
    expect(data.lines[2]?.accountId).toBe("acc-401");
  });
});
