"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CreditCard,
  Bell,
  ClipboardList,
  Contact,
  FileInput,
  FileOutput,
  FileStack,
  FileText,
  Hash,
  Receipt,
  LayoutDashboard,
  Search,
  LogOut,
  Package,
  Scale,
  Truck,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/roles";
import type { SessionUser } from "@/lib/permissions";
import { logoutAction } from "@/server/actions/auth.actions";

const navItems = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/search", label: "Recherche", icon: Search },
  { href: "/exports", label: "Exports", icon: FileOutput },
  { href: "/documents", label: "Documents", icon: FileStack },
  { href: "/customers", label: "Clients", icon: Contact },
  { href: "/items", label: "Articles & services", icon: Package },
  { href: "/quotes", label: "Devis", icon: FileText },
  { href: "/invoices", label: "Factures", icon: Receipt },
  { href: "/payments", label: "Paiements", icon: CreditCard },
  { href: "/reminders", label: "Relances", icon: Bell },
  { href: "/suppliers", label: "Fournisseurs", icon: Truck },
  { href: "/supplier-invoices", label: "Factures fournisseurs", icon: FileInput },
  { href: "/accounting", label: "Comptabilité légère", icon: Scale },
  { href: "/settings", label: "Paramètres", icon: Building2 },
  { href: "/settings/company", label: "Entreprise", icon: Building2 },
  { href: "/settings/team", label: "Équipe", icon: Users },
  { href: "/settings/numbering", label: "Numérotation", icon: Hash },
  { href: "/settings/audit-log", label: "Journal d'audit", icon: ClipboardList },
];

type DashboardShellProps = {
  user: SessionUser;
  organizationName: string;
  searchSlot?: React.ReactNode;
  children: React.ReactNode;
};

export function DashboardShell({ user, organizationName, searchSlot, children }: DashboardShellProps) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden w-64 flex-col border-r bg-white lg:flex">
        <div className="border-b p-6">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
              NG
            </div>
            <div>
              <p className="font-semibold">{organizationName}</p>
              <p className="text-xs text-[var(--color-muted-foreground)]">Nova Gestion</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b bg-white px-4 py-3 lg:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {searchSlot ? <div className="min-w-0 flex-1 max-w-xl">{searchSlot}</div> : null}
            <span className="hidden shrink-0 text-sm text-[var(--color-muted-foreground)] lg:inline">
              {organizationName}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <div className="text-right text-sm">
              <p className="font-medium">{user.name}</p>
              <p className="text-[var(--color-muted-foreground)]">
                {ROLE_LABELS[user.roleKey] ?? user.roleKey}
              </p>
            </div>
            <form action={logoutAction}>
              <Button type="submit" variant="outline" size="sm">
                <LogOut className="h-4 w-4" />
                Déconnexion
              </Button>
            </form>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
