import Link from "next/link";
import { AlertTriangle, Info, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardAlert } from "@/lib/dashboard-types";

const severityConfig = {
  CRITICAL: { label: "Critique", variant: "destructive" as const, Icon: AlertCircle },
  WARNING: { label: "Attention", variant: "warning" as const, Icon: AlertTriangle },
  INFO: { label: "Info", variant: "secondary" as const, Icon: Info },
};

export function DashboardAlerts({ alerts }: { alerts: DashboardAlert[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Alertes métier</CardTitle>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Aucune alerte active pour le moment.
          </p>
        ) : (
          <ul className="space-y-3">
            {alerts.slice(0, 10).map((alert) => {
              const cfg = severityConfig[alert.severity];
              const Icon = cfg.Icon;
              const content = (
                <li className="flex gap-3 rounded-lg border p-3">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm">{alert.title}</span>
                      <Badge variant={cfg.variant}>{cfg.label}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
                      {alert.description}
                    </p>
                  </div>
                </li>
              );
              return alert.href ? (
                <Link key={alert.id} href={alert.href} className="block hover:opacity-90">
                  {content}
                </Link>
              ) : (
                <div key={alert.id}>{content}</div>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
