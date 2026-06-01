import type { EmailProvider } from "@/lib/email/provider";
import type { SendEmailParams, SendEmailResult } from "@/lib/email/types";

export type MockSentEmail = SendEmailParams & { messageId: string; sentAt: Date };

const sentEmails: MockSentEmail[] = [];

export function getMockSentEmails(): readonly MockSentEmail[] {
  return sentEmails;
}

export function clearMockSentEmails(): void {
  sentEmails.length = 0;
}

export function createMockEmailProvider(): EmailProvider {
  return {
    name: "mock",
    async send(params: SendEmailParams): Promise<SendEmailResult> {
      const messageId = `mock-${sentEmails.length + 1}-${Date.now()}`;
      sentEmails.push({ ...params, messageId, sentAt: new Date() });
      return { success: true, messageId, provider: "mock" };
    },
  };
}

export function createFailingMockEmailProvider(error = "Échec d'envoi simulé"): EmailProvider {
  return {
    name: "mock",
    async send(): Promise<SendEmailResult> {
      return { success: false, error };
    },
  };
}
