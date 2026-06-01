import type { SystemRole } from "@prisma/client";

const ROLE_RANK: Record<SystemRole, number> = {
  OWNER: 100,
  ADMIN: 80,
  ACCOUNTANT: 60,
  SALES: 40,
  READ_ONLY: 20,
};

/** Seul un OWNER peut inviter un autre OWNER. */
export function canAssignRole(inviterRole: SystemRole, targetRole: SystemRole): boolean {
  if (targetRole === "OWNER" && inviterRole !== "OWNER") {
    return false;
  }
  return ROLE_RANK[targetRole] <= ROLE_RANK[inviterRole];
}

export function getRoleRank(role: SystemRole): number {
  return ROLE_RANK[role];
}
