import type { EmailProvider } from "@/lib/email/provider";
import type { SendEmailParams, SendEmailResult } from "@/lib/email/types";

export function createLogEmailProvider(): EmailProvider {
  return {
    name: "log",
    async send(params: SendEmailParams): Promise<SendEmailResult> {
      const to = Array.isArray(params.to) ? params.to.join(", ") : params.to;
      console.info("[email:log]", {
        to,
        subject: params.subject,
        replyTo: params.replyTo,
        textPreview: params.text?.slice(0, 200),
        htmlLength: params.html.length,
        tags: params.tags,
      });
      return {
        success: true,
        messageId: `log-${Date.now()}`,
        provider: "log",
      };
    },
  };
}
