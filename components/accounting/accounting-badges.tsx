import { Badge } from "@/components/ui/badge";
import {
  ACCOUNTING_ENTRY_STATUS_LABELS,
  ACCOUNTING_SOURCE_LABELS,
} from "@/lib/accounting-mapping";

export function AccountingEntryStatusBadge({ status }: { status: string }) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    DRAFT: "secondary",
    VALIDATED: "default",
    CANCELLED: "outline",
  };
  return (
    <Badge variant={variants[status] ?? "secondary"}>
      {ACCOUNTING_ENTRY_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

export function AccountingEntrySourceBadge({ sourceType }: { sourceType: string }) {
  return (
    <Badge variant="outline">
      {ACCOUNTING_SOURCE_LABELS[sourceType] ?? sourceType}
    </Badge>
  );
}

export function AccountingBalancedBadge({ isBalanced }: { isBalanced: boolean }) {
  return (
    <Badge variant={isBalanced ? "default" : "destructive"}>
      {isBalanced ? "Équilibrée" : "Non équilibrée"}
    </Badge>
  );
}
