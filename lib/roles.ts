import type { SystemRole } from "@prisma/client";

export const ROLE_LABELS: Record<SystemRole, string> = {
  OWNER: "Propriétaire",
  ADMIN: "Administrateur",
  ACCOUNTANT: "Comptable",
  SALES: "Commercial",
  READ_ONLY: "Lecture seule",
};
