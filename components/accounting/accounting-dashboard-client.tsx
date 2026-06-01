"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookOpen, Calculator, FileOutput, FileSpreadsheet, Layers, Scale, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PermissionGate } from "@/components/shared/permission-gate";
import { formatCurrency } from "@/lib/pricing";
import type { SessionUser } from "@/lib/permissions";
import type { MoneyInput } from "@/lib/money";
import { generateMissingAccountingEntriesAction } from "@/server/actions/accounting-generator.actions";

type Stats = {
  total: number;
  drafts: number;
  validated: number;
  cancelled: number;
  totalDebit: MoneyInput;
  totalCredit: MoneyInput;
  gap: number;
  vatCollected: number;
  vatDeductible: number;
};

export function AccountingDashboardClient({ user, stats }: { user: SessionUser; stats: Stats }) {
  const router = useRouter();

  async function handleGenerateMissing() {
    const result = await generateMissingAccountingEntriesAction();
    if (result.success) {
      toast.success(
        `${result.created} écritures créées (${result.skipped} ignorées) — factures: ${result.customerInvoicesProcessed}, paiements: ${result.paymentsProcessed}, achats: ${result.supplierInvoicesProcessed}`,
      );
      router.refresh();
    } else {
      toast.error("Erreur lors de la génération");
    }
  }

  const links = [
    { href: "/exports", label: "Centre d'exports", icon: FileOutput },
    { href: "/accounting/accounts", label: "Plan comptable", icon: Layers },
    { href: "/accounting/journals", label: "Journaux", icon: BookOpen },
    { href: "/accounting/entries", label: "Écritures", icon: FileSpreadsheet },
    { href: "/accounting/general-ledger", label: "Grand livre", icon: Calculator },
    { href: "/accounting/trial-balance", label: "Balance", icon: Scale },
    { href: "/accounting/vat-summary", label: "TVA indicative", icon: Wallet },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Comptabilité légère</h1>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            Suivez vos écritures issues des ventes, paiements et dépenses.
          </p>
        </div>
        <PermissionGate user={user} permission="ACCOUNTING_CREATE">
          <Button onClick={handleGenerateMissing}>Générer les écritures manquantes</Button>
        </PermissionGate>
      </div>


      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-[var(--color-muted-foreground)]">Total écritures</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats.total}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-[var(--color-muted-foreground)]">Brouillons</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats.drafts}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-[var(--color-muted-foreground)]">Validées</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{stats.validated}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-[var(--color-muted-foreground)]">Écart global</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{formatCurrency(stats.gap)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-[var(--color-muted-foreground)]">Total débit</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{formatCurrency(stats.totalDebit)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-[var(--color-muted-foreground)]">Total crédit</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{formatCurrency(stats.totalCredit)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-[var(--color-muted-foreground)]">TVA collectée indicative</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{formatCurrency(stats.vatCollected)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-[var(--color-muted-foreground)]">TVA déductible indicative</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{formatCurrency(stats.vatDeductible)}</p></CardContent></Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href} className="rounded-lg border bg-white p-4 transition hover:border-blue-300 hover:shadow-sm">
              <div className="flex items-center gap-3">
                <Icon className="h-5 w-5 text-blue-600" />
                <span className="font-medium">{link.label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
