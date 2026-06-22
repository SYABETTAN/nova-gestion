"use client";

import Link from "next/link";
import { Home, LineChart } from "lucide-react";
import { cn } from "@/lib/utils";

type DashboardView = "hub" | "kpi";

const tabs: { view: DashboardView; href: string; label: string; icon: typeof Home }[] = [
  { view: "hub", href: "/dashboard", label: "Accueil", icon: Home },
  { view: "kpi", href: "/dashboard?view=kpi", label: "Tableau de bord", icon: LineChart },
];

export function DashboardViewTabs({ active }: { active: DashboardView }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-white p-1">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.view === active;
        return (
          <Link
            key={tab.view}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-blue-600 text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
            )}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
