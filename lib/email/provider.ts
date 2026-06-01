import type { EmailProviderName, SendEmailParams, SendEmailResult } from "@/lib/email/types";

export interface EmailProvider {
  name: EmailProviderName;
  send(params: SendEmailParams): Promise<SendEmailResult>;
}
