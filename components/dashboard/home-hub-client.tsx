"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bell,
  BookCheck,
  Contact,
  CreditCard,
  FileText,
  LineChart,
  Package,
  Receipt,
  ScrollText,
  Truck,
  Undo2,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PermissionKey } from "@prisma/client";
import { hasPermission, type SessionUser } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/roles";
import { DashboardViewTabs } from "@/components/dashboard/dashboard-view-tabs";
import { cn } from "@/lib/utils";

type HubAction = {
  title: string;
  subtitle: string;
  href: string;
  icon: LucideIcon;
  permission: PermissionKey;
  /** Mise en avant visuelle pour les actions de création directe. */
  primary?: boolean;
};

type HubBlock = {
  id: string;
  title: string;
  description: string;
  actions: HubAction[];
};

const blocks: HubBlock[] = [
  {
    id: "ventes",
    title: "Ventes",
    description: "Créez vos pièces commerciales en un clic.",
    actions: [
      {
        title: "Préparer un devis",
        subtitle: "Nouvelle proposition commerciale",
        href: "/quotes/new",
        icon: FileText,
        permission: "QUOTES_CREATE",
        primary: true,
      },
      {
        title: "Préparer une facture",
        subtitle: "Facturer un client",
        href: "/invoices/new",
        icon: Receipt,
        permission: "INVOICES_CREATE",
        primary: true,
      },
      {
        title: "Avoir",
        subtitle: "Établir un avoir depuis une facture",
        href: "/invoices",
        icon: Undo2,
        permission: "INVOICES_VALIDATE",
        primary: true,
      },
      {
        title: "Règlement client",
        subtitle: "Enregistrer un encaissement",
        href: "/payments/new",
        icon: CreditCard,
        permission: "PAYMENTS_CREATE",
        primary: true,
      },
    ],
  },
  {
    id: "articles-tiers",
    title: "Articles & tiers",
    description: "Gérez votre catalogue et vos contacts.",
    actions: [
      {
        title: "Articles",
        subtitle: "Catalogue articles & services",
        href: "/items",
        icon: Package,
        permission: "ITEMS_READ",
      },
      {
        title: "Clients",
        subtitle: "Fiches et historique clients",
        href: "/customers",
        icon: Contact,
        permission: "CUSTOMERS_READ",
      },
      {
        title: "Fournisseurs",
        subtitle: "Fiches et achats fournisseurs",
        href: "/suppliers",
        icon: Truck,
        permission: "SUPPLIERS_READ",
      },
      {
        title: "Suivre mes ventes",
        subtitle: "Détail des ventes ligne par ligne",
        href: "/sales-detail",
        icon: LineChart,
        permission: "INVOICES_READ",
      },
    ],
  },
  {
    id: "reglements-suivi",
    title: "Règlements & suivi",
    description: "Encaissements, relances et comptabilité.",
    actions: [
      {
        title: "Liste règlements",
        subtitle: "Suivi des encaissements",
        href: "/payments",
        icon: Wallet,
        permission: "PAYMENTS_READ",
      },
      {
        title: "Relances",
        subtitle: "Recouvrement des impayés",
        href: "/reminders",
        icon: Bell,
        permission: "REMINDERS_READ",
      },
      {
        title: "Générer les écritures comptables",
        subtitle: "Comptabilisation des opérations",
        href: "/accounting",
        icon: BookCheck,
        permission: "ACCOUNTING_READ",
      },
      {
        title: "Contrôle comptable",
        subtitle: "Balance et équilibre des écritures",
        href: "/accounting/trial-balance",
        icon: ScrollText,
        permission: "ACCOUNTING_READ",
      },
    ],
  },
];

function ActionCard({ action }: { action: HubAction }) {
  const Icon = action.icon;
  return (
    <Link
      href={action.href}
      className={cn(
        "group flex h-full items-start gap-4 rounded-xl border bg-white p-4 transition-all",
        "hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
        action.primary
          ? "border-blue-100 hover:border-blue-300"
          : "border-[var(--color-border)] hover:border-slate-300",
      )}
    >
      <span
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors",
          action.primary
            ? "bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white"
            : "bg-slate-100 text-slate-600 group-hover:bg-slate-200",
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="font-semibold text-slate-900">{action.title}</span>
          <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-blue-600" />
        </span>
        <span className="mt-0.5 block text-sm text-[var(--color-muted-foreground)]">
          {action.subtitle}
        </span>
      </span>
    </Link>
  );
}

type Props = {
  user: SessionUser;
  organizationName: string;
};

export function HomeHubClient({ user, organizationName }: Props) {
  const visibleBlocks = blocks
    .map((block) => ({
      ...block,
      actions: block.actions.filter((action) => hasPermission(user, action.permission)),
    }))
    .filter((block) => block.actions.length > 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Accueil</h1>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            {organizationName} ({ROLE_LABELS[user.roleKey] ?? user.roleKey}) — que souhaitez-vous
            faire&nbsp;?
          </p>
        </div>
        <DashboardViewTabs active="hub" />
      </div>

      {visibleBlocks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-white p-10 text-center text-sm text-[var(--color-muted-foreground)]">
          Aucune action disponible pour votre profil. Contactez un administrateur.
        </div>
      ) : (
        visibleBlocks.map((block) => (
          <section key={block.id} className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">{block.title}</h2>
              <p className="text-sm text-[var(--color-muted-foreground)]">{block.description}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {block.actions.map((action) => (
                <ActionCard key={action.title} action={action} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
