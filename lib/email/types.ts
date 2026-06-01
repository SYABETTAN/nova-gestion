export type EmailProviderName = "resend" | "log" | "mock";

export type EmailAttachment = {
  filename: string;
  content: Buffer;
};

export type SendEmailParams = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  tags?: { name: string; value: string }[];
  attachments?: EmailAttachment[];
};

export type SendEmailResult =
  | { success: true; messageId: string; provider: EmailProviderName }
  | { success: false; error: string };

export type EmailConfig = {
  provider: EmailProviderName;
  from: string;
  replyTo?: string;
  resendApiKey?: string;
};
