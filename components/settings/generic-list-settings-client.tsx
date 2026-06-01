"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SettingsPageShell } from "@/components/settings/settings-page-shell";

type Row = Record<string, string | number | boolean | null | undefined>;

export function GenericListSettingsClient({
  title,
  description,
  columns,
  rows,
  extraMessage,
}: {
  title: string;
  description: string;
  columns: { key: string; label: string }[];
  rows: Row[];
  extraMessage?: string;
}) {
  return (
    <SettingsPageShell title={title} description={description}>
      {extraMessage ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          {extraMessage}
        </p>
      ) : null}
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead key={c.key}>{c.label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i}>
              {columns.map((c) => (
                <TableCell key={c.key}>
                  {typeof row[c.key] === "boolean"
                    ? row[c.key]
                      ? <Badge variant="success">Oui</Badge>
                      : "Non"
                    : String(row[c.key] ?? "—")}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SettingsPageShell>
  );
}

export function useSettingsRefresh() {
  const router = useRouter();
  return () => {
    toast.success("Enregistré");
    router.refresh();
  };
}
