import { describe, expect, it } from "vitest";
import { buildDashboardAlerts } from "@/lib/dashboard-alerts";

const emptyInput = {
  overdueInvoices: [],
  customersHighOutstanding: [],
  expiringQuotes: [],
  dueSoonSupplierInvoices: [],
  negativeMarginItems: [],
  unbalancedEntries: [],
  netVat: 0,
  disputedInvoices: [],
  unallocatedPayments: [],
};

describe("dashboard alerts", () => {
  it("génère une alerte facture en retard", () => {
    const alerts = buildDashboardAlerts({
      ...emptyInput,
      overdueInvoices: [
        { id: "inv-1", invoiceNumber: "FAC-001", daysOverdue: 15, amountDue: 1200 },
      ],
    });
    expect(alerts.some((a) => a.type === "OVERDUE_INVOICE")).toBe(true);
  });

  it("génère une alerte paiement non alloué", () => {
    const alerts = buildDashboardAlerts({
      ...emptyInput,
      unallocatedPayments: [
        { id: "pay-1", paymentNumber: "PAY-001", unallocatedAmount: 250 },
      ],
    });
    expect(alerts.some((a) => a.type === "PAYMENT_UNALLOCATED")).toBe(true);
  });

  it("génère une alerte écriture non équilibrée", () => {
    const alerts = buildDashboardAlerts({
      ...emptyInput,
      unbalancedEntries: [{ id: "e-1", entryNumber: "EC-001" }],
    });
    expect(alerts.some((a) => a.type === "ACCOUNTING_UNBALANCED_ENTRY")).toBe(true);
  });

  it("génère une alerte devis expirant bientôt", () => {
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 3);
    const alerts = buildDashboardAlerts({
      ...emptyInput,
      expiringQuotes: [{ id: "q-1", quoteNumber: "DEV-001", validUntil }],
    });
    expect(alerts.some((a) => a.type === "QUOTE_EXPIRING_SOON")).toBe(true);
  });

  it("ne génère pas d'alerte retard si liste vide", () => {
    const alerts = buildDashboardAlerts(emptyInput);
    expect(alerts.filter((a) => a.type === "OVERDUE_INVOICE")).toHaveLength(0);
  });
});
