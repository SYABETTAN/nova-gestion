"use client";

import { Label } from "@/components/ui/label";

export function SageFilterBar({
  action,
  children,
}: {
  action: string;
  children: React.ReactNode;
}) {
  return (
    <form
      method="get"
      action={action}
      className="flex flex-wrap items-end gap-4 rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
    >
      {children}
    </form>
  );
}

export function SageFilterField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={htmlFor} className="text-xs text-slate-500">
        {label}
      </Label>
      {children}
    </div>
  );
}
