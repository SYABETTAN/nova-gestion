import type { ItemStatus, ItemType } from "@prisma/client";
import { getMarginBadgeVariant } from "@/lib/pricing";
import { moneyAdd, moneyToNumber, type MoneyInput } from "@/lib/money";

export const ITEM_STATUS_LABELS: Record<ItemStatus, string> = {
  DRAFT: "Brouillon",
  ACTIVE: "Actif",
  INACTIVE: "Inactif",
  ARCHIVED: "Archivé",
};

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  PRODUCT: "Produit",
  SERVICE: "Service",
};

export const ITEM_STATUS_COLORS: Record<ItemStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  ACTIVE: "bg-emerald-100 text-emerald-800",
  INACTIVE: "bg-amber-100 text-amber-800",
  ARCHIVED: "bg-red-100 text-red-800",
};

export const ITEM_ACTIVITY_LABELS: Record<string, string> = {
  CREATED: "Création",
  UPDATED: "Modification",
  PRICE_UPDATED: "Prix modifié",
  ADDED_TO_QUOTE: "Ajouté à un devis",
  ADDED_TO_INVOICE: "Ajouté à une facture",
  ARCHIVED: "Archivé",
  REACTIVATED: "Réactivé",
  NOTE: "Note",
};

export const RECURRING_INTERVAL_LABELS: Record<string, string> = {
  MONTHLY: "Mensuel",
  QUARTERLY: "Trimestriel",
  YEARLY: "Annuel",
};

export function getItemStatusLabel(status: ItemStatus): string {
  return ITEM_STATUS_LABELS[status] ?? status;
}

export function getItemTypeLabel(type: ItemType): string {
  return ITEM_TYPE_LABELS[type] ?? type;
}

export function getItemStatusColor(status: ItemStatus): string {
  return ITEM_STATUS_COLORS[status] ?? "bg-slate-100 text-slate-700";
}

export function parseTagIds(raw?: string): string[] {
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export type ItemStats = {
  total: number;
  activeProducts: number;
  activeServices: number;
  averageSalePrice: number;
  averageMarginRate: number;
};

export function computeItemStats(
  items: {
    type: ItemType;
    status: ItemStatus;
    isArchived: boolean;
    salePriceExcludingTax: MoneyInput;
    marginRate: MoneyInput;
  }[],
): ItemStats {
  const active = items.filter((i) => !i.isArchived && i.status === "ACTIVE");

  return {
    total: items.filter((i) => !i.isArchived).length,
    activeProducts: active.filter((i) => i.type === "PRODUCT").length,
    activeServices: active.filter((i) => i.type === "SERVICE").length,
    averageSalePrice:
      active.length > 0
        ? moneyToNumber(
            active.reduce((s, i) => moneyAdd(s, i.salePriceExcludingTax), moneyAdd(0, 0)),
          ) / active.length
        : 0,
    averageMarginRate:
      active.length > 0
        ? moneyToNumber(active.reduce((s, i) => moneyAdd(s, i.marginRate), moneyAdd(0, 0))) /
          active.length
        : 0,
  };
}

export { getMarginBadgeVariant };
