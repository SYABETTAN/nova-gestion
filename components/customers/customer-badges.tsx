import type { CustomerStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { getCustomerStatusColor, getCustomerStatusLabel } from "@/lib/customer-utils";
import { cn } from "@/lib/utils";

export function CustomerStatusBadge({ status }: { status: CustomerStatus }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", getCustomerStatusColor(status))}>
      {getCustomerStatusLabel(status)}
    </span>
  );
}

export function CustomerTypeBadge({ type }: { type: "COMPANY" | "INDIVIDUAL" }) {
  return (
    <Badge variant="secondary">
      {type === "COMPANY" ? "Société" : "Particulier"}
    </Badge>
  );
}
