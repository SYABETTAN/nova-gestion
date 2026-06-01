import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildInvoiceEmail,
  buildPaymentReceiptEmail,
  buildQuoteEmail,
  buildReminderEmail,
  buildTeamInvitationEmail,
} from "@/lib/email/templates";
import { EMAIL_NOT_CONFIGURED_ERROR } from "@/lib/email/config";
import {
  clearMockSentEmails,
  getMockSentEmails,
} from "@/lib/email/providers/mock";
import {
  resetEmailProviderForTests,
  sendEmail,
  setEmailProviderForTests,
} from "@/lib/email/send-email";
import type { SendEmailParams } from "@/lib/email/types";

const FORBIDDEN_WORDS = ["demo", "fake", "sandbox", "simulé", "simule", "fictif"];

function expectNoForbiddenWords(content: string) {
  for (const word of FORBIDDEN_WORDS) {
    expect(content.toLowerCase()).not.toContain(word);
  }
}

describe("email service", () => {
  afterEach(() => {
    resetEmailProviderForTests();
    clearMockSentEmails();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("appelle le provider avec les bons paramètres", async () => {
    const captured: SendEmailParams[] = [];
    setEmailProviderForTests({
      name: "mock",
      async send(params) {
        captured.push(params);
        return { success: true, messageId: "test-1", provider: "mock" };
      },
    });

    await sendEmail({
      to: "client@example.com",
      subject: "Facture FAC-001",
      html: "<p>Bonjour</p>",
      text: "Bonjour",
      replyTo: "reply@example.com",
    });

    expect(captured).toHaveLength(1);
    expect(captured[0]?.to).toBe("client@example.com");
    expect(captured[0]?.subject).toBe("Facture FAC-001");
    expect(captured[0]?.html).toContain("Bonjour");
    expect(captured[0]?.replyTo).toBe("reply@example.com");
  });

  it("en environnement test utilise le provider mock sans envoi réel", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VITEST", "true");
    resetEmailProviderForTests();

    const result = await sendEmail({
      to: "test@example.com",
      subject: "Test",
      html: "<p>Test</p>",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.provider).toBe("mock");
    }
    expect(getMockSentEmails()).toHaveLength(1);
    expect(getMockSentEmails()[0]?.to).toBe("test@example.com");
  });

  it("échoue clairement en production sans provider configuré", async () => {
    vi.doMock("@/lib/env", () => ({
      isProduction: () => true,
    }));

    const { getEmailConfig } = await import("@/lib/email/config");
    vi.stubEnv("EMAIL_FROM", "");
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    vi.stubEnv("RESEND_API_KEY", "");

    expect(() => getEmailConfig()).toThrow(new RegExp(EMAIL_NOT_CONFIGURED_ERROR.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

    vi.doUnmock("@/lib/env");
  });

  it("ne marque pas une facture envoyée si l'email échoue", async () => {
    vi.resetModules();

    vi.doMock("@/lib/email/send-email", () => ({
      sendEmail: vi.fn().mockResolvedValue({ success: false, error: "Échec réseau" }),
    }));

    vi.doMock("@/lib/auth", () => ({
      requireAuth: vi.fn().mockResolvedValue({
        id: "user-1",
        organizationId: "org-1",
      }),
    }));
    vi.doMock("@/lib/permissions", () => ({
      requirePermission: vi.fn(),
    }));

    const invoiceUpdate = vi.fn();
    const activityCreate = vi.fn();

    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        invoice: {
          findFirst: vi.fn().mockResolvedValue({
            id: "inv-1",
            organizationId: "org-1",
            invoiceNumber: "FAC-2025-001",
            title: "Prestation",
            status: "VALIDATED",
            totalIncludingTax: 1200,
            amountDue: 1200,
            dueDate: new Date("2025-06-01"),
            customer: { name: "Client Test" },
            organization: { name: "Org Test" },
            lines: [],
          }),
          update: invoiceUpdate,
        },
        invoiceActivity: { create: activityCreate },
      },
    }));
    vi.doMock("@/lib/audit", () => ({ createAuditLog: vi.fn() }));
    vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }));

    const { sendInvoiceEmailAction } = await import("@/server/actions/invoice-status.actions");
    const formData = new FormData();
    formData.set("recipient", "client@test.fr");
    formData.set("subject", "Facture");
    formData.set("message", "Merci");

    const result = await sendInvoiceEmailAction("inv-1", formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Échec réseau");
    }
    expect(invoiceUpdate).not.toHaveBeenCalled();
    expect(activityCreate).not.toHaveBeenCalled();

    vi.doUnmock("@/lib/email/send-email");
    vi.doUnmock("@/lib/auth");
    vi.doUnmock("@/lib/permissions");
    vi.doUnmock("@/lib/prisma");
    vi.doUnmock("@/lib/audit");
    vi.doUnmock("next/cache");
  });

  it("marque une facture envoyée si l'email réussit", async () => {
    vi.resetModules();

    vi.doMock("@/lib/email/send-email", () => ({
      sendEmail: vi.fn().mockResolvedValue({
        success: true,
        messageId: "ok-1",
        provider: "mock",
      }),
    }));

    vi.doMock("@/lib/auth", () => ({
      requireAuth: vi.fn().mockResolvedValue({
        id: "user-1",
        organizationId: "org-1",
      }),
    }));
    vi.doMock("@/lib/permissions", () => ({
      requirePermission: vi.fn(),
    }));

    const invoiceUpdate = vi.fn().mockResolvedValue({});
    const activityCreate = vi.fn().mockResolvedValue({});

    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        invoice: {
          findFirst: vi.fn().mockResolvedValue({
            id: "inv-1",
            organizationId: "org-1",
            invoiceNumber: "FAC-2025-001",
            title: "Prestation",
            status: "VALIDATED",
            totalIncludingTax: 1200,
            amountDue: 1200,
            dueDate: new Date("2025-06-01"),
            customer: { name: "Client Test" },
            organization: { name: "Org Test" },
            lines: [],
          }),
          update: invoiceUpdate,
        },
        invoiceActivity: { create: activityCreate },
      },
    }));
    vi.doMock("@/lib/audit", () => ({ createAuditLog: vi.fn() }));
    vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }));

    const { sendInvoiceEmailAction } = await import("@/server/actions/invoice-status.actions");
    const formData = new FormData();
    formData.set("recipient", "client@test.fr");
    formData.set("subject", "Facture");
    formData.set("message", "Merci");

    const result = await sendInvoiceEmailAction("inv-1", formData);

    expect(result.success).toBe(true);
    expect(invoiceUpdate).toHaveBeenCalledWith({
      where: { id: "inv-1" },
      data: expect.objectContaining({ status: "SENT", sentAt: expect.any(Date) }),
    });
    expect(activityCreate).toHaveBeenCalled();

    vi.doUnmock("@/lib/auth");
    vi.doUnmock("@/lib/permissions");
    vi.doUnmock("@/lib/prisma");
    vi.doUnmock("@/lib/audit");
    vi.doUnmock("next/cache");
  });

  it("génère une invitation avec token et lien valides", () => {
    const token = "inv-abc-123";
    const inviteUrl = `https://app.example.com/accept-invitation/${token}`;
    const email = buildTeamInvitationEmail({
      organizationName: "Acme SARL",
      inviterName: "Alice Martin",
      inviterEmail: "alice@example.com",
      inviteeEmail: "bob@example.com",
      roleName: "Commercial",
      inviteUrl,
      expiresAt: new Date("2026-12-31"),
    });

    expect(email.subject).toContain("Acme SARL");
    expect(email.html).toContain(token);
    expect(email.html).toContain(inviteUrl);
    expect(email.text).toContain(inviteUrl);
    expectNoForbiddenWords(`${email.subject} ${email.html} ${email.text}`);
  });

  it("les templates ne contiennent pas de texte interdit", () => {
    const samples = [
      buildQuoteEmail({
        organizationName: "Acme",
        recipientName: "Client",
        quoteNumber: "DEV-001",
        totalIncludingTax: 1000,
        documentUrl: "https://app.example.com/quotes/1/print",
      }),
      buildInvoiceEmail({
        organizationName: "Acme",
        recipientName: "Client",
        invoiceNumber: "FAC-001",
        totalIncludingTax: 1000,
        amountDue: 1000,
        documentUrl: "https://app.example.com/invoices/1/print",
      }),
      buildReminderEmail({
        organizationName: "Acme",
        recipientName: "Client",
        invoiceNumber: "FAC-001",
        subject: "Relance paiement",
        message: "Merci de régler votre facture.",
        amountDue: 500,
        dueDate: new Date("2025-05-01"),
        daysOverdue: 10,
      }),
      buildPaymentReceiptEmail({
        organizationName: "Acme",
        recipientName: "Client",
        paymentNumber: "PAY-001",
        amount: 500,
        paidAt: new Date("2025-05-15"),
      }),
      buildTeamInvitationEmail({
        organizationName: "Acme",
        inviterName: "Alice",
        inviterEmail: "alice@example.com",
        inviteeEmail: "bob@example.com",
        roleName: "Admin",
        inviteUrl: "https://app.example.com/accept-invitation/inv-1",
        expiresAt: new Date("2026-12-31"),
      }),
    ];

    for (const sample of samples) {
      expectNoForbiddenWords(`${sample.subject} ${sample.html} ${sample.text}`);
    }
  });
});
