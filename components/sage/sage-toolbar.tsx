"use client";

import type { LucideIcon } from "lucide-react";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function SageToolbar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-stretch gap-0.5 rounded-lg border border-slate-200 bg-white p-1.5 shadow-sm">
      {children}
    </div>
  );
}

export function SageActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  title,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      className={cn(
        "flex w-[68px] shrink-0 flex-col items-center gap-1 rounded-md px-1.5 py-1.5 text-[11px] leading-tight transition-colors",
        disabled
          ? "cursor-not-allowed text-slate-300"
          : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
      )}
    >
      <Icon className="h-5 w-5" />
      <span className="text-center">{label}</span>
    </button>
  );
}

export type SageMenuItem = {
  label: string;
  icon?: LucideIcon;
  onClick?: () => void;
  disabled?: boolean;
};

export function SageActionMenu({
  icon: Icon,
  label,
  items,
}: {
  icon: LucideIcon;
  label: string;
  items: SageMenuItem[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-[68px] shrink-0 flex-col items-center gap-1 rounded-md px-1.5 py-1.5 text-[11px] leading-tight text-slate-700 transition-colors hover:bg-slate-100"
        >
          <Icon className="h-5 w-5" />
          <span className="flex items-center">
            {label} <ChevronDown className="h-3 w-3" />
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <div className="px-2 py-1.5 text-xs font-semibold text-slate-500">{label}</div>
        <DropdownMenuSeparator />
        {items.map((item, i) => (
          <DropdownMenuItem key={i} disabled={item.disabled} onClick={item.onClick}>
            {item.icon ? <item.icon className="mr-2 h-4 w-4" /> : null}
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
