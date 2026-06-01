import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { RecentActivityItem } from "@/lib/dashboard-types";

export function RecentActivity({ items }: { items: RecentActivityItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Activité récente</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">Aucune activité récente.</p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => {
              const row = (
                <li className="flex gap-3 border-l-2 border-blue-200 pl-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-[var(--color-muted-foreground)]">
                        {new Intl.DateTimeFormat("fr-FR", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(item.date))}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {item.type}
                      </Badge>
                    </div>
                    <p className="mt-0.5 font-medium text-sm">{item.title}</p>
                    {item.userName ? (
                      <p className="text-xs text-[var(--color-muted-foreground)]">
                        par {item.userName}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
              return item.href ? (
                <Link key={item.id} href={item.href}>
                  {row}
                </Link>
              ) : (
                <div key={item.id}>{row}</div>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
