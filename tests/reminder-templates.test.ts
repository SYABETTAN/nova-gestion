import { describe, expect, it } from "vitest";
import { renderReminderTemplate, buildTemplateVariables } from "@/lib/reminder-templates";

describe("template rendering", () => {
  const vars = buildTemplateVariables({
    customerName: "Acme Corp",
    invoiceNumber: "FAC-2026-0042",
    dueDate: new Date("2026-01-15"),
    amountDue: 1250,
    daysOverdue: 15,
    organizationName: "Joey & Joey",
    includePaymentLink: true,
  });

  it("Remplace {{customerName}}", () => {
    expect(renderReminderTemplate("Bonjour {{customerName}}", vars)).toContain("Acme Corp");
  });

  it("Remplace {{invoiceNumber}}", () => {
    expect(renderReminderTemplate("Facture {{invoiceNumber}}", vars)).toContain("FAC-2026-0042");
  });

  it("Remplace {{daysOverdue}}", () => {
    expect(renderReminderTemplate("Retard {{daysOverdue}} j", vars)).toContain("15");
  });

  it("Remplace {{organizationName}}", () => {
    expect(renderReminderTemplate("{{organizationName}}", vars)).toContain("Joey & Joey");
  });

  it("Remplace {{paymentLink}}", () => {
    expect(renderReminderTemplate("{{paymentLink}}", vars)).toContain("pay.example.com");
  });
});
