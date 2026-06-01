"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { PERIOD_PRESET_LABELS } from "@/lib/dashboard-periods";
import type { DashboardPeriodPreset } from "@/lib/dashboard-types";

const PRESETS = Object.keys(PERIOD_PRESET_LABELS) as DashboardPeriodPreset[];

type DashboardPeriodFilterProps = {
  preset: DashboardPeriodPreset;
  startDate?: string;
  endDate?: string;
};

export function DashboardPeriodFilter({ preset, startDate, endDate }: DashboardPeriodFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParams(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined || value === "") params.delete(key);
      else params.set(key, value);
    }
    router.push(`/dashboard?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label className="text-xs">Période</Label>
        <Select
          value={preset}
          onValueChange={(value) => {
            if (value !== "CUSTOM") {
              updateParams({ preset: value, startDate: undefined, endDate: undefined });
            } else {
              updateParams({ preset: value });
            }
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRESETS.map((p) => (
              <SelectItem key={p} value={p}>
                {PERIOD_PRESET_LABELS[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {preset === "CUSTOM" ? (
        <>
          <div className="space-y-1">
            <Label className="text-xs">Du</Label>
            <Input
              type="date"
              className="w-[160px]"
              defaultValue={startDate}
              onChange={(e) => updateParams({ startDate: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Au</Label>
            <Input
              type="date"
              className="w-[160px]"
              defaultValue={endDate}
              onChange={(e) => updateParams({ endDate: e.target.value })}
            />
          </div>
        </>
      ) : null}
      <Button variant="outline" size="sm" onClick={() => router.refresh()}>
        Actualiser
      </Button>
    </div>
  );
}
