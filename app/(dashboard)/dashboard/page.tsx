import { DashboardPageClient } from "@/components/dashboard/dashboard-page-client";
import { HomeHubClient } from "@/components/dashboard/home-hub-client";
import { getCurrentOrganization } from "@/lib/organization";
import { resolveOrganizationDisplayName } from "@/lib/organization-display";
import type { DashboardPeriodPreset } from "@/lib/dashboard-types";
import { getDashboardDataAction } from "@/server/actions/dashboard.actions";

type PageProps = { searchParams: Promise<Record<string, string | undefined>> };

export default async function DashboardPage({ searchParams }: PageProps) {
  const { user, organization } = await getCurrentOrganization();
  const params = await searchParams;
  const organizationName = resolveOrganizationDisplayName(organization.name, organization.slug);

  if (params.view !== "kpi") {
    return <HomeHubClient user={user} organizationName={organizationName} />;
  }

  const result = await getDashboardDataAction(params);

  if (!result.success) {
    throw new Error("Impossible de charger le tableau de bord");
  }

  const preset = (params.preset ?? "THIS_MONTH") as DashboardPeriodPreset;

  return (
    <DashboardPageClient
      user={user}
      organizationName={organizationName}
      data={result.data}
      preset={preset}
      startDate={params.startDate}
      endDate={params.endDate}
    />
  );
}
