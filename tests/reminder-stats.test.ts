import { describe, expect, it } from "vitest";
import { computeReminderStats } from "@/lib/reminder-utils";

describe("reminder stats", () => {
  it("Calcule le nombre de factures à relancer", () => {
    const stats = computeReminderStats(
      [
        { id: "1", invoiceNumber: "F1", issueDate: new Date(), dueDate: new Date(), totalIncludingTax: 1000, amountPaid: 0, amountDue: 500, currency: "EUR", paymentStatus: "OVERDUE", status: "OVERDUE", reminderStatus: "TO_REMIND", lastReminderAt: null, lastReminderLevel: null, reminderCount: 0, isCollectionPaused: false, isDisputed: false, promisedPaymentDate: null, daysOverdue: 10, customer: { id: "c1", name: "A", email: null } },
        { id: "2", invoiceNumber: "F2", issueDate: new Date(), dueDate: new Date(), totalIncludingTax: 800, amountPaid: 0, amountDue: 300, currency: "EUR", paymentStatus: "OVERDUE", status: "OVERDUE", reminderStatus: "TO_REMIND", lastReminderAt: null, lastReminderLevel: null, reminderCount: 0, isCollectionPaused: true, isDisputed: false, promisedPaymentDate: null, daysOverdue: 5, customer: { id: "c2", name: "B", email: null } },
      ],
      3,
    );
    expect(stats.toRemindCount).toBe(1);
    expect(stats.totalOverdue).toBe(500);
    expect(stats.remindersThisMonth).toBe(3);
  });
});
