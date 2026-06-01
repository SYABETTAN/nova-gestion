"use client";

import type { PermissionKey } from "@prisma/client";
import type { SessionUser } from "@/lib/permissions";
import { hasPermission } from "@/lib/permissions";

type PermissionGateProps = {
  user: Pick<SessionUser, "permissions">;
  permission: PermissionKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

export function PermissionGate({
  user,
  permission,
  children,
  fallback = null,
}: PermissionGateProps) {
  if (!hasPermission(user, permission)) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
}
