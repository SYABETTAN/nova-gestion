"use server";

import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import {
  buildSalesDetailCsv,
  gatherSalesDetailRows,
  listSalesDetailQuery,
  type SalesDetailFilters,
} from "@/lib/sales-detail";

function parseFilters(searchParams: Record<string, string | undefined>): SalesDetailFilters {
  return {
    customerId: searchParams.customerId || undefined,
    itemId: searchParams.itemId || undefined,
    representativeId: searchParams.representativeId || undefined,
    from: searchParams.from || undefined,
    to: searchParams.to || undefined,
    criteria: searchParams.criteria || undefined,
    page: searchParams.page ? Number(searchParams.page) : undefined,
    pageSize: searchParams.pageSize ? Number(searchParams.pageSize) : undefined,
  };
}

export async function listSalesDetailAction(searchParams: Record<string, string | undefined>) {
  const user = await requireAuth();
  requirePermission(user, "INVOICES_READ");
  return listSalesDetailQuery(user.organizationId, parseFilters(searchParams));
}

export async function exportSalesDetailCsvAction(
  searchParams: Record<string, string | undefined>,
) {
  const user = await requireAuth();
  requirePermission(user, "INVOICES_READ");

  const rows = await gatherSalesDetailRows(user.organizationId, parseFilters(searchParams));
  const csv = buildSalesDetailCsv(rows);
  const date = new Date().toISOString().slice(0, 10);
  return { success: true as const, csv, filename: `detail-ventes-${date}.csv` };
}
