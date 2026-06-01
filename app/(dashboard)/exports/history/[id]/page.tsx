import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getExportJobByIdAction } from "@/server/actions/export-history.actions";

type PageProps = { params: Promise<{ id: string }> };

export default async function ExportJobDetailPage({ params }: PageProps) {
  const { id } = await params;
  let job;
  try {
    job = await getExportJobByIdAction(id);
  } catch {
    notFound();
  }

  const filters = job.filters ? JSON.parse(job.filters) : {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Détail export</h1>
        <Button variant="outline" asChild>
          <Link href="/exports/history">Retour</Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {job.type} — {job.format}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Statut : <Badge>{job.status}</Badge>
          </p>
          <p>Fichier : {job.fileName ?? "—"}</p>
          <p>Lignes : {job.rowCount ?? "—"}</p>
          <p>Demandé par : {job.requestedBy?.name ?? "—"}</p>
          <p>Créé le : {new Date(job.createdAt).toLocaleString("fr-FR")}</p>
          <p>Terminé le : {job.completedAt ? new Date(job.completedAt).toLocaleString("fr-FR") : "—"}</p>
          {job.errorMessage ? (
            <p className="text-red-600">Erreur : {job.errorMessage}</p>
          ) : null}
          <pre className="mt-4 overflow-auto rounded bg-slate-50 p-3 text-xs">
            {JSON.stringify(filters, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
