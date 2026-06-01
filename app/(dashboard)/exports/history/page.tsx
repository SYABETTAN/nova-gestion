import { ExportHistoryClient } from "@/components/exports/export-history-client";
import { listExportJobsAction } from "@/server/actions/export-history.actions";

type PageProps = { searchParams: Promise<Record<string, string | undefined>> };

export default async function ExportHistoryPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { jobs } = await listExportJobsAction(params);
  return <ExportHistoryClient jobs={jobs} />;
}
