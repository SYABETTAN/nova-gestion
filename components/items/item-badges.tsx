import type { ItemStatus, ItemType } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { getItemStatusColor, getItemStatusLabel, getItemTypeLabel } from "@/lib/item-utils";
import { getMarginBadgeVariant, moneyToNumber } from "@/lib/pricing";
import type { MoneyInput } from "@/lib/money";
import { cn } from "@/lib/utils";

export function ItemStatusBadge({ status }: { status: ItemStatus }) {
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", getItemStatusColor(status))}>
      {getItemStatusLabel(status)}
    </span>
  );
}

export function ItemTypeBadge({ type }: { status?: never; type: ItemType }) {
  return (
    <Badge variant={type === "PRODUCT" ? "secondary" : "default"}>
      {getItemTypeLabel(type)}
    </Badge>
  );
}

export function MarginBadge({ marginRate }: { marginRate: MoneyInput }) {
  const rate = moneyToNumber(marginRate);
  const variant = getMarginBadgeVariant(rate);
  if (variant === "normal") return null;

  const labels = {
    low: "Faible marge",
    high: "Forte marge",
    negative: "Marge négative",
  };
  const colors = {
    low: "bg-amber-100 text-amber-800",
    high: "bg-emerald-100 text-emerald-800",
    negative: "bg-red-100 text-red-800",
  };

  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold", colors[variant])}>
      {labels[variant]}
    </span>
  );
}
