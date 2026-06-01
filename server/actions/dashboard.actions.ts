"use server";

import { requireAuth } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";
import { getDateRangeFromPreset } from "@/lib/dashboard-periods";
import type { DashboardPeriodPreset } from "@/lib/dashboard-types";
import { dashboardPeriodFilterSchema } from "@/lib/dashboard-validators";
import { requirePermission } from "@/lib/permissions";

function parsePeriod(searchParams: Record<string, string | undefined>) {
  const parsed = dashboardPeriodFilterSchema.parse({
    preset: searchParams.preset ?? "THIS_MONTH",
    startDate: searchParams.startDate,
    endDate: searchParams.endDate,
  });
  return getDateRangeFromPreset(
    parsed.preset as DashboardPeriodPreset,
    parsed.startDate,
    parsed.endDate,
  );
}

export async function getDashboardDataAction(searchParams: Record<string, string | undefined>) {
  const user = await requireAuth();
  requirePermission(user, "DASHBOARD_READ");
  const period = parsePeriod(searchParams);
  const data = await getDashboardData(user.organizationId, period);
  return { success: true as const, data };
}
