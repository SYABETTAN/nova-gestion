import { describe, expect, it } from "vitest";
import {
  safeDivide,
  computePercentageChange,
  getTopByAmount,
  computeOverdueBuckets,
  getOverdueBucket,
  isInvoiceBillable,
  isInvoiceOverdue,
  sumBy,
} from "@/lib/dashboard-calculations";
import { roundMoney } from "@/lib/pricing";

describe("dashboard calculations", () => {
  it("safeDivide retourne 0 si division par zéro", () => {
    expect(safeDivide(10, 0)).toBe(0);
  });

  it("computePercentageChange fonctionne", () => {
    expect(computePercentageChange(120, 100)).toBe(20);
    expect(computePercentageChange(0, 0)).toBe(0);
    expect(computePercentageChange(50, 0)).toBe(100);
  });

  it("roundMoney arrondit à 2 décimales", () => {
    expect(roundMoney(10.556)).toBe(10.56);
  });

  it("CA facturé via sumBy sur factures billables", () => {
    const invoices = [
      { totalExcludingTax: 1000, status: "VALIDATED" },
      { totalExcludingTax: 500, status: "DRAFT" },
      { totalExcludingTax: 200, status: "CANCELLED" },
    ];
    const ca = sumBy(
      invoices.filter((i) => isInvoiceBillable(i.status)),
      (i) => i.totalExcludingTax,
    );
    expect(ca).toBe(1000);
  });

  it("montant à encaisser somme amountDue", () => {
    const invoices = [{ amountDue: 300 }, { amountDue: 150 }, { amountDue: 0 }];
    expect(sumBy(invoices, (i) => i.amountDue)).toBe(450);
  });

  it("montant en retard via isInvoiceOverdue", () => {
    const past = new Date();
    past.setDate(past.getDate() - 10);
    const invoices = [
      { dueDate: past, amountDue: 100, status: "SENT" },
      { dueDate: past, amountDue: 0, status: "SENT" },
    ];
    const overdue = invoices.filter((i) =>
      isInvoiceOverdue(i.dueDate, i.amountDue, i.status),
    );
    expect(overdue).toHaveLength(1);
    expect(sumBy(overdue, (i) => i.amountDue)).toBe(100);
  });

  it("taux d'acceptation devis", () => {
    const accepted = 3;
    const sent = 5;
    expect(safeDivide(accepted, sent) * 100).toBe(60);
  });

  it("overdue buckets", () => {
    expect(getOverdueBucket(5)).toBe("1-7");
    expect(getOverdueBucket(15)).toBe("8-30");
    expect(getOverdueBucket(45)).toBe("31-60");
    expect(getOverdueBucket(90)).toBe("60+");
    const buckets = computeOverdueBuckets([
      { daysOverdue: 3, amountDue: 100 },
      { daysOverdue: 20, amountDue: 200 },
    ]);
    expect(buckets.find((b) => b.bucket === "1-7")?.amount).toBe(100);
    expect(buckets.find((b) => b.bucket === "8-30")?.amount).toBe(200);
  });

  it("top clients triés et limités", () => {
    const top = getTopByAmount(
      [
        { id: "1", name: "A", amount: 100 },
        { id: "2", name: "B", amount: 500 },
        { id: "3", name: "C", amount: 300 },
        { id: "4", name: "D", amount: 400 },
        { id: "5", name: "E", amount: 600 },
        { id: "6", name: "F", amount: 50 },
      ],
      5,
    );
    expect(top).toHaveLength(5);
    expect(top[0].name).toBe("E");
  });
});
