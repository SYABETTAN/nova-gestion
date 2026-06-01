"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

export const CashInChart = dynamic(
  () => import("@/components/dashboard/dashboard-charts").then((m) => m.CashInChart),
  { ssr: false, loading: () => <Skeleton className="h-[280px] w-full rounded-lg" /> },
);

export const RevenueChart = dynamic(
  () => import("@/components/dashboard/dashboard-charts").then((m) => m.RevenueChart),
  { ssr: false, loading: () => <Skeleton className="h-[280px] w-full rounded-lg" /> },
);

export const StatusPieChart = dynamic(
  () => import("@/components/dashboard/dashboard-charts").then((m) => m.StatusPieChart),
  { ssr: false, loading: () => <Skeleton className="h-[280px] w-full rounded-lg" /> },
);

export const OverdueBucketsChart = dynamic(
  () => import("@/components/dashboard/dashboard-charts").then((m) => m.OverdueBucketsChart),
  { ssr: false, loading: () => <Skeleton className="h-[280px] w-full rounded-lg" /> },
);

export { ChartCard } from "@/components/dashboard/dashboard-charts";
