"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AUDIT_ACTION_LABELS } from "@/lib/app-labels";
import { formatDate } from "@/lib/utils";

type AuditLogEntry = {
  id: string;
  action: string;
  entityType: string;
  entityLabel: string | null;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  createdAt: Date;
  user: { id: string; name: string; email: string } | null;
};

type AuditUser = { id: string; name: string; email: string };

type AuditLogPageClientProps = {
  logs: AuditLogEntry[];
  total: number;
  page: number;
  totalPages: number;
  users: AuditUser[];
  filters: {
    action?: string;
    userId?: string;
    entityType?: string;
    dateFrom?: string;
    dateTo?: string;
  };
};

export function AuditLogPageClient({
  logs,
  total,
  page,
  totalPages,
  users,
  filters,
}: AuditLogPageClientProps) {
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  function buildPageUrl(newPage: number) {
    const params = new URLSearchParams();
    if (filters.action) params.set("action", filters.action);
    if (filters.userId) params.set("userId", filters.userId);
    if (filters.entityType) params.set("entityType", filters.entityType);
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);
    params.set("page", String(newPage));
    return `/settings/audit-log?${params.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Journal d&apos;audit</h1>
        <p className="text-[var(--color-muted-foreground)]">
          Historique des actions — {total} entrée{total > 1 ? "s" : ""}
        </p>
      </div>

      <form method="get" className="grid gap-4 rounded-xl border bg-white p-4 md:grid-cols-5">
        <div className="space-y-2">
          <Label htmlFor="action">Action</Label>
          <Select name="action" defaultValue={filters.action ?? ""}>
            <SelectTrigger id="action">
              <SelectValue placeholder="Toutes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Toutes</SelectItem>
              {Object.entries(AUDIT_ACTION_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="userId">Utilisateur</Label>
          <Select name="userId" defaultValue={filters.userId ?? ""}>
            <SelectTrigger id="userId">
              <SelectValue placeholder="Tous" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tous</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="entityType">Type d&apos;entité</Label>
          <Input id="entityType" name="entityType" defaultValue={filters.entityType ?? ""} placeholder="Organization..." />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dateFrom">Date début</Label>
          <Input id="dateFrom" name="dateFrom" type="date" defaultValue={filters.dateFrom ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dateTo">Date fin</Label>
          <Input id="dateTo" name="dateTo" type="date" defaultValue={filters.dateTo ?? ""} />
        </div>
        <div className="md:col-span-5">
          <Button type="submit">Filtrer</Button>
        </div>
      </form>

      <div className="rounded-xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Utilisateur</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entité</TableHead>
              <TableHead>Libellé</TableHead>
              <TableHead>Détail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="whitespace-nowrap text-sm">
                  {formatDate(log.createdAt)}
                </TableCell>
                <TableCell>{log.user?.name ?? "—"}</TableCell>
                <TableCell>
                  {AUDIT_ACTION_LABELS[log.action] ?? log.action}
                </TableCell>
                <TableCell>{log.entityType}</TableCell>
                <TableCell>{log.entityLabel ?? "—"}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)}>
                    Voir
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Page {page} sur {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Button variant="outline" size="sm" asChild>
                <a href={buildPageUrl(page - 1)}>Précédent</a>
              </Button>
            )}
            {page < totalPages && (
              <Button variant="outline" size="sm" asChild>
                <a href={buildPageUrl(page + 1)}>Suivant</a>
              </Button>
            )}
          </div>
        </div>
      )}

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Détail de l&apos;entrée d&apos;audit</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-medium">Action</p>
                <p>{AUDIT_ACTION_LABELS[selectedLog.action] ?? selectedLog.action}</p>
              </div>
              {selectedLog.oldValues && (
                <div>
                  <p className="font-medium">Anciennes valeurs</p>
                  <pre className="mt-1 overflow-auto rounded bg-slate-50 p-3 text-xs">
                    {JSON.stringify(selectedLog.oldValues, null, 2)}
                  </pre>
                </div>
              )}
              {selectedLog.newValues && (
                <div>
                  <p className="font-medium">Nouvelles valeurs</p>
                  <pre className="mt-1 overflow-auto rounded bg-slate-50 p-3 text-xs">
                    {JSON.stringify(selectedLog.newValues, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
