import { DashboardSearchShell } from "@/components/layout/dashboard-search-shell";
import { getCurrentOrganization } from "@/lib/organization";
import { resolveOrganizationDisplayName } from "@/lib/organization-display";
import { requireAuth } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();
  const { organization } = await getCurrentOrganization();
  const organizationDisplayName = resolveOrganizationDisplayName(
    organization.name,
    organization.slug,
  );

  return (
    <DashboardSearchShell user={user} organizationName={organizationDisplayName}>
      {children}
    </DashboardSearchShell>
  );
}
