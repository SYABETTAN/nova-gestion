import { DashboardPageClient } from "@/components/dashboard/dashboard-page-client";
import { getCurrentDemoOrganization } from "@/lib/organization";
import type { DashboardPeriodPreset } from "@/lib/dashboard-types";
import { getDashboardDataAction } from "@/server/actions/dashboard.actions";

type PageProps = { searchParams: Promise<Record<string, string | undefined>> };

export default async function DashboardPage({ searchParams }: PageProps) {
  const { user, organization } = await getCurrentDemoOrganization();
  const params = await searchParams;
  const result = await getDashboardDataAction(params);

  if (!result.success) {
    throw new Error("Impossible de charger le tableau de bord");
  }

  const preset = (params.preset ?? "THIS_MONTH") as DashboardPeriodPreset;

  return (
    <DashboardPageClient
      user={user}
      organizationName={organization.name}
      data={result.data}
      preset={preset}
      startDate={params.startDate}
      endDate={params.endDate}
    />
  );
}
