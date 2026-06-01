import type { InvoicePaymentStatus, InvoiceStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import {
  INVOICE_PAYMENT_STATUS_LABELS,
  INVOICE_STATUS_LABELS,
  INVOICE_TYPE_LABELS,
} from "@/lib/invoice-status";

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const variants: Record<InvoiceStatus, "default" | "secondary" | "success" | "warning" | "destructive" | "outline"> = {
    DRAFT: "secondary",
    VALIDATED: "default",
    SENT: "default",
    OVERDUE: "warning",
    PAID: "success",
    PARTIALLY_PAID: "warning",
    CANCELLED: "outline",
    CREDITED: "success",
  };
  return <Badge variant={variants[status] ?? "secondary"}>{INVOICE_STATUS_LABELS[status]}</Badge>;
}

export function InvoicePaymentStatusBadge({ status }: { status: InvoicePaymentStatus }) {
  const variants: Record<InvoicePaymentStatus, "default" | "secondary" | "success" | "warning" | "destructive"> = {
    UNPAID: "secondary",
    PARTIALLY_PAID: "warning",
    PAID: "success",
    OVERDUE: "destructive",
  };
  return <Badge variant={variants[status] ?? "secondary"}>{INVOICE_PAYMENT_STATUS_LABELS[status]}</Badge>;
}

export function InvoiceTypeBadge({ type }: { type: string }) {
  return <Badge variant="outline">{INVOICE_TYPE_LABELS[type] ?? type}</Badge>;
}
