"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyChartState } from "@/components/dashboard/empty-chart-state";
import { formatDashboardCurrency } from "@/lib/dashboard-formatters";
import type { MonthlyPoint, OverdueBucket, StatusSlice } from "@/lib/dashboard-types";

const COLORS = ["#2563eb", "#7c3aed", "#059669", "#d97706", "#dc2626", "#64748b"];

function hasData(points: { value: number }[]): boolean {
  return points.some((p) => p.value > 0);
}

export function RevenueChart({ data }: { data: MonthlyPoint[] }) {
  if (!hasData(data)) return <EmptyChartState />;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
        <Tooltip formatter={(v: number) => formatDashboardCurrency(v)} />
        <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} name="CA HT" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CashInChart({ data }: { data: MonthlyPoint[] }) {
  if (!hasData(data)) return <EmptyChartState />;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v: number) => formatDashboardCurrency(v)} />
        <Bar dataKey="value" fill="#059669" radius={[4, 4, 0, 0]} name="Encaissements" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StatusPieChart({ data }: { data: StatusSlice[] }) {
  if (!hasData(data)) return <EmptyChartState />;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={72} label={false}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function OverdueBucketsChart({ data }: { data: OverdueBucket[] }) {
  if (!data.some((b) => b.amount > 0)) return <EmptyChartState message="Aucune facture en retard" />;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v: number) => formatDashboardCurrency(v)} />
        <Bar dataKey="amount" fill="#dc2626" radius={[4, 4, 0, 0]} name="Montant" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
