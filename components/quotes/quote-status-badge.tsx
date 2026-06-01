import type { QuoteStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_VARIANTS } from "@/lib/quote-status";

type QuoteStatusBadgeProps = {
  status: QuoteStatus;
};

export function QuoteStatusBadge({ status }: QuoteStatusBadgeProps) {
  const variant = QUOTE_STATUS_VARIANTS[status] ?? "secondary";
  return <Badge variant={variant}>{QUOTE_STATUS_LABELS[status] ?? status}</Badge>;
}
