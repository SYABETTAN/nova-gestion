import { Badge } from "@/components/ui/badge";
import {
  SUPPLIER_INVOICE_PAYMENT_STATUS_LABELS,
  SUPPLIER_INVOICE_STATUS_LABELS,
  SUPPLIER_INVOICE_TYPE_LABELS,
} from "@/lib/supplier-invoice-status";

export type SupplierInvoiceStatus = keyof typeof SUPPLIER_INVOICE_STATUS_LABELS;
export type SupplierInvoicePaymentStatus = keyof typeof SUPPLIER_INVOICE_PAYMENT_STATUS_LABELS;

export function SupplierInvoiceStatusBadge({ status }: { status: SupplierInvoiceStatus }) {
  const variants: Record<
    SupplierInvoiceStatus,
    "default" | "secondary" | "success" | "warning" | "destructive" | "outline"
  > = {
    DRAFT: "secondary",
    VALIDATED: "default",
    CANCELLED: "outline",
    ARCHIVED: "secondary",
  };
  return (
    <Badge variant={variants[status] ?? "secondary"}>
      {SUPPLIER_INVOICE_STATUS_LABELS[status]}
    </Badge>
  );
}

export function SupplierInvoicePaymentStatusBadge({
  status,
}: {
  status: SupplierInvoicePaymentStatus;
}) {
  const variants: Record<
    SupplierInvoicePaymentStatus,
    "default" | "secondary" | "success" | "warning" | "destructive"
  > = {
    UNPAID: "secondary",
    PARTIALLY_PAID: "warning",
    PAID: "success",
    OVERDUE: "destructive",
  };
  return (
    <Badge variant={variants[status] ?? "secondary"}>
      {SUPPLIER_INVOICE_PAYMENT_STATUS_LABELS[status]}
    </Badge>
  );
}

export function SupplierInvoiceTypeBadge({ type }: { type: string }) {
  return (
    <Badge variant="outline">
      {SUPPLIER_INVOICE_TYPE_LABELS[type] ?? type}
    </Badge>
  );
}
