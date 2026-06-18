import { APP_DISPLAY_NAME } from "@/lib/branding";
import { formatDate, renderEmailLayout } from "@/lib/email/templates/layout";

export type TeamInvitationEmailTemplateParams = {
  organizationName: string;
  inviterName: string;
  inviterEmail: string;
  inviteeEmail: string;
  roleName: string;
  inviteUrl: string;
  expiresAt: Date;
};

export function buildTeamInvitationEmail(params: TeamInvitationEmailTemplateParams) {
  const subject = `Invitation à rejoindre ${params.organizationName}`;

  const bodyHtml = [
    `<p>Bonjour,</p>`,
    `<p><strong>${params.inviterName}</strong> (${params.inviterEmail}) vous invite à rejoindre l'équipe <strong>${params.organizationName}</strong> sur ${APP_DISPLAY_NAME}.</p>`,
    `<p>Rôle proposé : <strong>${params.roleName}</strong>.</p>`,
    `<p>Validité de l'invitation : jusqu'au ${formatDate(params.expiresAt)}.</p>`,
    `<p><a href="${params.inviteUrl}" style="display:inline-block;padding:10px 16px;background:#0f172a;color:#fff;text-decoration:none;border-radius:6px;">Accepter l'invitation</a></p>`,
    `<p style="font-size:13px;color:#64748b;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br />${params.inviteUrl}</p>`,
    `<p style="font-size:13px;color:#64748b;">Cette invitation est personnelle et destinée à ${params.inviteeEmail}. Ne la transférez pas.</p>`,
  ].join("\n");

  const { html, text } = renderEmailLayout({
    organizationName: params.organizationName,
    title: "Invitation équipe",
    bodyHtml,
  });

  return { subject, html, text };
}
