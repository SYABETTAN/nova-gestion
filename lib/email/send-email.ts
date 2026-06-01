import { getEmailConfig } from "@/lib/email/config";
import type { EmailProvider } from "@/lib/email/provider";
import type { SendEmailParams } from "@/lib/email/types";
import { createLogEmailProvider } from "@/lib/email/providers/log";
import { createMockEmailProvider } from "@/lib/email/providers/mock";
import { createResendEmailProvider } from "@/lib/email/providers/resend";

let overrideProvider: EmailProvider | null = null;

export function setEmailProviderForTests(provider: EmailProvider | null): void {
  overrideProvider = provider;
}

export function resetEmailProviderForTests(): void {
  overrideProvider = null;
}

export function createEmailProvider(): EmailProvider {
  const config = getEmailConfig();

  switch (config.provider) {
    case "mock":
      return createMockEmailProvider();
    case "log":
      return createLogEmailProvider();
    case "resend":
      return createResendEmailProvider(config);
    default:
      throw new Error(`Provider email inconnu : ${config.provider}`);
  }
}

function getProvider(): EmailProvider {
  return overrideProvider ?? createEmailProvider();
}

export async function sendEmail(params: SendEmailParams) {
  const provider = getProvider();
  const config = getEmailConfig();
  const replyTo = params.replyTo ?? config.replyTo;

  return provider.send({
    ...params,
    replyTo,
  });
}

export { getEmailConfig, isEmailConfigured } from "@/lib/email/config";
