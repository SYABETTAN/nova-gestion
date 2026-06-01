export function EmptyChartState({ message = "Aucune donnée sur cette période" }: { message?: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed bg-slate-50/50 text-sm text-[var(--color-muted-foreground)]">
      {message}
    </div>
  );
}
