"use client";

import { GlobalSearchInput } from "@/components/search/global-search-input";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import type { SessionUser } from "@/lib/permissions";

export function DashboardSearchShell({
  user,
  organizationName,
  children,
}: {
  user: SessionUser;
  organizationName: string;
  children: React.ReactNode;
}) {
  return (
    <DashboardShell
      user={user}
      organizationName={organizationName}
      searchSlot={<GlobalSearchInput user={user} />}
    >
      {children}
    </DashboardShell>
  );
}
