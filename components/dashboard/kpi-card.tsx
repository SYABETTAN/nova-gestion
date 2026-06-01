import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDashboardCurrency, formatDashboardNumber } from "@/lib/dashboard-formatters";
import { cn } from "@/lib/utils";

type KpiCardProps = {
  label: string;
  value: number;
  format?: "currency" | "number" | "percent";
  sublabel?: string;
  className?: string;
};

export function KpiCard({ label, value, format = "currency", sublabel, className }: KpiCardProps) {
  const display =
    format === "currency"
      ? formatDashboardCurrency(value)
      : format === "percent"
        ? `${value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`
        : formatDashboardNumber(value);

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-[var(--color-muted-foreground)]">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold tracking-tight">{display}</p>
        {sublabel ? (
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">{sublabel}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
