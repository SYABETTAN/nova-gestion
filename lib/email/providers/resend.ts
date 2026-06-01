import { Resend } from "resend";

import { captureError } from "@/lib/observability/capture-error";
import type { EmailConfig } from "@/lib/email/types";
import type { EmailProvider } from "@/lib/email/provider";
import type { SendEmailParams, SendEmailResult } from "@/lib/email/types";

export function createResendEmailProvider(config: EmailConfig): EmailProvider {
  if (!config.resendApiKey) {
    throw new Error("RESEND_API_KEY est requis pour le provider Resend.");
  }

  const client = new Resend(config.resendApiKey);

  return {
    name: "resend",
    async send(params: SendEmailParams): Promise<SendEmailResult> {
      try {
        const { data, error } = await client.emails.send({
          from: config.from,
          to: params.to,
          subject: params.subject,
          html: params.html,
          text: params.text,
          replyTo: params.replyTo ?? config.replyTo,
          tags: params.tags,
          attachments: params.attachments?.map((a) => ({
            filename: a.filename,
            content: a.content,
          })),
        });

        if (error) {
          captureError(new Error(error.message || "Resend error"), { area: "email" });
          return {
            success: false,
            error: error.message || "L'envoi de l'email a échoué.",
          };
        }

        return {
          success: true,
          messageId: data?.id ?? `resend-${Date.now()}`,
          provider: "resend",
        };
      } catch (err) {
        captureError(err, { area: "email" });
        return {
          success: false,
          error: err instanceof Error ? err.message : "L'envoi de l'email a échoué.",
        };
      }
    },
  };
}
