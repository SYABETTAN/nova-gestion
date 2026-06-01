import { AuditLogPageClient } from "@/components/audit/audit-log-page-client";
import {
  getAuditLogUsersAction,
  getAuditLogsAction,
} from "@/server/actions/audit.actions";

type PageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function AuditLogPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const result = await getAuditLogsAction(params);
  const users = await getAuditLogUsersAction();

  return (
    <AuditLogPageClient
      logs={result.logs}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
      users={users}
      filters={{
        action: params.action,
        userId: params.userId,
        entityType: params.entityType,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
      }}
    />
  );
}
