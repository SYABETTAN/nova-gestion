"use client";

import Link from "next/link";
import { toast } from "sonner";
import { Download, Scale } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PermissionGate } from "@/components/shared/permission-gate";
import { DashboardPeriodFilter } from "@/components/dashboard/dashboard-period-filter";
import { KpiCard } from "@/components/dashboard/kpi-card";
import {
  CashInChart,
  ChartCard,
  OverdueBucketsChart,
  RevenueChart,
  StatusPieChart,
} from "@/components/dashboard/dashboard-charts-lazy";
import { DashboardAlerts } from "@/components/dashboard/dashboard-alerts";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { TopListTable } from "@/components/dashboard/top-list-table";
import { formatPeriodLabel } from "@/lib/dashboard-periods";
import type { DashboardData, DashboardPeriodPreset } from "@/lib/dashboard-types";
import { ROLE_LABELS } from "@/lib/roles";
import type { SessionUser } from "@/lib/permissions";
import { exportDashboardKpisCsvAction } from "@/server/actions/dashboard-export.actions";

type Props = {
  user: SessionUser;
  organizationName: string;
  data: DashboardData;
  preset: DashboardPeriodPreset;
  startDate?: string;
  endDate?: string;
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold tracking-tight">{children}</h2>;
}

export function DashboardPageClient({
  user,
  organizationName,
  data,
  preset,
  startDate,
  endDate,
}: Props) {
  const periodLabel = formatPeriodLabel(data.period);

  async function handleExport() {
    const result = await exportDashboardKpisCsvAction({
      preset,
      startDate,
      endDate,
    });
    if (result.success) {
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export CSV téléchargé");
    } else {
      toast.error("Export impossible");
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
          </div>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            {organizationName} — {user.name} ({ROLE_LABELS[user.roleKey]}) — {periodLabel}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:items-end">
          <DashboardPeriodFilter preset={preset} startDate={startDate} endDate={endDate} />
          <PermissionGate user={user} permission="DASHBOARD_EXPORT">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Exporter les indicateurs
            </Button>
          </PermissionGate>
        </div>
      </div>

      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-6">
          <p className="text-sm text-amber-900">
            <strong>Indicateurs calculés à partir de vos données.</strong> Indicateurs calculés à
            partir de données de démonstration. Non certifiés pour une utilisation comptable ou
            fiscale réelle.
          </p>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <SectionTitle>Vue d&apos;ensemble</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <KpiCard label="CA facturé (HT)" value={data.overview.invoicedRevenue} />
          <KpiCard label="Encaissements" value={data.overview.cashCollected} />
          <KpiCard label="À encaisser" value={data.overview.amountToCollect} />
          <KpiCard label="Dépenses fournisseurs" value={data.overview.supplierExpenses} />
          <KpiCard label="Résultat simplifié" value={data.overview.simplifiedResult} />
          <KpiCard label="TVA nette indicative" value={data.overview.netVatIndicative} />
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle>Performance commerciale</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Clients actifs" value={data.commercial.activeCustomers} format="number" />
          <KpiCard label="Nouveaux clients" value={data.commercial.newCustomers} format="number" />
          <KpiCard label="Devis créés" value={data.commercial.quotesCount} format="number" />
          <KpiCard
            label="Taux d'acceptation"
            value={data.commercial.quoteAcceptanceRate}
            format="percent"
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Évolution des devis">
            <CashInChart data={data.commercial.quotesMonthly} />
          </ChartCard>
          <ChartCard title="Devis par statut">
            <StatusPieChart data={data.commercial.quotesByStatus} />
          </ChartCard>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <TopListTable title="Top 5 clients (CA facturé)" rows={data.commercial.topCustomers} />
          <TopListTable title="Top 5 articles / services" rows={data.commercial.topItems} />
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle>Facturation clients</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Factures émises" value={data.invoices.invoiceCount} format="number" />
          <KpiCard label="Factures payées" value={data.invoices.paidCount} format="number" />
          <KpiCard label="Factures en retard" value={data.invoices.overdueCount} format="number" />
          <KpiCard label="Montant à encaisser" value={data.invoices.amountToCollect} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="CA mensuel facturé (HT)">
            <RevenueChart data={data.invoices.revenueMonthly} />
          </ChartCard>
          <ChartCard title="Répartition par statut de paiement">
            <StatusPieChart data={data.invoices.paymentStatusBreakdown} />
          </ChartCard>
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle>Paiements et encaissements</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Montant encaissé" value={data.payments.collectedAmount} />
          <KpiCard label="Paiements reçus" value={data.payments.paymentCount} format="number" />
          <KpiCard label="Non alloué" value={data.payments.unallocatedAmount} />
          <KpiCard label="Factures soldées" value={data.payments.settledInvoices} format="number" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Encaissements mensuels">
            <CashInChart data={data.payments.cashInMonthly} />
          </ChartCard>
          <ChartCard title="Répartition par mode de paiement">
            <StatusPieChart data={data.payments.byMethod} />
          </ChartCard>
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle>Retards et relances</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Factures à relancer" value={data.reminders.invoicesToRemind} format="number" />
          <KpiCard label="Montant en retard" value={data.reminders.overdueAmount} />
          <KpiCard
            label="Retard moyen (jours)"
            value={data.reminders.averageOverdueDays}
            format="number"
          />
          <KpiCard label="Relances envoyées" value={data.reminders.remindersSent} format="number" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Montants en retard par ancienneté">
            <OverdueBucketsChart data={data.reminders.overdueBuckets} />
          </ChartCard>
          <TopListTable
            title="Top 5 clients en retard"
            rows={data.reminders.topOverdueCustomers}
            emptyMessage="Aucun retard client"
          />
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle>Fournisseurs et dépenses</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Fournisseurs actifs" value={data.suppliers.activeSuppliers} format="number" />
          <KpiCard label="Dépenses (HT)" value={data.suppliers.expensesAmount} />
          <KpiCard label="À payer" value={data.suppliers.amountToPay} />
          <KpiCard
            label="Factures fourn. en retard"
            value={data.suppliers.overdueSupplierInvoices}
            format="number"
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Dépenses mensuelles">
            <RevenueChart data={data.suppliers.expensesMonthly} />
          </ChartCard>
          <ChartCard title="Dépenses par catégorie">
            <StatusPieChart data={data.suppliers.expensesByCategory} />
          </ChartCard>
        </div>
        <TopListTable title="Top 5 fournisseurs" rows={data.suppliers.topSuppliers} />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <SectionTitle>Comptabilité légère</SectionTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href="/accounting">
              <Scale className="mr-2 h-4 w-4" />
              Ouvrir la comptabilité
            </Link>
          </Button>
        </div>
        <Card className="border-slate-200 bg-slate-50">
          <CardContent className="pt-4 text-sm text-slate-700">
            Comptabilité légère — indicateurs indicatifs.
          </CardContent>
        </Card>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Écritures" value={data.accounting.entryCount} format="number" />
          <KpiCard label="Brouillons" value={data.accounting.draftCount} format="number" />
          <KpiCard label="Non équilibrées" value={data.accounting.unbalancedCount} format="number" />
          <KpiCard label="TVA nette indicative" value={data.accounting.netVat} />
        </div>
        <ChartCard title="Écritures par journal">
          <StatusPieChart data={data.accounting.byJournal} />
        </ChartCard>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardAlerts alerts={data.alerts} />
        <RecentActivity items={data.recentActivity} />
      </div>
    </div>
  );
}
