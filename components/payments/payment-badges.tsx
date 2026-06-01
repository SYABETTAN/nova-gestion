import type { PaymentMethod, PaymentStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/payment-status";

const STATUS_VARIANTS: Record<PaymentStatus, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  DRAFT: "secondary",
  CONFIRMED: "default",
  PARTIALLY_ALLOCATED: "warning",
  FULLY_ALLOCATED: "success",
  CANCELLED: "destructive",
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <Badge variant={STATUS_VARIANTS[status] ?? "secondary"}>
      {PAYMENT_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

export function PaymentMethodBadge({ method }: { method: PaymentMethod }) {
  return <Badge variant="outline">{PAYMENT_METHOD_LABELS[method] ?? method}</Badge>;
}
