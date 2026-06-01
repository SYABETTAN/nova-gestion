import { DashboardSearchShell } from "@/components/layout/dashboard-search-shell";
import { getCurrentOrganization } from "@/lib/organization";
import { requireAuth } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();
  const { organization } = await getCurrentOrganization();

  return (
    <DashboardSearchShell user={user} organizationName={organization.name}>
      {children}
    </DashboardSearchShell>
  );
}
