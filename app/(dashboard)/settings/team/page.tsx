import { TeamPageClient } from "@/components/team/team-page-client";
import { requireAuth } from "@/lib/auth";
import { getTeamMembersAction } from "@/server/actions/member.actions";

export default async function TeamPage() {
  const user = await requireAuth();
  const { members, invitations } = await getTeamMembersAction();

  return <TeamPageClient user={user} members={members} invitations={invitations} />;
}
