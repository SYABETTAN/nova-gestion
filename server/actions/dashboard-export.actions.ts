"use server";

import { requireAuth } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { dashboardDataToKpiRows, getDashboardData } from "@/lib/dashboard";
import { generateDashboardKpisCsv } from "@/lib/csv";
import { getDateRangeFromPreset } from "@/lib/dashboard-periods";
import type { DashboardPeriodPreset } from "@/lib/dashboard-types";
import { dashboardExportSchema } from "@/lib/dashboard-validators";
import { requirePermission } from "@/lib/permissions";

export async function exportDashboardKpisCsvAction(
  searchParams: Record<string, string | undefined>,
) {
  const user = await requireAuth();
  requirePermission(user, "DASHBOARD_EXPORT");

  const parsed = dashboardExportSchema.parse(searchParams);
  const preset = (parsed.preset ?? "THIS_MONTH") as DashboardPeriodPreset;
  const period = getDateRangeFromPreset(
    preset,
    parsed.startDate ? new Date(parsed.startDate) : undefined,
    parsed.endDate ? new Date(parsed.endDate) : undefined,
  );

  const data = await getDashboardData(user.organizationId, period);
  const rows = dashboardDataToKpiRows(data).map((row) => ({
    ...row,
    periodStart: period.startDate.toISOString().slice(0, 10),
    periodEnd: period.endDate.toISOString().slice(0, 10),
    generatedAt: new Date().toISOString(),
  }));

  const csv = generateDashboardKpisCsv(rows);

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "DASHBOARD_EXPORTED" as const,
    entityType: "Dashboard",
    entityLabel: "Export KPIs tableau de bord",
  });

  return { success: true as const, csv, filename: "tableau-de-bord.csv" };
}
