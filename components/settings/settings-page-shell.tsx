import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function SettingsPageShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{title}</h1>
          </div>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{description}</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/settings">← Centre de configuration</Link>
        </Button>
      </div>
      {children}
    </div>
  );
}
