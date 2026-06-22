"use client";

import Link from "next/link";
import {
  FileText,
  Files,
  Layers,
  Receipt,
  ScrollText,
  Truck,
  Undo2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type PieceEntry = {
  key: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  disabled?: boolean;
};

const entries: PieceEntry[] = [
  { key: "all", label: "Toutes", icon: Layers, disabled: true },
  { key: "quotes", label: "Devis", icon: FileText, href: "/quotes" },
  { key: "orders", label: "Commandes", icon: ScrollText, disabled: true },
  { key: "delivery", label: "Bons de liv.", icon: Truck, disabled: true },
  { key: "deposit", label: "Fac. acompte", icon: Files, href: "/invoices?type=DEPOSIT" },
  { key: "invoices", label: "Factures", icon: Receipt, href: "/invoices" },
  { key: "credit-notes", label: "Avoirs", icon: Undo2, disabled: true },
];

export function InvoicePiecesNav({ activeKey = "invoices" }: { activeKey?: string }) {
  return (
    <nav className="flex w-44 shrink-0 flex-col overflow-hidden rounded-lg border border-emerald-800 bg-emerald-700 text-sm text-emerald-50 shadow-sm">
      <div className="border-b border-emerald-600/60 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-emerald-100">
        Pièces
      </div>
      <ul className="flex-1 py-1">
        {entries.map((entry) => {
          const Icon = entry.icon;
          const active = entry.key === activeKey;
          const baseClasses =
            "flex items-center gap-2 px-3 py-2 text-[13px] transition-colors";

          if (entry.disabled || !entry.href) {
            return (
              <li key={entry.key}>
                <span
                  title="Bientôt disponible"
                  aria-disabled="true"
                  className={cn(baseClasses, "cursor-not-allowed text-emerald-200/50")}
                >
                  <Icon className="h-4 w-4" />
                  {entry.label}
                </span>
              </li>
            );
          }

          return (
            <li key={entry.key}>
              <Link
                href={entry.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  baseClasses,
                  active
                    ? "bg-emerald-900 font-semibold text-white"
                    : "hover:bg-emerald-600 hover:text-white",
                )}
              >
                <Icon className="h-4 w-4" />
                {entry.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
