import { SupplierStatus, SupplierType, SupplierRiskLevel } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import {
  getSupplierRiskLabel,
  getSupplierStatusLabel,
  getSupplierTypeLabel,
  SUPPLIER_RISK_COLORS,
  SUPPLIER_STATUS_COLORS,
} from "@/lib/supplier-utils";

export function SupplierStatusBadge({ status }: { status: SupplierStatus }) {
  return (
    <Badge variant="outline" className={SUPPLIER_STATUS_COLORS[status]}>
      {getSupplierStatusLabel(status)}
    </Badge>
  );
}

export function SupplierTypeBadge({ type }: { type: SupplierType }) {
  return <Badge variant="secondary">{getSupplierTypeLabel(type)}</Badge>;
}

export function SupplierRiskBadge({ riskLevel }: { riskLevel: SupplierRiskLevel }) {
  return (
    <Badge variant="outline" className={SUPPLIER_RISK_COLORS[riskLevel]}>
      {getSupplierRiskLabel(riskLevel)}
    </Badge>
  );
}
