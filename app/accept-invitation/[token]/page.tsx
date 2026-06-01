import { AcceptInvitationClient } from "@/components/team/accept-invitation-client";
import { getInvitationPreviewAction } from "@/server/actions/invitation.actions";

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function AcceptInvitationPage({ params }: PageProps) {
  const { token } = await params;
  const preview = await getInvitationPreviewAction(token);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <AcceptInvitationClient token={token} preview={preview} />
    </div>
  );
}
