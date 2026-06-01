"use client";

import Link from "next/link";
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
import type { ExportJob } from "@prisma/client";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  PROCESSING: "En cours",
  COMPLETED: "Terminé",
  FAILED: "Échoué",
};

export function ExportHistoryClient({
  jobs,
}: {
  jobs: (ExportJob & { requestedBy: { name: string } | null })[];
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Historique des exports</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Jobs d&apos;export enregistrés
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/exports">Retour au centre d&apos;exports</Link>
        </Button>
      </div>

      {jobs.length === 0 ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">Aucun export enregistré.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Format</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Lignes</TableHead>
              <TableHead>Demandé par</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell>{new Date(job.createdAt).toLocaleString("fr-FR")}</TableCell>
                <TableCell>{job.type}</TableCell>
                <TableCell>{job.format}</TableCell>
                <TableCell>
                  <Badge variant={job.status === "FAILED" ? "destructive" : "secondary"}>
                    {STATUS_LABELS[job.status] ?? job.status}
                  </Badge>
                </TableCell>
                <TableCell>{job.rowCount ?? "—"}</TableCell>
                <TableCell>{job.requestedBy?.name ?? "—"}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/exports/history/${job.id}`}>Détails</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
