import type { SessionUser } from "@/lib/permissions";

export class TenantAccessError extends Error {
  constructor(message = "Accès refusé à cette ressource.") {
    super(message);
    this.name = "TenantAccessError";
  }
}

export function assertSameOrganization(
  user: Pick<SessionUser, "organizationId">,
  resourceOrganizationId: string,
): void {
  if (user.organizationId !== resourceOrganizationId) {
    throw new TenantAccessError();
  }
}

export function organizationScopedWhere<T extends { organizationId?: string }>(
  user: Pick<SessionUser, "organizationId">,
  where: T = {} as T,
): T & { organizationId: string } {
  return { ...where, organizationId: user.organizationId };
}
