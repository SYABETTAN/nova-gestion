import { cn } from "@/lib/utils";

export type SageTone =
  | "gray"
  | "slate"
  | "blue"
  | "sky"
  | "green"
  | "red"
  | "orange"
  | "amber"
  | "violet";

const TONE_CLASSES: Record<SageTone, string> = {
  gray: "bg-slate-100 text-slate-600",
  slate: "bg-slate-200 text-slate-700",
  blue: "bg-blue-100 text-blue-800",
  sky: "bg-sky-100 text-sky-800",
  green: "bg-emerald-100 text-emerald-800",
  red: "bg-red-100 text-red-800",
  orange: "bg-orange-100 text-orange-800",
  amber: "bg-amber-100 text-amber-800",
  violet: "bg-violet-100 text-violet-800",
};

export function SageStatusBadge({ label, tone }: { label: string; tone: SageTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold",
        TONE_CLASSES[tone],
      )}
    >
      {label}
    </span>
  );
}
